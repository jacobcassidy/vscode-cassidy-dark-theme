import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "../lib/jsonc.js";
import { listFiles, themeUiType } from "../lib/theme-targets.js";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readTheme(path) {
  let theme;

  try {
    theme = parseJsonc(await readFile(path, "utf8"), path).value;
  } catch (error) {
    throw new Error(`${path}: invalid JSONC (${error.message})`, { cause: error });
  }

  if (!isObject(theme) || !isObject(theme.colors) || !Array.isArray(theme.tokenColors)) {
    throw new Error(`${path}: expected a theme object with colors and a tokenColors array`);
  }

  if (theme.semanticTokenColors !== undefined && !isObject(theme.semanticTokenColors)) {
    throw new Error(`${path}: semanticTokenColors must be an object`);
  }

  if (theme.semanticHighlighting !== undefined && typeof theme.semanticHighlighting !== "boolean") {
    throw new Error(`${path}: semanticHighlighting must be a boolean`);
  }

  themeUiType(theme, path);

  return theme;
}

async function requireFile(root, path) {
  if (typeof path !== "string" || !path) {
    throw new Error("Manifest theme and icon paths must be nonempty strings");
  }

  if (!(await stat(join(root, path))).isFile()) {
    throw new Error(`Expected a file: ${path}`);
  }
}

export async function checkThemes(root = fileURLToPath(new URL("../../", import.meta.url))) {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const themes = manifest.contributes?.themes;

  if (!Array.isArray(themes) || !themes.length) {
    throw new Error("Manifest must contribute at least one theme");
  }

  await requireFile(root, manifest.icon);

  const paths = new Set();
  const labels = new Set();

  for (const theme of themes) {
    if (typeof theme.label !== "string" || !theme.label.trim() || labels.has(theme.label)) {
      throw new Error("Production theme labels must be nonempty and unique");
    }

    labels.add(theme.label);
    await requireFile(root, theme.path);

    const path = theme.path.replace(/^\.\//, "");

    if (!path.startsWith("themes/") || path.split("/").includes("..") || paths.has(path)) {
      throw new Error(`Invalid or duplicate production theme path: ${theme.path}`);
    }

    const metadata = await readTheme(join(root, path));

    if (theme.uiTheme !== themeUiType(metadata, path)) {
      throw new Error(`${theme.path}: manifest uiTheme does not match theme type ${metadata.type}`);
    }

    paths.add(path);
  }

  for (const file of await listFiles(join(root, "themes"))) {
    if (file.endsWith(".json") && !paths.has(`themes/${file}`)) {
      throw new Error(`Unregistered production theme: themes/${file}`);
    }
  }

  for (const directory of ["dev/themes", "dev/snapshots"]) {
    for (const file of await listFiles(join(root, directory))) {
      if (file.endsWith(".json")) paths.add(`${directory}/${file}`);
    }
  }

  for (const path of paths) {
    await readTheme(join(root, path));
  }

  return paths.size;
}

if (import.meta.main) {
  try {
    console.log(`Validated ${await checkThemes()} themes and manifest asset paths.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

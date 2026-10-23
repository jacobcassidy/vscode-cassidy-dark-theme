import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, printParseErrorCode } from "jsonc-parser";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readTheme(path) {
  const errors = [];
  const theme = parse(await readFile(path, "utf8"), errors, { allowTrailingComma: true });

  if (errors.length) {
    const details = errors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join(", ");

    throw new Error(`${path}: invalid JSONC (${details})`);
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
}

async function requireFile(root, path) {
  if (typeof path !== "string" || !path) {
    throw new Error("Manifest theme and icon paths must be nonempty strings");
  }

  if (!(await stat(join(root, path))).isFile()) {
    throw new Error(`Expected a file: ${path}`);
  }
}

export async function checkThemes(root = fileURLToPath(new URL("../", import.meta.url))) {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const themes = manifest.contributes?.themes;

  if (!Array.isArray(themes) || !themes.length) {
    throw new Error("Manifest must contribute at least one theme");
  }

  await requireFile(root, manifest.icon);

  const paths = new Set();

  for (const theme of themes) {
    await requireFile(root, theme.path);
    paths.add(theme.path);
  }

  const devThemes = await readdir(join(root, "dev/themes"), { withFileTypes: true });

  for (const entry of devThemes) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      paths.add(`dev/themes/${entry.name}`);
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

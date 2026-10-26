/**
 * Theme validation.
 * @file Validate generated theme structures, manifest registrations, and required asset paths.
 */

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "../lib/jsonc-validation.js";
import { listFiles, themeUiType } from "../lib/theme-source-inputs.js";

/**
 * Check for a non-null, non-array object.
 *
 * @param value - Candidate parsed JSON value to inspect.
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse a theme file and validate its metadata, workbench colors, and token sections.
 *
 * @param path - Path to the file, directory, or configuration value being processed.
 */
async function readTheme(path) {
  /** Parsed theme being checked for required sections and metadata. */
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

/**
 * Require a nonempty manifest asset path that resolves to a regular file.
 *
 * @param root - Repository or isolated project root directory.
 * @param path - Path to the file, directory, or configuration value being processed.
 */
async function requireFile(root, path) {
  if (typeof path !== "string" || !path) {
    throw new Error("Manifest theme and icon paths must be nonempty strings");
  }

  if (!(await stat(join(root, path))).isFile()) {
    throw new Error(`Expected a file: ${path}`);
  }
}

/**
 * Validate registered prod themes, development previews, snapshots, and manifest asset paths.
 *
 * @param [root] - Repository or isolated project root directory.
 * @returns Number of distinct theme paths validated.
 */
export async function checkThemes(root = fileURLToPath(new URL("../../", import.meta.url))) {
  /** Production extension manifest whose assets and theme entries are validated. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  /** Production theme registrations declared by the manifest. */
  const themes = manifest.contributes?.themes;

  if (!Array.isArray(themes) || !themes.length) {
    throw new Error("Manifest must contribute at least one theme");
  }

  await requireFile(root, manifest.icon);

  /** Distinct registered and development theme paths to validate. */
  const paths = new Set();

  /** Production picker labels already checked for uniqueness. */
  const labels = new Set();

  for (const theme of themes) {
    if (typeof theme.label !== "string" || !theme.label.trim() || labels.has(theme.label)) {
      throw new Error("Prod theme labels must be nonempty and unique");
    }

    labels.add(theme.label);
    await requireFile(root, theme.path);

    /** Normalized production theme path without a leading relative prefix. */
    const path = theme.path.replace(/^\.\//, "");

    if (!path.startsWith("themes/") || path.split("/").includes("..") || paths.has(path)) {
      throw new Error(`Invalid or duplicate prod theme path: ${theme.path}`);
    }

    /** Validated theme metadata used to check the manifest’s UI type. */
    const metadata = await readTheme(join(root, path));

    if (theme.uiTheme !== themeUiType(metadata, path)) {
      throw new Error(`${theme.path}: manifest uiTheme does not match theme type ${metadata.type}`);
    }

    paths.add(path);
  }

  for (const file of await listFiles(join(root, "themes"))) {
    if (file.endsWith(".json") && !paths.has(`themes/${file}`)) {
      throw new Error(`Unregistered prod theme: themes/${file}`);
    }
  }

  for (const directory of ["dev-extension/themes", "dev-extension/static-snapshots"]) {
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

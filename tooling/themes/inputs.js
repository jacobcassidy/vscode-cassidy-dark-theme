/**
 * Theme source inputs.
 * @file Discover theme targets, load default-backed inputs, and validate registration metadata.
 */

import { defaultThemeDirectory, paletteInputPath } from "../shared/paths.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseJsonc } from "../shared/jsonc.js";

/** Mapping from authored theme types to VS Code UI theme identifiers. */
const themeTypes = new Map([
  ["dark", "vs-dark"],
  ["light", "vs"],
  ["hc", "hc-black"],
  ["hcLight", "hc-light"],
]);

/**
 * Read a UTF-8 file, returning undefined only when the path does not exist.
 *
 * @param path - Path to the file, directory, or configuration value being processed.
 * @returns File contents, or undefined if the file does not exist.
 */
export async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * List immediate subdirectory names in sorted order, optionally tolerating an absent directory.
 *
 * @param path - Path to the file, directory, or configuration value being processed.
 * @param [optional] - Whether an absent directory should produce an empty result.
 * @returns Sorted subdirectory names.
 */
export async function listDirectories(path, optional = false) {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (optional && error.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * List immediate file names in sorted order, returning an empty list for an absent directory.
 *
 * @param path - Path to the file, directory, or configuration value being processed.
 * @returns Sorted file names.
 */
export async function listFiles(path) {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Validate a theme directory name shared by creation and discovery.
 * @param name - Lowercase theme name without its prod/dev group.
 */
export function validateThemeName(name) {
  if (typeof name !== "string" || !/^[a-z][a-z0-9.-]*$/.test(name) || name.includes("..") || name.endsWith(".")) {
    throw new Error(`Invalid theme name: ${name}`);
  }
}

/**
 * Discover prod and dev targets with unique names and deterministic output locations.
 *
 * @param root - Repository or isolated project root directory.
 * @returns Validated prod and dev targets in deterministic order.
 */
export async function discoverTargets(root) {
  /** Validated theme targets discovered across both source groups. */
  const targets = [];

  /** Theme names already used by a prod or dev target. */
  const names = new Set();

  for (const group of ["prod", "dev"]) {
    /** Source group directory searched for theme targets. */
    const directory = `src/themes/${group}`;

    for (const name of await listDirectories(join(root, directory), group === "dev")) {
      validateThemeName(name);

      if (names.has(name)) {
        throw new Error(`Duplicate theme name ${name}: prod and dev theme names must be globally unique`);
      }

      names.add(name);
      targets.push({
        group,
        name,
        directory: `${directory}/${name}`,
        reportDirectory: `${directory}/${name}/palette/generated`,
        output: `${group === "prod" ? "themes" : "preview/themes"}/cassidy-dark-color-theme${group === "prod" && name === "default" ? "" : `-${name}`}.json`,
      });
    }
  }

  if (!targets.some((target) => target.group === "prod" && target.name === "default")) {
    throw new Error(`Missing required default theme: ${defaultThemeDirectory}`);
  }

  return targets;
}

/**
 * Load a target input, allowing whole-file default fallback only for non-palette inputs.
 *
 * @param root - Repository or isolated project root directory.
 * @param target - Discovered theme target and its source/output locations.
 * @param relative - Path relative to the theme source or fixture root.
 * @param [overrides] - Prepared source candidates, keyed by repository-relative path.
 * @returns Parsed input with source, diagnostic label, path, and fallback status.
 */
export async function readTargetInput(root, target, relative, overrides = new Map()) {
  /** Requested input path within the target’s own source tree. */
  const ownPath = `${target.directory}/${relative}`;

  /** Target-local source text, when that input exists. */
  const own = overrides.has(ownPath) ? overrides.get(ownPath) : await readOptional(join(root, ownPath));

  /** Effective input path after selecting the whole-file fallback. */
  const path = own === undefined && relative !== paletteInputPath ? `${defaultThemeDirectory}/${relative}` : ownPath;

  /** Effective source text from the target or required default input. */
  const source = own ?? (overrides.has(path) ? overrides.get(path) : await readOptional(join(root, path)));

  /** Whether this input was loaded from the default theme. */
  const fallback = path !== ownPath;

  /** Target and input path context included in validation errors. */
  const label = `${target.group}/${target.name}: ${path}${fallback ? " (default fallback)" : ""}`;
  if (source === undefined) throw new Error(`${label}: missing required theme input`);

  /** Parsed input value and its source syntax tree. */
  const parsed = parseJsonc(source, label);
  return { ...parsed, source, path, label, fallback };
}

/**
 * Validate theme names and type and return the corresponding VS Code UI type.
 *
 * @param metadata - Theme display metadata, including its name, optional previewName, and type.
 * @param label - Human-readable context included in validation diagnostics.
 * @returns The VS Code uiTheme value corresponding to the declared type.
 */
export function themeUiType(metadata, label) {
  if (typeof metadata.name !== "string" || !metadata.name.trim()) {
    throw new Error(`${label}: theme name must be a nonempty string`);
  }

  if (
    Object.hasOwn(metadata, "previewName") &&
    (typeof metadata.previewName !== "string" || !metadata.previewName.trim())
  ) {
    throw new Error(`${label}: previewName must be a nonempty string`);
  }

  if (!themeTypes.has(metadata.type)) {
    throw new Error(`${label}: theme type must be dark, light, hc, or hcLight`);
  }

  return themeTypes.get(metadata.type);
}

/**
 * Create a production theme registration with a display label, UI type, and output path.
 *
 * @param target - Discovered theme target and its source/output locations.
 * @param metadata - Theme display metadata, including its name and type.
 * @returns Manifest contribution for the generated production theme.
 */
export function prodThemeContribution(target, metadata) {
  /** Human-readable suffix derived from the production target name. */
  const name = target.name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  /** Display label exposed in the production theme picker. */
  const label = target.name === "default" ? metadata.name : `${metadata.name} (${name})`;

  return { label, uiTheme: themeUiType(metadata, target.directory), path: `./${target.output}` };
}

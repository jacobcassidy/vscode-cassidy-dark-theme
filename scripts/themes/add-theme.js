/**
 * Minimal theme setup.
 * @file Create a default-backed theme with complete UI and semantic property placeholders.
 */

import { lstat, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import {
  discoverTargets,
  paletteInputPath,
  readTargetInput,
  themeInputPaths,
  validateThemeName,
} from "../lib/theme-source-inputs.js";
import { addThemeProperties, readPropertyReference } from "./add-properties.js";

/** Repository root inferred from this module's location. */
const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Create only the inputs needed for a new theme, then populate its reference properties.
 * @param options - New theme identifier and optional repository location.
 * @param options.theme - Exact prod/name or dev/name identifier.
 * @param [options.root] - Repository or isolated fixture root.
 * @returns Theme identifier, created file paths, property summaries, and the next build command.
 * @throws When the identifier or inputs are invalid, the name exists, or setup cannot complete.
 */
export async function addTheme({ root = defaultRoot, theme } = {}) {
  if (typeof theme !== "string" || !/^(prod|dev)\/[^/]+$/.test(theme)) {
    throw new Error("Usage: npm run add:theme -- <prod/name|dev/name>");
  }

  /** Requested source group and globally unique directory name. */
  const [group, name] = theme.split("/");

  validateThemeName(name);

  /** Existing targets checked before creating any directories. */
  const targets = await discoverTargets(root);

  if (targets.some((target) => target.name === name)) {
    throw new Error(`Theme name already exists: ${name}`);
  }

  /** Relative destination used in logs and the returned file list. */
  const directory = `src/themes/${theme}`;

  /** Absolute destination reserved exclusively for this new theme. */
  const destination = join(root, directory);

  try {
    await lstat(destination);

    throw new Error(`Theme destination already exists: ${directory}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  /** Required default target supplying all omitted inputs. */
  const baseline = targets.find((target) => target.group === "prod" && target.name === "default");

  for (const path of [paletteInputPath, ...themeInputPaths]) {
    await readTargetInput(root, baseline, path);
  }

  await readPropertyReference(root);

  /** Minimal local sources; empty details prevent incompatible documentation fallback. */
  const sources = new Map([
    [paletteInputPath, { useDefaultPalette: true }],
    ["tokens/ui.jsonc", {}],
    ["tokens/semantic.jsonc", {}],
    ["details/ui.jsonc", {}],
    ["details/semantic.jsonc", {}],
  ]);

  /** Formatted source files prepared before the destination is reserved. */
  const files = new Map();

  for (const [path, value] of sources) {
    /** Absolute file path used to resolve repository formatting settings. */
    const filepath = join(destination, path);

    /** Formatting configuration for this authored source. */
    const options = await prettier.resolveConfig(filepath);

    files.set(path, await prettier.format(JSON.stringify(value), { ...options, filepath, parser: "jsonc" }));
  }

  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination);

  try {
    for (const [path, source] of files) {
      await mkdir(dirname(join(destination, path)), { recursive: true });
      await writeFile(join(destination, path), source, { flag: "wx" });
    }

    /** Only the new theme is populated; other targets and the allowlist remain untouched. */
    const updates = await addThemeProperties({ root, themes: [theme] });

    return {
      theme,
      files: [...files.keys()].map((path) => `${directory}/${path}`),
      updates,
      command: `npm run build:${group}`,
    };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });

    throw error;
  }
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: npm run add:theme -- <prod/name|dev/name>");

    /** Created theme files and property counts reported to the command-line caller. */
    const result = await addTheme({ theme: process.argv[2] });

    console.log(`Created ${result.theme}:`);

    for (const path of result.files) console.log(`  ${path}`);

    for (const update of result.updates) console.log(`${update.section}: added ${update.added.length} properties`);

    console.log(`Build with ${result.command}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

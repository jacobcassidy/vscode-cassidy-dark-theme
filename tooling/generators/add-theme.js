/**
 * Theme scaffolding.
 * @file Prepare minimal independently inherited theme inputs and apply validated source candidates under the checkout guard.
 */

import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { applyEdits, modify } from "jsonc-parser";
import { repositoryRoot, paletteInputPath, familyPath } from "../shared/paths.js";
import { applyArtifacts, withGuards } from "../shared/transactions.js";
import { discoverTargets, readTargetInput, validateThemeName, themeUiType } from "../themes/inputs.js";
import { emptyFamily } from "./source-edits.js";
import { prepareProperties } from "./add-properties.js";
import { formatSource } from "../shared/formatting.js";

/**
 * Create a single prod/dev theme without modifying existing themes or the default allowlist.
 * @param [options] - Theme creation options.
 * @param [options.root] - Checkout or isolated root.
 * @param options.theme - Explicit prod/name or dev/name.
 * @param [options.operations] - Narrow filesystem adapter for controlled application-failure tests.
 */
export async function addTheme({ root = repositoryRoot, theme, operations } = {}) {
  if (typeof theme !== "string" || !/^(?:prod|dev)\/[^/]+$/.test(theme))
    throw new Error("Theme must be prod/name or dev/name");

  /** Requested group/name and final source directory. */
  const [group, name] = theme.split("/"),
    directory = `src/themes/${theme}`;

  validateThemeName(name);

  /** All names remain globally unique across both groups. */
  const targets = await discoverTargets(root);

  if (targets.some((target) => target.name === name)) throw new Error(`Theme name already exists: ${name}`);

  try {
    await lstat(join(root, directory));
    throw new Error(`Theme destination already exists: ${directory}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  /** Default metadata is copied through source edits, preserving comments and unrelated fields. */
  const baseline = targets.find((target) => target.group === "prod" && target.name === "default");

  /** Default metadata source retained with its comments and unrelated fields. */
  const metadata = await readTargetInput(root, baseline, "metadata.jsonc");

  /** Target-derived human-readable suffix for named previews. */
  const previewName = name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  themeUiType(metadata.value, metadata.label);

  /** Six minimal authored files; omitted syntax/variables retain independent fallback. */
  const files = new Map([
    [paletteInputPath, JSON.stringify({ useDefaultPalette: true })],
    [
      "metadata.jsonc",
      applyEdits(
        metadata.source,
        modify(metadata.source, ["previewName"], previewName, {
          /**
           * Choose an insertion position while retaining existing property order.
           * @param properties - Existing property names in their authored order.
           */
          getInsertionIndex: (properties) => properties.indexOf("name") + 1,
        }),
      ),
    ],
    ...["ui", "semantic"].flatMap((family) =>
      ["definitions", "details"].map((kind) => [familyPath(family, kind), JSON.stringify(emptyFamily(family, kind))]),
    ),
  ]);

  /** Prepared source candidates keyed by final repository-relative filenames. */
  const overrides = new Map();

  for (const [relative, source] of files) {
    overrides.set(`${directory}/${relative}`, await formatSource(root, `${directory}/${relative}`, source));
  }

  /** New target participates in the normal candidate validation before it exists on disk. */
  const target = {
    group,
    name,
    directory,
    reportDirectory: `${directory}/palette/generated`,
    output: `${group === "prod" ? "themes" : "preview/themes"}/cassidy-dark-color-theme-${name}.json`,
  };

  /** Fully validated preparation retained for checking or coordinated application. */
  const prepared = await prepareProperties({ root, themes: [theme], overrides, additionalTargets: [target] });

  await withGuards([root], async ([owner]) =>
    applyArtifacts({
      root,
      ...prepared,
      owner,
      operations,
      operation: "add-theme",
      recovery: "npm run create -- --recover=verify-restored",
    }),
  );

  return {
    theme,
    files: [...files.keys()].map((path) => `${directory}/${path}`),
    updates: prepared.updates,
    command: `npm run build:${group}`,
  };
}

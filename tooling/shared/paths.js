/**
 * Repository paths.
 * @file Define injectable checkout paths and independently inherited family filenames in one place.
 */

import { fileURLToPath } from "node:url";

/** Default checkout root; all workflows accept an explicit isolated root. */
export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Required whole-file fallback source. */
export const defaultThemeDirectory = "src/themes/prod/default";

/** Explicit per-target palette selection. */
export const paletteInputPath = "palette/config.jsonc";

/** Authored families in compilation order. */
export const themeSections = ["variables", "ui", "semantic", "syntax"];

/** Independently inherited definitions/details and theme metadata. */
export const themeInputPaths = [
  "metadata.jsonc",
  ...themeSections.flatMap((family) => [familyPath(family, "definitions"), familyPath(family, "details")]),
];

/** Exact shared files consumed by normal builds and the watcher. */
export const tokenDataPaths = [
  "src/token-data/ui/definitions.jsonc",
  "src/token-data/ui/details.jsonc",
  "src/token-data/semantic/definitions.jsonc",
  "src/token-data/semantic/details.jsonc",
  "src/token-data/syntax/details.jsonc",
];

/**
 * Identify one independently inherited family file.
 * @param family - variables, ui, semantic, or syntax.
 * @param kind - definitions or details.
 */
export function familyPath(family, kind) {
  if (!themeSections.includes(family) || !["definitions", "details"].includes(kind))
    throw new Error(`Unknown family input: ${family}/${kind}`);

  return `tokens/${family}/${kind}.jsonc`;
}

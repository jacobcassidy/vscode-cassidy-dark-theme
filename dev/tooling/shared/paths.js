/**
 * Repository paths.
 * @file Define injectable checkout paths and independently inherited family filenames in one place.
 */

import { fileURLToPath } from "node:url";

/** Default checkout root; all workflows accept an explicit isolated root. */
export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

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

/** Shared token layer root containing verified upstream output. */
export const generatedTokenDirectory = "src/data/tokens/generated";

/** Optional authored token layer root. */
const manualTokenDirectory = "src/data/tokens/manual";

/** Family files consumed from each shared token layer. */
const tokenLayerFiles = [
  "ui/definitions.jsonc",
  "ui/details.jsonc",
  "semantic/definitions.jsonc",
  "semantic/details.jsonc",
  "syntax/details.jsonc",
];

/** Exact generated shared files required by normal builds and the watcher. */
export const tokenDataPaths = tokenLayerFiles.map((path) => `${generatedTokenDirectory}/${path}`);

/** Optional authored shared files observed by builds and the watcher. */
export const manualTokenPaths = tokenLayerFiles.map((path) => `${manualTokenDirectory}/${path}`);

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

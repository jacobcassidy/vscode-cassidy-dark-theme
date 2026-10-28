/**
 * Neutral bootstrap theme templates.
 * @file Prepare a small buildable default theme entirely in memory before shared-data generation.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultThemeDirectory } from "../../shared/paths.js";

/**
 * Prepare every required default theme input from package metadata.
 * @param root - Project root containing package.json.
 * @returns Complete source candidates keyed by repository-relative path.
 */
export async function starterTheme(root) {
  /** Project display name used for the default theme. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  /** Stable source prefix for every prepared template. */
  const prefix = `${defaultThemeDirectory}/`;

  /** Small categorized source files with matching documentation. */
  const sources = {
    "metadata.jsonc": { name: manifest.displayName || manifest.name, type: "dark", semanticHighlighting: true },
    "palette/config.jsonc": {
      chroma: { strength: 0.5, gamutFraction: 0.9 },
      families: { yellow: { hue: 90, lightness: 0.9, baseChroma: 0.075 }, blue: { hue: 255, lightness: 0.75 } },
      neutrals: { 900: 0.26, "000": 0.98, white: 1, black: 0 },
      overrides: {},
    },
    "tokens/variables/definitions.jsonc": {},
    "tokens/variables/details.jsonc": {},
    "tokens/ui/definitions.jsonc": {
      standard: {
        editor: {
          background: { color: "#242424", colorReason: "Neutral editor surface for the starter theme." },
          foreground: { color: "#E0E0E0", colorReason: "Readable text on the neutral editor surface." },
        },
      },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    },
    "tokens/ui/details.jsonc": {
      standard: {
        editor: { background: { description: "Editor background." }, foreground: { description: "Editor text." } },
      },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    },
    "tokens/semantic/definitions.jsonc": {
      standard: { variable: { color: "#D8CFA3", colorReason: "Neutral semantic variable accent." } },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    },
    "tokens/semantic/details.jsonc": {
      standard: { variable: { description: "Semantic variable symbols." } },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    },
    "tokens/syntax/definitions.jsonc": {
      standard: {
        rules: [
          {
            id: "comment",
            name: "Comments",
            scope: "comment",
            color: "#909090",
            colorReason: "Quiet comment text.",
            order: 0,
          },
        ],
      },
      sourceCode: { rules: [] },
      nonStandard: { rules: [] },
      deprecated: { rules: [] },
    },
    "tokens/syntax/details.jsonc": {
      standard: { comment: { description: "Comment text." } },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    },
  };

  if (typeof sources["metadata.jsonc"].name !== "string" || !sources["metadata.jsonc"].name.trim())
    throw new Error("package.json must provide a nonempty displayName or name for bootstrap");

  return new Map(
    Object.entries(sources).map(([path, value]) => [`${prefix}${path}`, `${JSON.stringify(value, null, 2)}\n`]),
  );
}

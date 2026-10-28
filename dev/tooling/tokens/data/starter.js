/**
 * Neutral bootstrap theme templates.
 * @file Prepare a complete standard-token default theme in memory from verified shared data.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultThemeDirectory } from "../../shared/paths.js";

/** Complete standard chromatic families and neutral tones used by the default palette. */
const standardPalette = {
  chroma: { strength: 0.5, gamutFraction: 0.9 },
  families: {
    blue: { hue: 255, lightness: 0.75 },
    cyan: { hue: 195, lightness: 0.85 },
    green: { hue: 135, lightness: 0.8 },
    orange: { hue: 60, lightness: 0.8 },
    pink: { hue: 0, lightness: 0.85 },
    purple: { hue: 315, lightness: 0.75 },
    red: { hue: 30, lightness: 0.75 },
    yellow: { hue: 90, lightness: 0.9 },
  },
  neutrals: {
    "000": 0.98,
    100: 0.9,
    150: 0.86,
    200: 0.82,
    300: 0.74,
    400: 0.66,
    450: 0.62,
    500: 0.58,
    600: 0.5,
    650: 0.46,
    675: 0.44,
    700: 0.42,
    750: 0.38,
    800: 0.34,
    825: 0.32,
    850: 0.3,
    875: 0.28,
    900: 0.26,
    925: 0.24,
    975: 0.2,
    1000: 0.18,
    black: 0,
    white: 1,
  },
  overrides: {},
};

/**
 * Insert one UI token under its dotted path without discarding parent records.
 * @param target - Nested category records.
 * @param id - Exact UI color ID.
 * @param value - Definition or detail fields.
 */
function insertUi(target, id, value) {
  /** Path segments before the final color property. */
  const parts = id.split(".");
  let node = target;

  for (const part of parts.slice(0, -1)) node = node[part] ??= {};

  /** A parent color may also own nested color IDs. */
  const key = parts.at(-1);
  node[key] = { ...(node[key] ?? {}), ...value };
}

/**
 * Select a neutral or restrained accent role for a standard workbench color.
 * @param id - Exact UI color ID.
 */
function uiColor(id) {
  if (id === "editor.background") return "palette.gray.900";
  if (id === "editor.foreground") return "palette.gray.100";
  if (/background|shadow|dropbackground/i.test(id)) return "palette.gray.800";
  if (/foreground|text|icon/i.test(id)) return "palette.gray.100";
  if (/border|separator|outline/i.test(id)) return "palette.gray.600";

  return "palette.blue.400";
}

/**
 * Complete a missing default theme from the effective verified standard inventory.
 * @param prepared - Initial in-memory theme candidates from starterTheme.
 * @param snapshot - Merged shared token definitions and details.
 * @returns Updated in-memory theme candidates.
 */
export function completeStarterTheme(prepared, snapshot) {
  /** Full workbench definitions and matching copied descriptions. */
  const uiDefinitions = { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} },
    uiDetails = { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} };

  for (const [id, record] of snapshot.definitions.ui.records) {
    if (record.category !== "standard") continue;

    insertUi(uiDefinitions.standard, id, {
      color: uiColor(id),
      colorReason: "Neutral bootstrap color; review this workbench role before publication.",
    });

    /** Exact verified description, with a visible marker for unresolved wording. */
    const description = snapshot.details.ui.records.get(id)?.value.description;

    insertUi(uiDetails.standard, id, {
      description: description ?? `UNREVIEWED: Describe workbench color ${id}.`,
    });
  }

  /** Complete standard semantic type and wildcard-modifier selectors. */
  const semanticDefinitions = { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} },
    semanticDetails = { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} };

  for (const [id, record] of snapshot.definitions.semantic.records) {
    if (record.category !== "standard") continue;

    semanticDefinitions.standard[id] = {
      color: "palette.yellow.400",
      colorReason: "Neutral bootstrap semantic accent; review this selector before publication.",
    };
    semanticDetails.standard[id] = {
      description:
        snapshot.details.semantic.records.get(id)?.value.description ?? `UNREVIEWED: Describe semantic selector ${id}.`,
    };
  }

  for (const [path, value] of [
    ["tokens/ui/definitions.jsonc", uiDefinitions],
    ["tokens/ui/details.jsonc", uiDetails],
    ["tokens/semantic/definitions.jsonc", semanticDefinitions],
    ["tokens/semantic/details.jsonc", semanticDetails],
  ])
    prepared.set(`${defaultThemeDirectory}/${path}`, `${JSON.stringify(value, null, 2)}\n`);

  return prepared;
}

/**
 * Prepare every required default theme input from package metadata.
 * @param root - Project root containing package.json.
 * @returns Complete source candidates keyed by repository-relative path.
 */
export async function starterTheme(root) {
  /** Project display name used for the default theme. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  /** Optional package author retained in generated theme metadata. */
  const author = typeof manifest.author === "string" ? manifest.author : manifest.author?.name;

  /** Stable source prefix for every prepared template. */
  const prefix = `${defaultThemeDirectory}/`;

  /** Initial theme inputs are completed from verified standard registrations later. */
  const sources = {
    "metadata.jsonc": {
      $schema: "vscode://schemas/color-theme",
      name: manifest.displayName || manifest.name,
      type: "dark",
      ...(typeof author === "string" && author.trim() ? { author } : {}),
      semanticHighlighting: true,
    },
    "palette/config.jsonc": standardPalette,
    "tokens/variables/definitions.jsonc": {},
    "tokens/variables/details.jsonc": {},
    "tokens/ui/definitions.jsonc": { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} },
    "tokens/ui/details.jsonc": { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} },
    "tokens/semantic/definitions.jsonc": { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} },
    "tokens/semantic/details.jsonc": { standard: {}, sourceCode: {}, nonStandard: {}, deprecated: {} },
    "tokens/syntax/definitions.jsonc": {
      standard: {
        rules: [
          {
            id: "comment",
            name: "Comments",
            scope: "comment",
            color: "palette.gray.400",
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

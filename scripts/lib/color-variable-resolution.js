/**
 * Color variable resolution.
 * @file Validate named color variables and resolve palette references, aliases, and alpha values.
 */

import { fields, object } from "./jsonc-validation.js";
import { normalizeHex, validateHex, withAlpha } from "./color-math.js";

/**
 * Validate usage notes and nonempty, unique inheritance and override references.
 *
 * @param details - Usage notes and inheritance/override reference metadata.
 * @param id - Dotted palette or color variable identifier.
 */
function validateDetails(details, id) {
  /** Variable metadata path included in validation diagnostics. */
  const label = `token ${id}.details`;

  fields(details, ["for", "inherits", "overrides"], label);

  if (!Object.keys(details).length) throw new Error(`${label}: omit empty details`);

  for (const [key, value] of Object.entries(details)) {
    if (key === "for") {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${label}.for: expected a nonempty string`);
    } else if (
      !Array.isArray(value) ||
      !value.length ||
      value.some((token) => typeof token !== "string" || !token.trim()) ||
      new Set(value).size !== value.length
    ) {
      throw new Error(`${label}.${key}: expected a nonempty array of unique token names`);
    }
  }
}

/**
 * Resolve nested color variables to hex values while rejecting unknown references and cycles.
 *
 * @param definitions - Nested named color variable definitions.
 * @param palette - Generated palette records keyed by primitive identifier.
 * @returns Resolved hex colors indexed by named variable identifier.
 */
export function resolveTokens(definitions, palette) {
  object(definitions, "tokens");

  /** Validated variable definitions indexed by dotted identifier. */
  const tokens = new Map();

  /** Cache of final hex values for already resolved variables. */
  const resolved = new Map();

  /**
   * Flatten nested variable groups into unique dotted identifiers and validate each definition.
   *
   * @param group - Nested color variable group or selected prod/dev build group.
   * @param [path] - Path to the file, directory, or configuration value being processed.
   */
  function collect(group, path = []) {
    object(group, `token group ${path.join(".") || "tokens"}`);

    for (const [key, value] of Object.entries(group)) {
      /** Group path extended with the current variable or subgroup key. */
      const parts = [...path, key];

      /** Dotted identifier used for uniqueness and reference checks. */
      const id = parts.join(".");

      if (!/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/i.test(key) || parts[0] === "palette" || id.startsWith("palette.")) {
        throw new Error(`invalid semantic token ID ${id}`);
      }

      object(value, `token ${id}`);

      if (["color", "alpha", "details", "reason"].some((field) => Object.hasOwn(value, field))) {
        fields(value, ["color", "alpha", "details", "reason"], `token ${id}`);

        if (parts.length < 2 || typeof value.color !== "string" || !value.color.trim()) {
          throw new Error(`token ${id}: color must be a hex color or token reference in a named group`);
        }

        if (tokens.has(id)) throw new Error(`duplicate semantic token ID ${id}`);

        if (Object.hasOwn(value, "details")) validateDetails(value.details, id);

        tokens.set(id, value);
      } else {
        collect(value, parts);
      }
    }
  }

  collect(definitions);

  /**
   * Resolve one variable recursively and cache its final color after applying alpha.
   *
   * @param id - Dotted palette or color variable identifier.
   * @param [chain] - Identifiers already visited while resolving the current reference.
   */
  function resolve(id, chain = []) {
    if (chain.includes(id)) throw new Error(`Token cycle: ${[...chain, id].join(" → ")}`);

    if (resolved.has(id)) return resolved.get(id);

    if (palette.has(id)) return palette.get(id).hex;

    if (!tokens.has(id)) throw new Error(`Unknown reference: ${[...chain, id].join(" → ")}`);

    /** Authored color reference, alpha, and notes for the current variable. */
    const definition = tokens.get(id);

    /** Resolved color before or after applying the variable’s alpha override. */
    let hex;

    if (!definition.color.startsWith("#")) {
      hex = resolve(definition.color, [...chain, id]);
    } else {
      validateHex(definition.color, id);

      if (typeof definition.reason !== "string" || !definition.reason.trim()) {
        throw new Error(`token ${id}: literal hex requires a reason`);
      }

      hex = normalizeHex(definition.color);
    }

    if (Object.hasOwn(definition, "alpha")) {
      hex = withAlpha(hex, definition.alpha);
    }

    resolved.set(id, hex);

    return hex;
  }

  for (const id of tokens.keys()) {
    resolve(id);
  }

  return resolved;
}

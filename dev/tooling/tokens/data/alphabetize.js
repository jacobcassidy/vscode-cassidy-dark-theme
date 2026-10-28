/**
 * Shared token data ordering.
 * @file Alphabetize shared definition/detail records while retaining file headers and meaningful array order.
 */

import { parseJsonc } from "../../shared/jsonc.js";

/** Shared category order used by every categorized token file. */
const categoryOrder = ["standard", "sourceCode", "nonStandard", "deprecated"];

/**
 * Recursively sort object keys with the fixed category order at the root.
 * @param value - Parsed JSON value.
 * @param root - Whether the value is the category root.
 * @returns Alphabetized JSON-compatible value.
 */
function sortValue(value, root = false) {
  if (Array.isArray(value)) return value;
  if (value === null || typeof value !== "object") return value;

  /** Ordered keys retain the documented category order only at the category root. */
  const keys = Object.keys(value).sort((left, right) => {
    if (root) {
      const leftIndex = categoryOrder.indexOf(left);
      const rightIndex = categoryOrder.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1)
        return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    }
    return left.localeCompare(right);
  });

  return Object.fromEntries(keys.map((key) => [key, sortValue(value[key])]));
}

/**
 * Alphabetize a shared definitions/details JSONC file.
 * @param source - Original JSONC text.
 * @param path - File path used in diagnostics.
 * @returns Header-preserving, deterministically ordered JSONC text.
 */
export function alphabetizeTokenData(source, path) {
  const parsed = parseJsonc(source, path);
  const header = source.slice(0, parsed.tree.offset);
  const value = sortValue(parsed.value, true);

  if (path.endsWith("definitions.jsonc")) {
    for (const category of categoryOrder) {
      if (Array.isArray(value[category])) value[category].sort((left, right) => left.localeCompare(right));
      else if (value[category] && typeof value[category] === "object") {
        for (const list of Object.values(value[category])) {
          if (Array.isArray(list) && list.every((item) => typeof item === "string"))
            list.sort((left, right) => left.localeCompare(right));
        }
      }
    }
  }

  return `${header}${JSON.stringify(value, null, 2)}\n`;
}

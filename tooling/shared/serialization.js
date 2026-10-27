/**
 * Stable JSON comparison.
 * @file Normalize object-key order while preserving array order and repeated occurrences.
 */

/**
 * Serialize JSON data deterministically for semantic comparison.
 * @param value - JSON-compatible data.
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;

  return JSON.stringify(value);
}

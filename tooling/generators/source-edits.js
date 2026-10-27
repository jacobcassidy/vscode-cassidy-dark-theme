/**
 * JSONC authoring edits.
 * @file Insert nested records with canonical paths while retaining existing source spans and comments.
 */

import { applyEdits, modify } from "jsonc-parser";
import { semanticPath, categories } from "../tokens/formats.js";

/**
 * Construct an explicit empty family file, preserving independent suppression semantics.
 * @param family - Token family.
 * @param kind - definitions or details.
 */
export function emptyFamily(family, kind) {
  return family === "variables"
    ? {}
    : Object.fromEntries(
        categories.map((category) => [category, family === "syntax" && kind === "definitions" ? { rules: [] } : {}]),
      );
}

/**
 * Locate a canonical UI/semantic/detail record under its accepted category.
 * @param family - Token family.
 * @param category - Accepted category.
 * @param id - Canonical ID, selector, or variable path.
 */
export function recordPath(family, category, id) {
  if (family === "variables") return [id];

  return [category, ...(family === "ui" ? id.split(".") : family === "semantic" ? semanticPath(id) : [id])];
}

/**
 * Edit one nested record without reserializing surrounding authored sources.
 * @param source - Original JSONC text.
 * @param path - Canonical syntax-tree path.
 * @param value - Replacement value.
 */
export function editSource(source, path, value) {
  return applyEdits(
    source,
    modify(source, path, value, {
      getInsertionIndex: (properties) => {
        /** First property sorting after this insertion, or the final position. */
        const index = properties.findIndex((property) => property > path.at(-1));

        return index === -1 ? properties.length : index;
      },
    }),
  );
}

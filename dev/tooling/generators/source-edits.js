/**
 * JSONC authoring edits.
 * @file Insert nested records with canonical paths while retaining existing source spans, child records, and comments.
 */

import { applyEdits, modify, findNodeAtLocation, getNodeValue } from "jsonc-parser";
import { parseJsonc } from "../shared/jsonc.js";
import { categories, detailFields } from "../tokens/formats.js";

/**
 * Construct an explicit empty family file, preserving independent suppression semantics.
 * @param family - Token family.
 * @param kind - definitions or details.
 * @param [shared] - Whether this is the shared inventory rather than a theme input.
 */
export function emptyFamily(family, kind, shared = false) {
  return family === "variables"
    ? {}
    : Object.fromEntries(
        categories.map((category) => [
          category,
          family === "syntax" && kind === "definitions"
            ? { rules: [] }
            : shared && kind === "definitions" && ["ui", "semantic"].includes(family)
              ? []
              : {},
        ]),
      );
}

/**
 * Locate a canonical UI/semantic/detail record under its accepted category.
 * @param family - Token family.
 * @param category - Accepted category.
 * @param id - Canonical ID, selector, or variable path.
 */
export function recordPath(family, category, id) {
  if (family === "variables") {
    /** Variable details retain their group root and dotted property suffix. */
    const [group, ...property] = id.split(".");

    return property.length ? [group, property.join(".")] : [group];
  }

  return [category, ...(family === "ui" ? id.split(".") : [id])];
}

/**
 * Edit one exact property, sorting newly created ancestors by their own segment names.
 * @param source - Original JSONC text.
 * @param path - Canonical syntax-tree path.
 * @param value - Replacement value, or undefined to remove an existing property.
 */
export function editSource(source, path, value) {
  /**
   * Apply one property edit without reserializing neighboring source spans.
   * @param location - Exact partial or complete JSON path.
   * @param content - New property value.
   */
  function edit(location, content) {
    source = applyEdits(
      source,
      modify(source, location, content, {
        /**
         * Place a new property before its first lexically later neighbor.
         * @param properties - Existing property names in authored order.
         */
        getInsertionIndex(properties) {
          /** Insertion point for this exact path segment. */
          const index = properties.findIndex((property) => property > location.at(-1));
          return index === -1 ? properties.length : index;
        },
      }),
    );
  }

  if (value !== undefined) {
    for (let length = 1; length < path.length; length++) {
      /** New ancestor gets its own ordering decision, independently of the final leaf key. */
      const ancestor = path.slice(0, length);
      if (!findNodeAtLocation(parseJsonc(source, "prepared source").tree, ancestor)) edit(ancestor, {});
    }
  }

  edit(path, value);

  return source;
}

/**
 * Refresh only documentation fields, preserving parent/child UI branches and existing interior comments.
 * @param source - Original categorized details source.
 * @param path - Exact canonical record location.
 * @param candidate - Prepared detail fields without nested child records.
 */
export function editDetailRecord(source, path, candidate) {
  /** Existing node may be both a documentation record and a branch. */
  const node = findNodeAtLocation(parseJsonc(source, "prepared details").tree, path);

  if (!node) return editSource(source, path, candidate);

  /** Current node retains unrelated children and source spans. */
  const existing = getNodeValue(node);

  for (const field of [...detailFields, "modified-desc", "scopeEvidence"]) {
    if (JSON.stringify(existing[field]) === JSON.stringify(candidate[field])) continue;

    if (
      existing[field] &&
      typeof existing[field] === "object" &&
      !Array.isArray(existing[field]) &&
      field !== "scopeEvidence"
    )
      throw new Error(`${path.join(".")}.${field}: reserved detail field/child-name collision`);

    source = editSource(source, [...path, field], candidate[field]);
  }

  return source;
}

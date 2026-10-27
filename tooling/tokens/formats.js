/**
 * Categorized token formats.
 * @file Normalize nested authoring inputs with canonical IDs, source locations, exact selectors, and global syntax order.
 */

import { findNodeAtLocation } from "jsonc-parser";
import { validateHex } from "../shared/color-math.js";
import { fields, object, parseJsonc } from "../shared/jsonc.js";

/** Accepted roots, in canonical serialization order. */
export const categories = ["standard", "sourceCode", "nonStandard", "deprecated"];

/** Styling descriptors accepted before family-specific compiler validation. */
const definitionFields = [
  "color",
  "alpha",
  "colorReason",
  "disabled",
  "disabledReason",
  "bold",
  "italic",
  "underline",
  "strikethrough",
];

/** Theme documentation fields; shared flags/evidence are admitted separately. */
export const detailFields = [
  "description",
  "descriptionAddedIn",
  "descriptionUpdatedIn",
  "descriptionBasedOn",
  "use",
  "inherits",
  "overrides",
  "globallyOverriddenBy",
];

/**
 * Require nonempty documentation or identity text.
 * @param value - Candidate text.
 * @param label - Diagnostic path.
 */
export function nonempty(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}: expected a nonempty string`);
}

/**
 * Encode a selector without splitting compound modifiers or language qualifiers.
 * @param id - Exact authored semantic selector.
 */
export function semanticPath(id) {
  /** Language qualifier and unsuffixed selector. */
  const [selector, language, extra] = id.split(":"),
    [type, ...modifiers] = selector.split(".");

  if (
    extra !== undefined ||
    !/^(?:\*|[a-z][\w-]*)$/i.test(type) ||
    modifiers.some((modifier) => !/^[a-z][\w-]*$/i.test(modifier)) ||
    (language !== undefined && !/^[a-z][\w+-]*$/i.test(language))
  )
    throw new Error(`Invalid semantic selector ${id}`);

  if (modifiers.join(".") === "default")
    throw new Error(`Semantic modifier "default" collides with the reserved unmodified selector: ${id}`);

  return [`${type}${language === undefined ? "" : `:${language}`}`, modifiers.join(".") || "default"];
}

/**
 * Reconstruct an exact semantic selector from nested type and suffix keys.
 * @param type - Type key, possibly language-qualified.
 * @param suffix - default or the exact modifier sequence.
 */
export function semanticId(type, suffix) {
  /** Type and optional language suffix. */
  const [name, language] = type.split(":"),
    id = `${name}${suffix === "default" ? "" : `.${suffix}`}${language === undefined ? "" : `:${language}`}`;

  if (JSON.stringify(semanticPath(id)) !== JSON.stringify([type, suffix]))
    throw new Error(`Invalid semantic path ${type}.${suffix}`);

  return id;
}

/**
 * Validate shared/theme detail metadata without interpreting styling relationships.
 * @param value - Detail record.
 * @param category - Accepted category, or undefined for variables.
 * @param label - Exact input location.
 * @param [options] - Shared-data and family context.
 * @param [options.shared] - Whether shared-only fields are permitted.
 * @param [options.family] - Record family.
 */
function validateDetail(value, category, label, { shared = false, family } = {}) {
  fields(
    value,
    [
      ...detailFields,
      ...(shared ? ["modified-desc"] : []),
      ...(shared && family === "syntax" ? ["scopeEvidence"] : []),
    ],
    label,
  );

  if (!Object.keys(value).length) throw new Error(`${label}: omit empty details`);

  if (family === "variables" && Object.hasOwn(value, "globallyOverriddenBy"))
    throw new Error(`${label}: internal variables cannot be globallyOverriddenBy`);

  if (Object.hasOwn(value, "description")) nonempty(value.description, `${label}.description`);

  if (Object.hasOwn(value, "modified-desc") && typeof value["modified-desc"] !== "boolean")
    throw new Error(`${label}.modified-desc must be a boolean`);

  if (value["modified-desc"] === true) nonempty(value.description, `${label}: protected description`);

  for (const key of ["descriptionAddedIn", "descriptionUpdatedIn", "descriptionBasedOn"]) {
    if (
      Object.hasOwn(value, key) &&
      (typeof value[key] !== "string" || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value[key]))
    )
      throw new Error(`${label}.${key}: expected a normalized stable release version`);
  }

  if (value.descriptionAddedIn && value.descriptionUpdatedIn) {
    /** Numeric version tuples compared by release component. */
    const added = value.descriptionAddedIn.split(".").map(Number),
      updated = value.descriptionUpdatedIn.split(".").map(Number);

    /** First unequal numeric release component, used to reject reversed history. */
    const difference = updated.map((part, index) => part - added[index]).find((part) => part !== 0);
    if (difference < 0) throw new Error(`${label}.descriptionUpdatedIn precedes descriptionAddedIn`);
  }

  if (Object.hasOwn(value, "use")) {
    if (category !== "nonStandard") throw new Error(`${label}.use is allowed only on nonStandard records`);
    nonempty(value.use, `${label}.use`);
  }

  for (const key of ["inherits", "overrides", "globallyOverriddenBy"]) {
    if (!Object.hasOwn(value, key)) continue;

    if (
      !Array.isArray(value[key]) ||
      !value[key].length ||
      value[key].some((item) => typeof item !== "string" || !item.trim()) ||
      new Set(value[key].map((item) => item.trim())).size !== value[key].length
    )
      throw new Error(`${label}.${key}: expected a nonempty array of unique token names`);
  }
}

/**
 * Remove redundant equal-version history in prepared candidates only.
 * @param record - Documentation candidate to copy.
 */
export function normalizeHistory(record) {
  /** Copy leaves without mutating checked-in input objects. */
  const result = { ...record };
  if (result.descriptionUpdatedIn === result.descriptionAddedIn) delete result.descriptionUpdatedIn;
  return result;
}

/**
 * Normalize a string/array scope list without changing expression text or occurrence order.
 * @param rule - Authored syntax rule.
 */
export function scopeList(rule) {
  return rule.scope === undefined ? [] : Array.isArray(rule.scope) ? rule.scope : [rule.scope];
}

/**
 * Decode one complete source file; retired flat/category formats are rejected.
 * @param input - Parsed JSONC input with source/tree/label, or supplied value/label.
 * @param family - ui, semantic, syntax, or variables.
 * @param kind - definitions or details.
 * @param [options] - Shared-data context.
 * @param [options.shared] - Whether shared-only documentation is permitted.
 */
export function decode(input, family, kind, { shared = false } = {}) {
  /** Normalized records, keyed by exact canonical IDs. */
  const records = new Map();

  /** Normalized compiler maps or globally ordered syntax rules. */
  const value = family === "syntax" && kind === "definitions" ? [] : Object.create(null);

  /** Line-start offsets support precise diagnostics without repeatedly scanning whole files. */
  const lineStarts = [0, ...[...(input.source ?? "").matchAll(/\n/g)].map((match) => match.index + 1)];

  /**
   * Produce an exact syntax-tree diagnostic location.
   * @param path - JSON property/index path.
   */
  function location(path) {
    /** Syntax node and binary-searched line containing its offset. */
    const node = input.tree && findNodeAtLocation(input.tree, path);

    if (!node || !input.source) return `${input.label ?? input.path ?? family}: ${path.join(".")}`;

    /** Search bounds over monotonically increasing line offsets. */
    let low = 0,
      high = lineStarts.length;

    while (low + 1 < high) {
      /** Midpoint either precedes or follows the requested source node. */
      const middle = Math.floor((low + high) / 2);

      if (lineStarts[middle] <= node.offset) low = middle;
      else high = middle;
    }

    return `${input.label ?? input.path ?? family}:${low + 1}:${node.offset - lineStarts[low] + 1}: ${path.join(".")}`;
  }

  /**
   * Register a normalized record and its originating category/path.
   * @param id - Canonical token ID.
   * @param record - Record value.
   * @param category - Accepted root category.
   * @param path - Syntax-tree path.
   */
  function register(id, record, category, path) {
    /** Exact origin used by cross-file diagnostics and source-preserving generators. */
    const label = location(path);

    if (records.has(id))
      throw new Error(`${label}: duplicate canonical ${family} ID "${id}"; first at ${records.get(id).label}`);

    if (kind === "details") validateDetail(record, category, label, { shared, family });

    if (shared && kind === "definitions") {
      fields(record, ["color", "colorReason", "use"], label);
      validateHex(record.color, `${label}.color`);
      nonempty(record.colorReason, `${label}.colorReason`);
    }

    if (kind === "definitions" && Object.hasOwn(record, "use")) {
      if (!shared || category !== "nonStandard" || !["ui", "semantic"].includes(family))
        throw new Error(`${label}.use is shared nonStandard generator documentation only`);

      nonempty(record.use, `${label}.use`);
    }

    records.set(id, { id, value: record, category, path, label, inputPath: input.path });

    if (!(family === "syntax" && kind === "definitions")) value[id] = record;
  }

  object(input.value, input.label ?? family);

  if (family === "variables") {
    if (kind === "definitions")
      fields(input.value, ["surface", "text", "diagnostic", "diff"], input.label ?? "variables");

    if (kind === "details") {
      for (const [id, record] of Object.entries(input.value)) register(id, record, undefined, [id]);
    } else {
      /**
       * Collect theme-owned nested roles without category wrappers.
       * @param node - Nested variable group.
       * @param path - Current variable path.
       */
      function variables(node, path) {
        object(node, location(path));
        if (Object.hasOwn(node, "color")) return register(path.join("."), node, undefined, path);
        for (const [key, child] of Object.entries(node)) variables(child, [...path, key]);
      }

      variables(input.value, []);
    }

    return { value: kind === "definitions" ? input.value : value, records, input };
  }

  fields(input.value, categories, input.label ?? family);

  for (const category of categories) {
    object(input.value[category], location([category]));

    if (family === "syntax" && kind === "definitions") {
      fields(input.value[category], ["rules"], location([category]));

      if (!Array.isArray(input.value[category].rules))
        throw new Error(`${location([category, "rules"])}: expected an array`);

      for (const [index, rule] of input.value[category].rules.entries()) {
        /** Rule path keeps exact source diagnostics while order spans all categories. */
        const path = [category, "rules", index];

        object(rule, location(path));
        fields(
          rule,
          [
            ...definitionFields.filter((field) => !["bold", "italic", "underline", "strikethrough"].includes(field)),
            "id",
            "name",
            "scope",
            "fontStyle",
            "background",
            "order",
          ],
          location(path),
        );

        if (!Number.isInteger(rule.order) || rule.order < 0)
          throw new Error(`${location(path)}: syntax order must be a nonnegative integer`);

        if (value.some((entry) => entry.order === rule.order))
          throw new Error(`${location(path)}: duplicate syntax order ${rule.order}`);

        /** Compiler styling excludes source-only order; origin remains in records. */
        const { order, ...definition } = rule;

        if (rule.id !== undefined) register(rule.id, definition, category, path);

        value.push({ definition, order });
      }
    } else if (family === "syntax") {
      for (const [id, record] of Object.entries(input.value[category])) register(id, record, category, [category, id]);
    } else if (family === "semantic") {
      for (const [type, suffixes] of Object.entries(input.value[category])) {
        object(suffixes, location([category, type]));

        for (const [suffix, record] of Object.entries(suffixes)) {
          object(record, location([category, type, suffix]));
          fields(
            record,
            kind === "definitions"
              ? [...definitionFields, ...(shared ? ["use"] : [])]
              : [...detailFields, ...(shared ? ["modified-desc"] : [])],
            location([category, type, suffix]),
          );

          register(semanticId(type, suffix), record, category, [category, type, suffix]);
        }
      }
    } else {
      /** Record vocabulary distinguishes nested UI children from authoring fields. */
      const allowed =
        kind === "definitions"
          ? [...definitionFields, ...(shared ? ["use"] : [])]
          : [...detailFields, ...(shared ? ["modified-desc"] : [])];

      /**
       * Collect parent records and continue into children rather than stopping at a descriptor.
       * @param node - UI branch or record.
       * @param path - UI segments below the category.
       */
      function walk(node, path) {
        object(node, location([category, ...path]));

        if (path.length && !Object.keys(node).length)
          throw new Error(
            `${location([category, ...path])}: enabled entry requires styling; empty child nodes are not records`,
          );

        /** Record fields are copied separately from child branches. */
        const record = Object.fromEntries(
          Object.entries(node).filter(
            ([key, child]) =>
              allowed.includes(key) && (child === null || typeof child !== "object" || Array.isArray(child)),
          ),
        );

        if (Object.keys(record).length) {
          if (!path.length) throw new Error(`${location([category])}: record fields belong on a token, not a category`);
          register(path.join("."), record, category, [category, ...path]);
        }

        for (const [key, child] of Object.entries(node)) {
          if (allowed.includes(key)) {
            if (child === null || typeof child !== "object" || Array.isArray(child)) continue;

            if (Object.keys(record).length)
              throw new Error(`${location([category, ...path, key])}: reserved record field/child-name collision`);
          }

          if (!/^[a-z][\w-]*$/i.test(key) || child === null || typeof child !== "object" || Array.isArray(child))
            throw new Error(`${location([category, ...path, key])}: unknown field or malformed UI child`);

          walk(child, [...path, key]);
        }
      }

      walk(input.value[category], []);
    }
  }

  if (family === "syntax" && kind === "definitions") {
    value.sort((left, right) => left.order - right.order);
    return { value: value.map((entry) => entry.definition), records, input };
  }

  return { value, records, input };
}

/**
 * Parse a standalone complete example through the same source contracts.
 * @param source - JSONC text.
 * @param path - File label.
 * @param family - Token family.
 * @param kind - definitions or details.
 * @param [options] - Shared-data context.
 */
export function parseFormat(source, path, family, kind, options) {
  return decode({ ...parseJsonc(source, path), source, path, label: path }, family, kind, options);
}

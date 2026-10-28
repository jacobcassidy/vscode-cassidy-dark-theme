/**
 * Theme section compilation.
 * @file Validate consolidated tokens and details, resolve aliases, and emit ordered JSONC with disabled entries.
 */

import { detailFields, nonempty } from "./formats.js";
import { fields, object } from "../shared/jsonc.js";
import { validateHex, withAlpha } from "../shared/color-math.js";

/** Fields accepted by every foreground or background color descriptor. */
const colorFields = ["color", "alpha", "colorReason"];

/** Source-only fields accepted by emitted token definitions. */
const disablingFields = ["disabled", "disabledReason"];

/** Semantic formatting flags supported by VS Code. */
const formattingFields = ["bold", "italic", "underline", "strikethrough"];

/**
 * Validate a retained or active color descriptor, including literal explanations and alpha.
 * @param definition - Color descriptor, potentially with additional already-validated token fields.
 * @param label - Diagnostic location.
 */
function validateColor(definition, label) {
  if (Object.hasOwn(definition, "colorReason")) nonempty(definition.colorReason, `${label}.colorReason`);

  if (!Object.hasOwn(definition, "color")) {
    if (Object.hasOwn(definition, "alpha")) throw new Error(`${label}.alpha requires a color`);
    return;
  }

  nonempty(definition.color, `${label}.color`);

  if (definition.color.startsWith("#")) {
    validateHex(definition.color, label);
    nonempty(definition.colorReason, `${label}: literal color requires colorReason`);
  }

  if (Object.hasOwn(definition, "alpha")) withAlpha("#000000", definition.alpha);
}

/**
 * Validate disabling independently from retained styling.
 * @param definition - UI, semantic, or syntax token definition.
 * @param label - Diagnostic location.
 */
function validateDisabling(definition, label) {
  if (Object.hasOwn(definition, "disabled") && typeof definition.disabled !== "boolean") {
    throw new Error(`${label}.disabled must be a boolean`);
  }

  if (definition.disabled || Object.hasOwn(definition, "disabledReason")) {
    nonempty(definition.disabledReason, `${label}.disabledReason`);
  }
}

/**
 * Validate details against the effective authored entries, independent of color references.
 * @param details - Details objects indexed by section and documentation key.
 * @param entries - Effective token definitions indexed by section and documentation key.
 * @param requireDetails - Whether every authored entry must have a purpose description.
 */
function validateDetails(details, entries, requireDetails) {
  fields(details, ["variables", "ui", "semantic", "syntax"], "details");

  for (const [section, definitions] of Object.entries(entries)) {
    object(details[section], `details.${section}`);

    if (requireDetails) {
      for (const key of definitions.keys()) {
        if (!Object.hasOwn(details[section], key)) {
          throw new Error(`details.${section}.${key}: missing property details; run npm run add:properties`);
        }

        nonempty(details[section][key]?.description, `details.${section}.${key}.description`);
      }
    }

    for (const [key, value] of Object.entries(details[section])) {
      /** Details location used for all structural and relationship diagnostics. */
      const label = `details.${section}.${key}`;

      if (!definitions.has(key)) throw new Error(`${label}: unknown authored entry`);

      fields(value, detailFields, label);

      if (!Object.keys(value).length) throw new Error(`${label}: omit empty details`);

      for (const [field, content] of Object.entries(value)) {
        if (
          ["description", "descriptionAddedIn", "descriptionUpdatedIn", "descriptionBasedOn", "use"].includes(field)
        ) {
          nonempty(content, `${label}.description`);
        } else if (
          !Array.isArray(content) ||
          !content.length ||
          content.some((name) => typeof name !== "string" || !name.trim()) ||
          new Set(content.map((name) => name.trim())).size !== content.length
        ) {
          throw new Error(`${label}.${field}: expected a nonempty array of unique token names`);
        }
      }

      if (Object.hasOwn(value, "globallyOverriddenBy")) {
        if (section === "variables") throw new Error(`${label}: internal variables cannot be globallyOverriddenBy`);

        if (definitions.get(key).disabled !== true) {
          throw new Error(`${label}: globallyOverriddenBy requires disabled: true and disabledReason`);
        }
      }
    }
  }
}

/**
 * Collect and resolve consolidated token sections before compiling active and disabled entries.
 * @param tokens - Complete internal variable, UI, semantic, and syntax sections.
 * @param details - Complete corresponding details sections.
 * @param palette - Generated palette records keyed by primitive identifier.
 * @param [requireDetails] - Require matching purpose details and IDs for every syntax rule in the default theme.
 * @returns Resolved aliases and ordered compiled entries for each emitted section.
 */
export function compileTokens(tokens, details, palette, requireDetails = false) {
  fields(tokens, ["variables", "ui", "semantic", "syntax"], "tokens");
  fields(tokens.variables, ["surface", "text", "diagnostic", "diff"], "tokens.variables");
  object(tokens.ui, "tokens.ui");
  object(tokens.semantic, "tokens.semantic");

  if (!Array.isArray(tokens.syntax)) throw new Error("tokens.syntax must contain a token color array");

  /** Definitions eligible for documentation, including entries without colors. */
  const entries = Object.fromEntries(["variables", "ui", "semantic", "syntax"].map((section) => [section, new Map()]));

  /** All named foreground definitions, collected before resolving any reference. */
  const aliases = new Map();

  /** Resolved colors cached across all sections and background descriptors. */
  const resolved = new Map();

  /**
   * Register an alias and reject ambiguous flattened paths or repeated syntax IDs.
   * @param section - Token section name.
   * @param key - Documentation key within the section.
   * @param definition - Validated color or token definition.
   */
  function register(section, key, definition) {
    /** Fully qualified color alias exposed by this definition. */
    const id = `${section}.${key}`;
    if (aliases.has(id)) throw new Error(`duplicate token ID ${id}`);
    aliases.set(id, definition);
    entries[section].set(key, definition);
  }

  /**
   * Walk nested internal variables and register their leaf descriptors.
   * @param group - Nested group or color descriptor.
   * @param path - Dotted variable path built so far.
   */
  function collectVariables(group, path) {
    object(group, `variables.${path}`);

    if (Object.keys(group).some((key) => [...colorFields, ...disablingFields].includes(key))) {
      fields(group, colorFields, `variables.${path}`);
      validateColor(group, `variables.${path}`);
      if (!Object.hasOwn(group, "color")) throw new Error(`variables.${path}: color is required`);
      register("variables", path, group);
      return;
    }

    for (const [key, value] of Object.entries(group)) {
      if (!/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/i.test(key)) throw new Error(`invalid variable ID ${key}`);
      collectVariables(value, path ? `${path}.${key}` : key);
    }
  }

  collectVariables(tokens.variables, "");

  for (const section of ["ui", "semantic"]) {
    for (const [key, definition] of Object.entries(tokens[section])) {
      /** Qualified entry location for validation diagnostics. */
      const label = `${section}.${key}`;

      if (
        !(
          section === "semantic"
            ? /^(?:\*|[a-z][\w-]*)(?:\.[a-z][\w-]*)*(?::[a-z][\w+-]*)?$/i
            : /^[a-z][\w-]*(?:\.[\w-]+)*$/i
        ).test(key)
      ) {
        throw new Error(`${label}: invalid ${section} key`);
      }

      fields(
        definition,
        [...colorFields, ...disablingFields, ...(section === "semantic" ? formattingFields : [])],
        label,
      );

      validateColor(definition, label);
      validateDisabling(definition, label);

      for (const flag of section === "semantic" ? formattingFields : []) {
        if (Object.hasOwn(definition, flag) && typeof definition[flag] !== "boolean") {
          throw new Error(`${label}.${flag} must be a boolean`);
        }
      }

      if (
        !definition.disabled &&
        !Object.hasOwn(definition, "color") &&
        !(section === "semantic" && formattingFields.some((flag) => Object.hasOwn(definition, flag)))
      ) {
        throw new Error(`${label}: enabled entry requires styling`);
      }

      register(section, key, definition);
    }
  }

  for (const [index, rule] of tokens.syntax.entries()) {
    /** Rule position retained in errors even when it has no documentation ID. */
    const label = `syntax[${index}]`;

    fields(rule, [...colorFields, ...disablingFields, "id", "name", "scope", "fontStyle", "background"], label);
    validateColor(rule, label);
    validateDisabling(rule, label);

    if (Object.hasOwn(rule, "name")) nonempty(rule.name, `${label}.name`);

    if (
      Object.hasOwn(rule, "scope") &&
      !(typeof rule.scope === "string" && rule.scope.trim()) &&
      !(Array.isArray(rule.scope) && rule.scope.every((scope) => typeof scope === "string" && scope.trim()))
    ) {
      throw new Error(`${label}.scope must be a string or array of nonempty strings`);
    }

    if (
      Object.hasOwn(rule, "fontStyle") &&
      (typeof rule.fontStyle !== "string" ||
        rule.fontStyle
          .split(/\s+/)
          .filter(Boolean)
          .some((flag) => !formattingFields.includes(flag)))
    ) {
      throw new Error(`${label}.fontStyle must contain supported formatting flags`);
    }

    if (Object.hasOwn(rule, "background")) {
      fields(rule.background, colorFields, `${label}.background`);
      validateColor(rule.background, `${label}.background`);
      if (!Object.hasOwn(rule.background, "color")) throw new Error(`${label}.background requires a color`);
    }

    if (Object.hasOwn(rule, "id")) {
      if (typeof rule.id !== "string" || !/^[a-z][a-z0-9.-]*$/i.test(rule.id)) {
        throw new Error(`${label}: invalid syntax ID`);
      }

      register("syntax", rule.id, rule);
    } else if (requireDetails) {
      throw new Error(`${label}: default syntax rules require an id for property details; run npm run add:properties`);
    }
  }

  validateDetails(details, entries, requireDetails);

  /**
   * Resolve a descriptor and replace, rather than multiply, inherited alpha.
   * @param definition - Validated descriptor containing a color.
   * @param chain - Reference chain used to explain unknown references and cycles.
   * @returns Resolved hex color, retaining literal spelling when no alpha is applied.
   */
  function color(definition, chain) {
    /** Literal or resolved referenced color before this descriptor’s opacity. */
    const hex = definition.color.startsWith("#") ? definition.color : resolve(definition.color, chain);
    return Object.hasOwn(definition, "alpha") ? withAlpha(hex, definition.alpha) : hex;
  }

  /**
   * Resolve one named color, rejecting cycles and aliases without configured colors.
   * @param id - Fully qualified token or palette alias.
   * @param [chain] - Aliases already traversed in this resolution.
   * @returns Resolved hex color.
   */
  function resolve(id, chain = []) {
    if (chain.includes(id)) throw new Error(`Token cycle: ${[...chain, id].join(" → ")}`);
    if (resolved.has(id)) return resolved.get(id);
    if (palette.has(id)) return palette.get(id).hex;
    if (!aliases.has(id)) throw new Error(`Unknown reference: ${[...chain, id].join(" → ")}`);
    if (!aliases.get(id).color) throw new Error(`${id}: referenced entry has no configured color`);

    /** Final alias color after resolving its complete reference chain. */
    const hex = color(aliases.get(id), [...chain, id]);
    resolved.set(id, hex);
    return hex;
  }

  for (const [id, definition] of aliases) {
    if (definition.color) resolve(id);
  }

  /** Ordered compiled output paired with its original disabling explanation. */
  const compiled = { colors: [], semanticTokenColors: [], tokenColors: [] };

  for (const [key, definition] of Object.entries(tokens.ui)) {
    compiled.colors.push({ key, value: definition.color ? resolve(`ui.${key}`) : null, definition });
  }

  for (const [key, definition] of Object.entries(tokens.semantic)) {
    /** Only VS Code color and formatting fields retained in the semantic style. */
    const style = {
      ...(definition.color ? { foreground: resolve(`semantic.${key}`) } : {}),
      ...Object.fromEntries(
        formattingFields.filter((flag) => Object.hasOwn(definition, flag)).map((flag) => [flag, definition[flag]]),
      ),
    };
    compiled.semanticTokenColors.push({ key, value: Object.keys(style).length ? style : null, definition });
  }

  for (const [index, definition] of tokens.syntax.entries()) {
    compiled.tokenColors.push({
      value: {
        ...(Object.hasOwn(definition, "name") ? { name: definition.name } : {}),
        ...(Object.hasOwn(definition, "scope") ? { scope: definition.scope } : {}),
        settings: {
          ...(definition.color ? { foreground: color(definition, [`syntax[${index}]`]) } : {}),
          ...(definition.background
            ? { background: color(definition.background, [`syntax[${index}].background`]) }
            : {}),
          ...(Object.hasOwn(definition, "fontStyle") ? { fontStyle: definition.fontStyle } : {}),
        },
      },
      definition,
    });
  }

  return { resolved, ...compiled };
}

/**
 * Render compiled sections with commas based only on active entries and deliberate disabled comments.
 * @param metadata - Validated theme metadata emitted before token sections.
 * @param compiled - Ordered entries returned by compileTokens.
 * @param [notice] - Rebuild command included in the generated-file notice.
 * @returns Ordered JSONC source, ready for repository formatting.
 */
export function renderTheme(metadata, compiled, notice = "npm run build:prod") {
  object(metadata, "metadata");

  /** Metadata properties retained in their authored order. */
  const properties = Object.entries(metadata).map(
    ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value, null, 2)}`,
  );

  for (const section of ["colors", "semanticTokenColors", "tokenColors"]) {
    if (Object.hasOwn(metadata, section))
      throw new Error(`metadata: theme section ${section} belongs in its section file`);

    /** Ordered compiled entries, including explicit disabled entries. */
    const entries = compiled[section];

    /** Final active position determines commas independently of disabled comments. */
    const lastActive = entries.findLastIndex((entry) => !entry.definition.disabled);

    /** JSONC lines accumulated for this section’s body. */
    const lines = entries.flatMap((entry, index) => {
      /** Compiled property or complete syntax rule with no source-only fields. */
      const source = `${section === "tokenColors" ? "" : `${JSON.stringify(entry.key)}: `}${JSON.stringify(entry.value, null, 2)}`;

      if (entry.definition.disabled) {
        return source
          .split("\n")
          .map(
            (line, lineIndex) =>
              `// ${line}${lineIndex === 0 ? ` // ${entry.definition.disabledReason.replace(/\s+/g, " ").trim()}` : ""}`,
          );
      }

      return `${source}${index === lastActive ? "" : ","}`.split("\n");
    });

    properties.push(
      `${JSON.stringify(section)}: ${section === "tokenColors" ? "[" : "{"}\n${lines.join("\n")}\n${section === "tokenColors" ? "]" : "}"}`,
    );
  }

  return `// Generated by ${notice}. Edit the corresponding inputs and rebuild.\n{\n${properties.join(",\n")}\n}\n`;
}

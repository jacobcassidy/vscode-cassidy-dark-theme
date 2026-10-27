/**
 * Missing theme properties.
 * @file Add missing UI and semantic tokens and complete matching documentation for the production default.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, createScanner, modify, SyntaxKind } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { object, parseJsonc } from "../shared/jsonc.js";
import { discoverTargets, readOptional, readTargetInput, themeSections } from "../themes/inputs.js";

/** Repository root inferred from this module's location. */
const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Edit this allowlist to include or exclude source themes from the command. */
const includedThemes = ["prod/default", "dev/test"];

/** Reference sections and their corresponding authored token sections. */
const sections = [
  ["colors", "ui"],
  ["semanticTokenColors", "semantic"],
];

/** Recognizable styling retained until an added entry has been reviewed. */
const placeholder = {
  color: "#0ff",
  colorReason: "UNREVIEWED: Added from a token template; choose an intentional color.",
};

/**
 * Insert missing keys while retaining comments attached to neighboring entries.
 * @param input - Parsed JSONC source, including its syntax tree and original text.
 * @param keys - Missing property names to insert in case-sensitive lexical order.
 * @param [values] - Values indexed by property name; defaults to unreviewed color placeholders.
 * @returns Updated JSONC text, ready for repository formatting.
 */
function insertProperties(input, keys, values) {
  /** Existing properties in their authored order. */
  const properties = input.tree.children ?? [];

  /** Missing keys grouped by the existing property they should precede. */
  const groups = new Map();

  for (const key of keys.sort()) {
    /** First existing property whose name sorts after the new key. */
    const next = properties.findIndex((property) => property.children[0].value > key);

    /** Insertion position, including the position after the last property. */
    const index = next === -1 ? properties.length : next;

    if (!groups.has(index)) groups.set(index, []);

    groups.get(index).push(key);
  }

  /** Nonoverlapping source edits applied together after locating all comment boundaries. */
  const edits = [];

  for (const [index, names] of groups) {
    /** Property preceding this group, when one exists. */
    const previous = properties[index - 1];

    /** Offset immediately after the previous value or the opening brace. */
    const start = previous ? previous.offset + previous.length : input.tree.offset + 1;

    /** Offset of the next property or the closing brace. */
    const end = properties[index]?.offset ?? input.tree.offset + input.tree.length - 1;

    /** Scanner used to retain commas and inline comments with the previous entry. */
    const scanner = createScanner(input.source);

    /** Whether the previous property already has a separating comma. */
    let comma = false;

    /** Insertion boundary before leading comments on the following entry. */
    let offset = start;

    /** Whether the insertion boundary already follows a line break. */
    let newline = false;

    if (previous) {
      scanner.setPosition(start);
      offset = end;

      while (scanner.getPosition() < end) {
        /** Next punctuation, whitespace, or comment token between existing properties. */
        const kind = scanner.scan();

        if (kind === SyntaxKind.CommaToken) comma = true;

        if (kind === SyntaxKind.LineBreakTrivia) {
          offset = scanner.getPosition();
          newline = true;

          break;
        }
      }
    }

    /** Serialized additions, without disturbing existing value text. */
    const entries = names
      .map((name) => `${JSON.stringify(name)}: ${JSON.stringify(values ? values[name] : placeholder)}`)
      .join(",\n");

    /** Text placed at the selected boundary, including its separator and line breaks. */
    let content = `${newline ? "" : "\n"}${entries}${index < properties.length ? "," : ""}\n`;

    if (previous && !comma) {
      if (offset === start) {
        content = `,${content}`;
      } else {
        edits.push({ offset: start, length: 0, content: "," });
      }
    }

    edits.push({ offset, length: 0, content });
  }

  return applyEdits(input.source, edits);
}

/**
 * Collect nested internal color descriptors under their flat documentation paths.
 * @param group - Variable group or leaf color descriptor.
 * @param [path] - Current dotted variable path.
 * @returns Variable documentation keys and their source descriptors.
 */
function variableEntries(group, path = "") {
  object(group, `variables.${path}`);

  if (Object.hasOwn(group, "color")) return [[path, group]];

  return Object.entries(group).flatMap(([key, value]) => variableEntries(value, path ? `${path}.${key}` : key));
}

/**
 * Give undocumented syntax rules persistent, unique IDs without changing rule order or scopes.
 * @param input - Parsed syntax array and its original JSONC text.
 * @returns Updated parsed input and newly assigned IDs.
 */
function identifySyntax(input) {
  if (!Array.isArray(input.value)) throw new Error(`${input.label}: expected a syntax array`);

  /** Existing IDs reserved before choosing names for unnamed rules. */
  const ids = new Set();

  for (const [index, rule] of input.value.entries()) {
    object(rule, `${input.label}[${index}]`);

    if (!Object.hasOwn(rule, "id")) continue;

    if (typeof rule.id !== "string" || !/^[a-z][a-z0-9.-]*$/i.test(rule.id) || ids.has(rule.id)) {
      throw new Error(`${input.label}[${index}]: invalid or duplicate syntax ID ${rule.id}`);
    }

    ids.add(rule.id);
  }

  /** Newly assigned IDs reported alongside the syntax source update. */
  const added = [];

  /** Comment-preserving source edits applied in rule order. */
  let source = input.source;

  for (const [index, rule] of input.value.entries()) {
    if (Object.hasOwn(rule, "id")) continue;

    /** Readable base ID derived from the rule name, with a stable numeric fallback. */
    const stem =
      typeof rule.name === "string"
        ? rule.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        : "";

    /** Valid identifier prefix, including names that begin with a digit. */
    const prefix = /^[a-z]/.test(stem) ? stem : `rule-${stem || index + 1}`;

    /** Unique ID selected without changing any existing alias. */
    let id = prefix;

    for (let suffix = 2; ids.has(id); suffix++) id = `${prefix}-${suffix}`;

    ids.add(id);
    added.push(id);
    source = applyEdits(source, modify(source, [index, "id"], id, {}));
  }

  return { input: { ...parseJsonc(source, input.label), source, label: input.label }, added };
}

/**
 * Prepare complete default documentation after all reference token additions are known.
 * @param root - Repository or isolated fixture root.
 * @param target - Production default source target.
 * @param updates - Prepared token and detail updates; no files have been written yet.
 */
async function addDefaultDetails(root, target, updates) {
  /** Offline descriptions reviewed against the pinned VS Code source snapshots. */
  const referencePath = "docs/lookups/token-details.jsonc";

  /** Optional catalog text; isolated fixtures and new custom IDs may have no reviewed descriptions. */
  const referenceSource = await readOptional(join(root, referencePath));

  /** Descriptions grouped by token section. */
  const reference = referenceSource === undefined ? {} : parseJsonc(referenceSource, referencePath).value;

  object(reference, referencePath);

  for (const section of themeSections) {
    /** Original or already prepared token section, including newly added placeholders. */
    let input = await readTargetInput(root, target, `tokens/${section}.jsonc`);

    /** Earlier update for the matching default token file, if it has additions. */
    const pending = updates.find((update) => update.path === `${target.directory}/tokens/${section}.jsonc`);

    if (pending?.source) {
      input = { ...parseJsonc(pending.source, input.label), source: pending.source, label: input.label };
    }

    if (section === "syntax") {
      /** Syntax input with documentation IDs assigned to every rule. */
      const identified = identifySyntax(input);

      input = identified.input;
      updates.push({
        theme: "prod/default",
        section,
        path: `${target.directory}/tokens/syntax.jsonc`,
        added: identified.added,
        source: identified.added.length ? input.source : undefined,
      });
    } else {
      object(input.value, input.label);
    }

    /** Flat property/descriptor pairs using the same keys as theme compilation. */
    const entries =
      section === "variables"
        ? variableEntries(input.value)
        : section === "syntax"
          ? input.value.map((rule) => [rule.id, rule])
          : Object.entries(input.value);

    /** Existing documentation, whose reviewed descriptions and relationships are retained. */
    const details = await readTargetInput(root, target, `details/${section}.jsonc`);

    object(details.value, details.label);

    /** New detail objects indexed by their exact documentation key. */
    const values = {};

    /** Insertions needed for completely missing entries. */
    const added = [];

    /** JSONC text also used to fill an existing entry that lacks a purpose description. */
    let source = details.source;

    if (Object.hasOwn(reference, section)) object(reference[section], `${referencePath}.${section}`);

    for (const [key, definition] of entries) {
      if (Object.hasOwn(reference[section] ?? {}, key)) {
        object(reference[section][key], `${referencePath}.${section}.${key}`);
      }

      /** Reviewed purpose, or an explicit review marker for a previously unknown property. */
      const description =
        reference[section]?.[key]?.for ??
        (section === "variables"
          ? `Shared ${key.split(".").join(" ")} color role.`
          : section === "syntax"
            ? `TextMate rule ${definition.name || key} targeting ${[definition.scope ?? []].flat().join(", ") || "no explicit scope selectors"}.`
            : `UNREVIEWED: Describe the purpose of ${section} property ${key}.`);

      if (typeof description !== "string" || !description.trim()) {
        throw new Error(`${referencePath}.${section}.${key}.for: expected a nonempty description`);
      }

      if (!Object.hasOwn(details.value, key)) {
        values[key] = { for: description };
        added.push(key);
      } else {
        object(details.value[key], `${details.label}.${key}`);

        if (typeof details.value[key].for !== "string" || !details.value[key].for.trim()) {
          source = applyEdits(source, modify(source, [key, "for"], description, {}));
          added.push(key);
        }
      }
    }

    /** Reparsed positions after any edits to existing detail objects. */
    const edited = { ...parseJsonc(source, details.label), source };

    updates.push({
      theme: "prod/default",
      section: `details/${section}`,
      path: `${target.directory}/details/${section}.jsonc`,
      added,
      source: added.length ? insertProperties(edited, Object.keys(values), values) : undefined,
    });
  }
}

/**
 * Read and validate the UI and semantic token templates used for property discovery.
 * @param root - Repository or isolated fixture root.
 * @returns Combined object containing validated colors and semanticTokenColors sections.
 */
export async function readPropertyReference(root) {
  /** UI token template path used for workbench property discovery. */
  const uiPath = "docs/templates/all-ui-tokens.json";

  /** Semantic token template path used for selector discovery. */
  const semanticPath = "docs/templates/all-semantic-tokens.json";

  /** Parsed UI token template, with duplicate-key validation. */
  const uiTemplate = parseJsonc(await readFile(join(root, uiPath), "utf8"), uiPath).value;

  /** Parsed semantic token template, with duplicate-key validation. */
  const semanticTemplate = parseJsonc(await readFile(join(root, semanticPath), "utf8"), semanticPath).value;

  object(uiTemplate, uiPath);
  object(uiTemplate.colors, `${uiPath}.colors`);
  object(semanticTemplate, semanticPath);
  object(semanticTemplate.semanticTokenColors, `${semanticPath}.semanticTokenColors`);

  return {
    colors: uiTemplate.colors,
    semanticTokenColors: semanticTemplate.semanticTokenColors,
  };
}

/**
 * Prepare every selected source update before writing any files.
 * @param [options] - Source root and explicit theme selection for this run.
 * @param [options.root] - Repository or isolated fixture root.
 * @param [options.themes] - Allowlisted group/name identifiers; defaults to includedThemes.
 * @returns Per-theme, per-section paths and added property names, including unchanged sections.
 */
export async function addThemeProperties({ root = defaultRoot, themes = includedThemes } = {}) {
  /** Discovered targets indexed by their exact group/name identifiers. */
  const targets = new Map((await discoverTargets(root)).map((target) => [`${target.group}/${target.name}`, target]));

  if (!Array.isArray(themes) || themes.some((theme) => !targets.has(theme))) {
    throw new Error("Included themes must be an array of known group/name IDs such as prod/default or dev/test");
  }

  /** Validated reference keys used by both source sections. */
  const reference = await readPropertyReference(root);

  /** Prepared updates, including summaries for sections that need no changes. */
  const updates = [];

  for (const theme of new Set(themes)) {
    for (const [referenceSection, section] of sections) {
      /** Selected source target; no writes are made through a fallback path. */
      const target = targets.get(theme);

      /** Effective source snapshot, read before any selected target is changed. */
      const input = await readTargetInput(root, target, `tokens/${section}.jsonc`);

      object(input.value, input.label);

      /** Reference keys absent from the effective source, including disabled definitions. */
      const added = Object.keys(reference[referenceSection])
        .filter((key) => !Object.hasOwn(input.value, key))
        .sort();

      /** Destination always within the selected theme's own source directory. */
      const path = `${target.directory}/tokens/${section}.jsonc`;

      /** Comment-preserving candidate, formatted after every input has been validated. */
      const source = added.length ? insertProperties(input, added) : undefined;

      updates.push({ theme, section, path, added, source });
    }
  }

  if (themes.includes("prod/default")) {
    await addDefaultDetails(root, targets.get("prod/default"), updates);
  }

  for (const update of updates) {
    if (!update.added.length) continue;

    /** Destination path used to resolve repository formatting for every prepared change. */
    const filepath = join(root, update.path);

    /** Formatting settings shared by token and documentation sources. */
    const options = await prettier.resolveConfig(filepath);

    update.source = await prettier.format(update.source, { ...options, filepath, parser: "jsonc" });
    parseJsonc(update.source, update.path);
  }

  for (const update of updates) {
    if (!update.added.length) continue;

    await mkdir(dirname(join(root, update.path)), { recursive: true });
    await writeFile(join(root, update.path), update.source);
  }

  return updates.map(({ theme, section, path, added }) => ({ theme, section, path, added }));
}

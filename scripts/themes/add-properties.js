/**
 * Missing theme properties.
 * @file Add unreviewed UI and semantic entries from the reference to explicitly included theme sources.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, createScanner, SyntaxKind } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { object, parseJsonc } from "../lib/jsonc-validation.js";
import { discoverTargets, readTargetInput } from "../lib/theme-source-inputs.js";

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
  colorReason: "UNREVIEWED: Added from all-theme-properties.json; choose an intentional color.",
};

/**
 * Insert missing keys while retaining comments attached to neighboring entries.
 * @param input - Parsed JSONC source, including its syntax tree and original text.
 * @param keys - Missing property names to insert in case-sensitive lexical order.
 * @returns Updated JSONC text, ready for repository formatting.
 */
function insertProperties(input, keys) {
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

    /** Serialized placeholder entries, without disturbing existing value text. */
    const entries = names.map((name) => `${JSON.stringify(name)}: ${JSON.stringify(placeholder)}`).join(",\n");

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

  /** Reference path shared by UI and semantic property discovery. */
  const referencePath = "docs/references/all-theme-properties.json";

  /** Comment-bearing reference, parsed with duplicate-key validation. */
  const reference = parseJsonc(await readFile(join(root, referencePath), "utf8"), referencePath).value;

  object(reference, referencePath);

  for (const [section] of sections) {
    object(reference[section], `${referencePath}.${section}`);
  }

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

      /** Formatted candidate, generated only when this section has additions. */
      let source;

      if (added.length) {
        /** Absolute path used to resolve the repository's formatter settings. */
        const filepath = join(root, path);

        /** Repository formatting configuration for the source destination. */
        const options = await prettier.resolveConfig(filepath);

        source = await prettier.format(insertProperties(input, added), { ...options, filepath, parser: "jsonc" });
        parseJsonc(source, path);
      }

      updates.push({ theme, section, path, added, source });
    }
  }

  for (const update of updates) {
    if (!update.added.length) continue;

    await mkdir(dirname(join(root, update.path)), { recursive: true });
    await writeFile(join(root, update.path), update.source);
  }

  return updates.map(({ theme, section, path, added }) => ({ theme, section, path, added }));
}

if (import.meta.main) {
  try {
    for (const update of await addThemeProperties()) {
      console.log(`${update.theme} ${update.section}: added ${update.added.length} properties (${update.path})`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

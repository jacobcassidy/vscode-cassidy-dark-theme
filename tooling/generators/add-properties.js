/**
 * Missing theme properties.
 * @file Prepare nested placeholders, scope-matched documentation, and required syntax IDs before guarded source application.
 */

import { join } from "node:path";
import { findNodeAtLocation, getNodeValue } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { parseJsonc } from "../shared/jsonc.js";
import { defaultThemeDirectory, familyPath, repositoryRoot, themeSections } from "../shared/paths.js";
import { applyArtifacts, capturePaths, withGuards } from "../shared/transactions.js";
import { discoverTargets, readTargetInput } from "../themes/inputs.js";
import { prepareBuild } from "../themes/build.js";
import { decode, normalizeHistory, scopeList } from "../tokens/formats.js";
import { loadTokenData } from "../tokens/data/load.js";
import { editSource, recordPath } from "./source-edits.js";

/** Default explicit authoring selection; edit this allowlist to change command defaults. */
const includedThemes = ["prod/default", "dev/test"];

/**
 * Format one authored JSONC candidate with local repository settings.
 * @param root - Checkout or fixture root.
 * @param path - Repository-relative source filename.
 * @param source - Prepared complete source.
 */
export async function formatSource(root, path, source) {
  /** Absolute formatter path and resolved local configuration. */
  const filepath = join(root, path),
    options = await prettier.resolveConfig(filepath);

  return prettier.format(source, { ...options, filepath, parser: "jsonc" });
}

/**
 * Read an existing detail leaf without losing authored fields or accepting malformed JSONC.
 * @param source - Complete details source.
 * @param path - Canonical nested record path.
 */
function detailAt(source, path) {
  /** Parsed candidate and exact leaf node. */
  const parsed = parseJsonc(source, "prepared details"),
    node = findNodeAtLocation(parsed.tree, path);

  return node ? getNodeValue(node) : undefined;
}

/**
 * Prepare complete nested property/detail candidates without creating theme files.
 * @param options - Candidate preparation options.
 * @param options.root - Checkout or isolated root.
 * @param options.themes - Explicit group/name selection.
 * @param [options.overrides] - Existing scaffold candidates.
 * @param [options.additionalTargets] - Not-yet-created scaffolds.
 * @param [options.snapshot] - Shared classification/documentation snapshot.
 */
export async function prepareProperties({ root, themes, overrides = new Map(), additionalTargets = [], snapshot }) {
  /** Selected targets, shared data, and source/destination fingerprints. */
  const targets = [...(await discoverTargets(root)), ...additionalTargets];
  const indexed = new Map(targets.map((target) => [`${target.group}/${target.name}`, target]));
  const expected = await capturePaths([join(root, "src"), join(root, "package.json")]);

  if (!Array.isArray(themes) || themes.some((theme) => !indexed.has(theme)))
    throw new Error("Included themes must be an array of known group/name IDs such as prod/default or dev/test");

  snapshot ??= await loadTokenData({ root });

  /** Reference scope coverage derives from the default file, never another theme's same-named ID. */
  const reference = decode(
    await readTargetInput(root, indexed.get("prod/default"), familyPath("syntax", "definitions"), overrides),
    "syntax",
    "definitions",
  );

  snapshot.referenceScopes = new Map([...reference.records].map(([id, record]) => [id, scopeList(record.value)]));

  /** Complete source candidates and user-facing change summaries. */
  const output = new Map(overrides),
    updates = [];

  for (const theme of new Set(themes)) {
    /** Current independently inherited target files. */
    const target = indexed.get(theme);

    for (const family of themeSections) {
      /** Definitions are normalized before any source edits or documentation generation. */
      let input = await readTargetInput(root, target, familyPath(family, "definitions"), output);
      let source = input.source;
      let decoded = decode(input, family, "definitions");

      /** Canonical IDs newly added to this family. */
      const added = [];

      if (["ui", "semantic"].includes(family)) {
        for (const [id, record] of snapshot.definitions[family].records) {
          if (decoded.records.has(id)) continue;

          /** Shared placeholders contain documentation-only usage that never becomes styling. */
          const style = {
            color: "#0ff",
            colorReason: "UNREVIEWED: Added from a token template; choose an intentional color.",
          };

          source = editSource(source, recordPath(family, record.category, id), style);
          added.push(id);
        }
      } else if (family === "syntax" && target.directory === defaultThemeDirectory) {
        /** Existing IDs remain stable while unnamed default rules receive unique readable IDs. */
        const ids = new Set(decoded.records.keys());

        for (const [category, container] of Object.entries(input.value)) {
          for (const [index, rule] of container.rules.entries()) {
            if (rule.id !== undefined) continue;

            /** Human-readable ID stem, with a valid fallback for punctuation/numeric names. */
            const stem = (rule.name ?? "")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            const prefix = /^[a-z]/.test(stem) ? stem : `rule-${stem || rule.order + 1}`;

            /** Collision-free ID without changing scope/order/style. */
            let id = prefix;

            for (let suffix = 2; ids.has(id); suffix++) id = `${prefix}-${suffix}`;

            ids.add(id);
            added.push(id);
            source = editSource(source, [category, "rules", index, "id"], id);
          }
        }
      }

      /** Local source destination; fallback files remain omitted when no edits are needed. */
      const definitionPath = `${target.directory}/${familyPath(family, "definitions")}`;

      if (source !== input.source) {
        source = await formatSource(root, definitionPath, source);
        output.set(definitionPath, source);
        input = { ...input, ...parseJsonc(source, definitionPath), source, path: definitionPath };
        decoded = decode(input, family, "definitions");
      }

      updates.push({ theme, section: family, path: definitionPath, added: added.sort() });

      /** Independently inherited documentation source, preserved with syntax-tree edits. */
      const details = await readTargetInput(root, target, familyPath(family, "details"), output);
      const detailPath = `${target.directory}/${familyPath(family, "details")}`;
      const completed = [];

      source = details.source;

      for (const [id, record] of decoded.records) {
        /** Exact nested target record and any reusable shared documentation. */
        const path = recordPath(family, record.category, id);
        const existing = detailAt(source, path);
        const shared = snapshot.details[family]?.records.get(id)?.value;
        const matching =
          family !== "syntax" ||
          JSON.stringify(scopeList(record.value)) === JSON.stringify(snapshot.referenceScopes.get(id));
        const reusable = matching ? shared : undefined;
        const definitionUse = snapshot.definitions[family]?.records.get(id)?.value.use;

        if (reusable?.use && definitionUse && reusable.use !== definitionUse)
          throw new Error(`${detailPath}: conflicting shared usage for ${family} token "${id}"`);

        /** Preserve authored wording/history/relationships; fill only missing purposes. */
        let candidate = existing ? { ...existing } : {};

        if (typeof candidate.description !== "string" || !candidate.description.trim()) {
          candidate = {
            ...candidate,
            ...(reusable
              ? Object.fromEntries(
                  Object.entries(reusable).filter(([key]) => !["modified-desc", "scopeEvidence"].includes(key)),
                )
              : {}),
            description:
              reusable?.description ??
              (family === "variables"
                ? `Shared ${id.split(".").join(" ")} color role.`
                : family === "syntax"
                  ? `TextMate rule ${record.value.name || id} targeting ${scopeList(record.value).join(", ") || "no explicit scope selectors"}.`
                  : `UNREVIEWED: Describe the purpose of ${family} property ${id}.`),
          };
        }

        if (!candidate.use && record.category === "nonStandard" && (reusable?.use || definitionUse))
          candidate.use = reusable?.use ?? definitionUse;

        candidate = normalizeHistory(candidate);

        if (JSON.stringify(candidate) !== JSON.stringify(existing)) {
          source = editSource(source, path, candidate);
          completed.push(id);
        }
      }

      if (source !== details.source) output.set(detailPath, await formatSource(root, detailPath, source));

      updates.push({ theme, section: `details/${family}`, path: detailPath, added: completed });
    }
  }

  // The normal workflow validates the full candidate generation before source application.
  await prepareBuild({ root, overrides: output, additionalTargets, snapshot });

  return { output, expected, updates };
}

/**
 * Add missing properties/details through one guarded, rollback-capable source transaction.
 * @param [options] - Authoring command options.
 * @param [options.root] - Checkout or isolated fixture root.
 * @param [options.themes] - Explicit selected group/name IDs.
 */
export async function addThemeProperties({ root = repositoryRoot, themes = includedThemes } = {}) {
  /** Completely validated source candidate generation. */
  const prepared = await prepareProperties({ root, themes });

  await withGuards([root], async ([owner]) =>
    applyArtifacts({ root, ...prepared, owner, recovery: "npm run add:properties -- --recover=verify-restored" }),
  );

  return prepared.updates;
}

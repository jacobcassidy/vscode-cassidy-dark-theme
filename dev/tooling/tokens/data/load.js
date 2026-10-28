/**
 * Local token data loading.
 * @file Load one checked-in classification snapshot without extraction, upstream configuration, parser, or network dependencies.
 */

import { canonicalJson } from "../../shared/serialization.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFormat, categories, nonempty, decode } from "../formats.js";
import { fields } from "../../shared/jsonc.js";
import { emptyFamily } from "../../generators/source-edits.js";
import { repositoryRoot, tokenDataPaths, manualTokenPaths } from "../../shared/paths.js";
import { requireStable, capturePaths, assertFresh } from "../../shared/transactions.js";

/**
 * Validate and index immutable exact-scope evidence across shared reference records.
 * @param details - Decoded shared syntax details.
 */
function scopeIndex(details) {
  /** Exact selectors indexed independently of reference IDs. */
  const index = new Map();

  for (const record of details.records.values()) {
    if (!Object.hasOwn(record.value, "scopeEvidence")) continue;

    fields(record.value.scopeEvidence, ["scopes"], `${record.label}.scopeEvidence`);

    if (!Array.isArray(record.value.scopeEvidence.scopes) || !record.value.scopeEvidence.scopes.length)
      throw new Error(`${record.label}.scopeEvidence.scopes must be a nonempty array`);

    for (const evidence of record.value.scopeEvidence.scopes) {
      fields(
        evidence,
        ["selector", "category", "inputId", "revision", "path", "extensionId", "providerId"],
        `${record.label}.scopeEvidence`,
      );

      for (const key of ["selector", "inputId", "revision", "path"])
        nonempty(evidence[key], `${record.label}.scopeEvidence.${key}`);

      if (!categories.includes(evidence.category))
        throw new Error(`${record.label}: invalid scope evidence category ${evidence.category}`);

      if (!/^(?:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/.test(evidence.revision))
        throw new Error(`${record.label}: scope evidence requires an immutable revision`);

      if (
        evidence.path.startsWith("/") ||
        evidence.path.includes("\\") ||
        evidence.path.split("/").some((part) => !part || [".", ".."].includes(part))
      )
        throw new Error(`${record.label}: invalid source-relative evidence path`);

      for (const key of ["extensionId", "providerId"]) {
        if (Object.hasOwn(evidence, key)) nonempty(evidence[key], `${record.label}.${key}`);
      }

      if (evidence.category === "nonStandard" && !evidence.extensionId && !evidence.providerId)
        throw new Error(`${record.label}: extension/provider-specific scope evidence requires a contributor identity`);

      /** Previously reviewed selector context, if any. */
      const previous = index.get(evidence.selector);

      if (
        previous &&
        canonicalJson([
          previous.evidence.category,
          previous.evidence.extensionId ?? null,
          previous.evidence.providerId ?? null,
        ]) !== canonicalJson([evidence.category, evidence.extensionId ?? null, evidence.providerId ?? null])
      )
        throw new Error(`Conflicting scope evidence for "${evidence.selector}": ${previous.label} and ${record.label}`);

      index.set(evidence.selector, {
        evidence,
        label: record.label,
        provenance: [...(previous?.provenance ?? []), evidence],
      });
    }
  }

  return index;
}

/**
 * Load generated and optional manual files once, then validate their effective authority.
 * @param [options] - Local loading options.
 * @param [options.root] - Checkout or isolated project root.
 * @param [options.recovery] - Explicit recovery-only loader bypass for interrupted state.
 * @param [options.overrides] - Prepared generated file sources for pre-application validation.
 */
export async function loadTokenData({ root = repositoryRoot, recovery = false, overrides = new Map() } = {}) {
  /** Stable boundary and fingerprints prevent a multi-file partial snapshot. */
  const generation = recovery ? undefined : await requireStable(root);

  /** Pre-application fingerprints used to reject stale inputs. */
  const expected = await capturePaths([...tokenDataPaths, ...manualTokenPaths].map((path) => join(root, path)));

  /** Independently decoded generated and authored layer inputs. */
  const generated = { definitions: {}, details: {} },
    manual = { definitions: {}, details: {} };

  for (const [index, path] of [...tokenDataPaths, ...manualTokenPaths].entries()) {
    /** Family and file role taken only from the centralized inventory. */
    const family = path.split("/").at(-2),
      kind = path.split("/").at(-1).replace(".jsonc", ""),
      layer = index < tokenDataPaths.length ? generated : manual;

    /** Optional manual files act as empty categorized inputs. */
    let source = overrides.get(path);

    if (source === undefined) {
      try {
        source = await readFile(join(root, path), "utf8");
      } catch (error) {
        if (layer === generated || error.code !== "ENOENT") throw error;
      }
    }

    /** Normalized records retain their layer-specific source origin. */
    const decoded =
      source === undefined
        ? decode({ value: emptyFamily(family, kind, true), path, label: path, missing: true }, family, kind, {
            shared: true,
          })
        : parseFormat(source, path, family, kind, { shared: true });

    (kind === "definitions" ? layer.definitions : layer.details)[family] = decoded;
  }

  /** Validated effective definitions and documentation, with manual field overrides. */
  const definitions = {},
    details = {};

  for (const family of ["ui", "semantic", "syntax"]) {
    for (const kind of family === "syntax" ? ["details"] : ["definitions", "details"]) {
      /** Generated and manual records for the same family and file role. */
      const base = generated[kind][family],
        authored = manual[kind][family],
        records = new Map(base.records);

      for (const [id, record] of authored.records) {
        /** A manual definition can add an ID but cannot change generated authority. */
        const previous = records.get(id);

        if (kind === "definitions" && previous)
          throw new Error(`${record.label}: duplicate ${family} definition ${id}; generated at ${previous.label}`);

        if (kind === "details" && previous && previous.category !== record.category)
          throw new Error(`${record.label}: ${family} detail ${id} conflicts with ${previous.label}`);

        if (
          kind === "details" &&
          previous &&
          ["source", "scopeEvidence"].some((field) => Object.hasOwn(record.value, field))
        )
          throw new Error(`${record.label}: generated source attribution and scope evidence cannot be replaced`);

        records.set(
          id,
          previous && kind === "details" ? { ...record, value: { ...previous.value, ...record.value } } : record,
        );
      }

      /** Effective decoded shape retains original records and generated input for diagnostics. */
      const effective = {
        input: base.input,
        records,
        value: Object.fromEntries([...records].map(([id, record]) => [id, record.value])),
      };

      (kind === "definitions" ? definitions : details)[family] = effective;
    }
  }

  for (const family of ["ui", "semantic"]) {
    for (const record of manual.definitions[family].records.values()) {
      if (record.category === "standard")
        throw new Error(`${record.label}: manual-only standard ${family} ID requires verified generated membership`);

      if (record.category === "nonStandard" && !manual.details[family].records.get(record.id)?.value.source)
        throw new Error(
          `${record.label}: manual nonStandard ${family} ID requires a matching detail with source attribution`,
        );

      if (
        ["sourceCode", "deprecated"].includes(record.category) &&
        !manual.details[family].records.get(record.id)?.value.classificationEvidence
      )
        throw new Error(
          `${record.label}: manual ${record.category} ${family} ID requires reviewed classificationEvidence in its detail`,
        );
    }
  }

  for (const family of ["ui", "semantic"]) {
    for (const [id, detail] of details[family].records) {
      /** Definition inventory controls supported membership; details cannot override it. */
      const definition = definitions[family].records.get(id);

      if (detail.category === "standard" && !definition)
        throw new Error(
          `${detail.label}: ${family} token "${id}" has no exact standard definition in ${definitions[family].input.path}`,
        );

      if (definition && definition.category !== detail.category)
        throw new Error(
          `${detail.label}: ${family} token "${id}" has conflicting category ${detail.category}; expected ${definition.category} from ${definition.label}`,
        );
    }
  }

  /** Scope-based evidence and normalized membership projection used by watcher invalidation. */
  const scopes = scopeIndex(details.syntax);

  /** Canonical membership/evidence projection used for watcher invalidation. */
  const projection = canonicalJson({
    definitions: Object.fromEntries(
      Object.entries(definitions).map(([family, data]) => [
        family,
        [...data.records].map(([id, record]) => [id, record.category]).sort(),
      ]),
    ),
    details: Object.fromEntries(
      Object.entries(details).map(([family, data]) => [
        family,
        [...data.records].map(([id, record]) => [id, record.category]).sort(),
      ]),
    ),
    scopes: [...scopes]
      .map(([selector, record]) => [
        selector,
        [...new Map(record.provenance.map((item) => [canonicalJson(item), item])).values()].sort((left, right) =>
          canonicalJson(left).localeCompare(canonicalJson(right)),
        ),
      ])
      .sort(),
    referenceEvidence: [...details.syntax.records]
      .filter(([, record]) => record.value.scopeEvidence)
      .map(([id, record]) => [id, record.value.scopeEvidence])
      .sort(),
  });

  await assertFresh(expected);

  if (!recovery && JSON.stringify(await requireStable(root)) !== JSON.stringify(generation))
    throw Object.assign(new Error("Stale token-data generation; retry with a stable snapshot."), {
      code: "STALE_INPUT",
    });

  return { definitions, details, generated, manual, scopes, projection, expected };
}

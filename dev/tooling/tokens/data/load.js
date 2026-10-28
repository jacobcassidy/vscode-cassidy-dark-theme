/**
 * Local token data loading.
 * @file Load one checked-in classification snapshot without extraction, upstream configuration, parser, or network dependencies.
 */

import { canonicalJson } from "../../shared/serialization.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFormat, categories, nonempty } from "../formats.js";
import { fields } from "../../shared/jsonc.js";
import { repositoryRoot, tokenDataPaths } from "../../shared/paths.js";
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
 * Load all five shared files once and validate accepted authorities before returning a snapshot.
 * @param [options] - Local loading options.
 * @param [options.root] - Checkout or isolated project root.
 * @param [options.recovery] - Explicit recovery-only loader bypass for interrupted state.
 */
export async function loadTokenData({ root = repositoryRoot, recovery = false } = {}) {
  /** Stable boundary and fingerprints prevent a multi-file partial snapshot. */
  const generation = recovery ? undefined : await requireStable(root);

  /** Pre-application fingerprints used to reject stale inputs. */
  const expected = await capturePaths(tokenDataPaths.map((path) => join(root, path)));

  /** Normalized definitions retained independently from matching documentation. */
  const definitions = {},
    details = {};

  for (const path of tokenDataPaths) {
    /** Family and file role taken only from the centralized inventory. */
    const [, , , family, filename] = path.split("/"),
      kind = filename.replace(".jsonc", "");

    /** Original or prepared source data retained for this operation. */
    const source = await readFile(join(root, path), "utf8");

    /** Normalized family records with canonical identities and source origins. */
    const decoded = parseFormat(source, path, family, kind, { shared: true });
    (kind === "definitions" ? definitions : details)[family] = decoded;
  }

  for (const family of ["ui", "semantic"]) {
    for (const [id, detail] of details[family].records) {
      /** Definition inventory controls supported membership; details cannot override it. */
      const definition = definitions[family].records.get(id);

      if (detail.category === "standard" && !definition)
        throw new Error(
          `${detail.label}: ${family} token "${id}" has no exact standard definition in ${definitions[family].input.path}`,
        );

      if (definition?.value.use && detail.value.use && definition.value.use !== detail.value.use)
        throw new Error(
          `${detail.label}: conflicting shared usage for ${family} token "${id}"; authority ${definition.label}`,
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

  return { definitions, details, scopes, projection, expected };
}

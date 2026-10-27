/**
 * Shared description refresh.
 * @file Prepare protected/versioned descriptions, reviewed coverage transitions, proposals, and all-or-rollback shared-data application.
 */

import { canonicalJson } from "../../shared/serialization.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { applyEdits, modify } from "jsonc-parser";
import { parseJsonc, fields } from "../../shared/jsonc.js";
import { repositoryRoot, familyPath } from "../../shared/paths.js";
import {
  applyArtifacts,
  assertFresh,
  capturePaths,
  observeWriter,
  verifyRestored,
  withGuards,
} from "../../shared/transactions.js";
import { discoverTargets, readTargetInput } from "../../themes/inputs.js";
import { decode, normalizeHistory, scopeList } from "../formats.js";
import { validateCategories } from "../category-validation.js";
import { loadTokenData } from "./load.js";
import {
  assertSourceFresh,
  createRetrieval,
  obtainSource,
  resolveLatest,
  validateSourceConfig,
  verifySource,
} from "./sources.js";
import { extractSource, semanticDescription } from "./extraction.js";
import { editSource, recordPath } from "../../generators/source-edits.js";
import { formatSource } from "../../generators/add-properties.js";

/**
 * Update description text history only for actual successful extraction.
 * @param previous - Existing shared detail record, or undefined.
 * @param extracted - Verified upstream description, or undefined when unresolved/local.
 * @param version - Stable version baseline for this successful invocation.
 */
export function refreshDescription(previous, extracted, version) {
  /** Existing authored metadata is preserved independently of extracted text. */
  const result = normalizeHistory(previous ?? {});

  if (!extracted || result["modified-desc"] === true) return result;

  if (!result.description) {
    result.description = extracted;
    result.descriptionAddedIn = version;
    result.descriptionBasedOn = version;
  } else if (result.description !== extracted) {
    result.description = extracted;
    result.descriptionUpdatedIn = version;
    result.descriptionBasedOn = version;
  } else if (!result.descriptionBasedOn) result.descriptionBasedOn = version;

  return normalizeHistory(result);
}

/**
 * Serialize coverage deterministically, independent of parser traversal order.
 * @param extracted - Per-input extraction result.
 */
function coverageRecord(extracted) {
  return {
    identity: extracted.identity,
    ...Object.fromEntries(
      ["ui", "types", "modifiers", "scopes"].map((family) => [family, [...extracted[family].keys()].sort()]),
    ),
  };
}

/**
 * Enforce required-source coverage and exact reviewed loss/empty transitions, including replay acceptance.
 * @param current - Current per-input coverage records.
 * @param previous - Last successful coverage records.
 * @param exceptions - Checked-in reviewed transition exceptions.
 * @param [accepted] - Historical accepted outcomes replayable only at their exact identity/coverage.
 */
export function validateCoverage(current, previous, exceptions, accepted = []) {
  /** Accepted outcomes are preserved only with their exact checked-in review evidence. */
  const outcomes = [...accepted];

  for (const outcome of accepted) {
    if (!exceptions.some((exception) => canonicalJson(exception) === canonicalJson(outcome.exception)))
      throw new Error(`Coverage acceptance evidence missing or changed: ${outcome.exception?.id}`);
  }

  for (const record of [
    ...current,
    ...previous
      .filter((old) => !current.some((item) => item.identity.id === old.identity.id))
      .map((old) => ({
        identity: { ...old.identity, revision: "removed" },
        ui: [],
        types: [],
        modifiers: [],
        scopes: [],
      })),
  ]) {
    /** Previous source-specific registrations protect against deduplication hiding parser regressions. */
    const old = previous.find((item) => item.identity.id === record.identity.id);
    const lost = Object.fromEntries(
      ["ui", "types", "modifiers", "scopes"].map((family) => [
        family,
        (old?.[family] ?? []).filter((id) => !record[family].includes(id)),
      ]),
    );
    const empty =
      record.identity.kind === "core"
        ? [
            !record.ui.length ? "ui" : undefined,
            !record.types.length && !record.modifiers.length ? "semantic" : undefined,
          ].filter(Boolean)
        : [];
    const replay = accepted.find((outcome) => canonicalJson(outcome.coverage) === canonicalJson(record));

    if (replay) {
      outcomes.push(replay);

      continue;
    }

    if (!empty.length && !Object.values(lost).some((ids) => ids.length)) continue;

    /** Exact transition exception cannot become a permanent source exemption. */
    const exception = exceptions.find(
      (candidate) =>
        candidate.inputId === record.identity.id &&
        candidate.from === (old?.identity.revision ?? null) &&
        candidate.to === record.identity.revision &&
        canonicalJson(candidate.lost) === canonicalJson(lost) &&
        JSON.stringify(candidate.allowEmpty) === JSON.stringify(empty),
    );

    if (!exception || !exception.id || !exception.reason?.trim() || !exception.evidence?.trim())
      throw new Error(
        `Extraction coverage regression for ${record.identity.id} ${old?.identity.revision ?? "first run"} -> ${record.identity.revision}: empty ${empty.join(", ") || "none"}; lost ${JSON.stringify(lost)}. Review an exact coverage exception before publication.`,
      );

    fields(
      exception,
      ["id", "inputId", "from", "to", "lost", "allowEmpty", "reason", "evidence"],
      "coverage exception",
    );
    outcomes.push({ exception, coverage: record });
  }

  return [...new Map(outcomes.map((outcome) => [JSON.stringify(outcome), outcome])).values()];
}

/**
 * Load and validate one consistent authored inventory for refresh/proposal purposes.
 * @param root - Checkout root.
 * @param snapshot - Checked-in classification snapshot.
 */
async function authoredInventory(root, snapshot) {
  /** Effective theme records retain theme-qualified syntax profiles. */
  const targets = await discoverTargets(root),
    themes = [];

  for (const target of targets) {
    /** Independently inherited files are decoded with their actual originating paths. */
    const families = { definitions: {}, details: {} };

    for (const family of ["variables", "ui", "semantic", "syntax"]) {
      for (const kind of ["definitions", "details"])
        families[kind][family] = decode(await readTargetInput(root, target, familyPath(family, kind)), family, kind);
    }

    if (target.group === "prod" && target.name === "default")
      snapshot.referenceScopes = new Map(
        [...families.definitions.syntax.records].map(([id, record]) => [id, scopeList(record.value)]),
      );

    validateCategories(families, snapshot, `${target.group}/${target.name}`);
    themes.push({ target, families });
  }

  return themes;
}

/**
 * Replace file-level processing provenance while retaining purpose/license comments and the updater footer.
 * @param source - Current shared detail JSONC.
 * @param resolution - Successfully verified stable/main input identities.
 * @param family - Shared detail family used for a missing purpose header.
 */
function refreshedHeader(source, resolution, family) {
  /** Only opening comments are eligible for provenance advancement. */
  const root = parseJsonc(source, "shared details").tree.offset;
  const original = source.slice(0, root);
  const purpose =
    original.match(/^\/\/ Shared.*$/m)?.[0] ??
    `// Shared ${family} token details: reusable documentation and accepted categories.`;
  const license = original.match(/\/\*[\s\S]*?\*\//)?.[0] ?? "";
  const stable = resolution.inputs.find((input) => input.id === "vscode-stable"),
    main = resolution.inputs.find((input) => input.id === "vscode-main");

  return `${purpose}\n// Upstream inputs last processed: VS Code ${resolution.version}\n// Stable commit: ${stable.revision}\n${main ? `// Supplemental main commit: ${main.revision}\n` : ""}${original.includes("// Local syntax input:") ? "// Local syntax input: default/reference authored rules; original scope order preserved.\n" : ""}${license}${license ? "\n" : ""}// Updater (run from the repository root): npm run update:token-details\n${source.slice(root)}`;
}

/**
 * Refresh shared descriptions or replay/check recorded sources; normal builds never import this module.
 * @param [options] - Explicit updater options.
 * @param [options.root] - Checkout or isolated fixture root.
 * @param [options.offline] - Forbid network and replay successful inputs.
 * @param [options.check] - Read-only exact replay and drift check.
 * @param [options.recover] - Fresh explicit recovery or verify-restored.
 * @param [options.vscodeSource] - Matching stable Git checkout.
 * @param [options.vscodeMainSource] - Matching supplemental-main checkout.
 * @param [options.extensionSources] - Verified extension/provider source directories.
 * @param [options.signal] - Invocation cancellation signal.
 * @param [options.services] - Injected retrieval/extraction/failure operations for deterministic tests.
 */
export async function updateTokenDetails({
  root = repositoryRoot,
  offline = false,
  check = false,
  recover = false,
  vscodeSource,
  vscodeMainSource,
  extensionSources = [],
  signal,
  services = {},
} = {}) {
  if (check && recover) throw new Error("--check cannot be combined with recovery");
  if (recover && ![true, "verify-restored"].includes(recover)) throw new Error("Unknown recovery mode");

  /** Source policy must remain untouched on all failed/check invocations. */
  const configPath = "src/token-data/upstream-sources.jsonc";

  if (recover === "verify-restored") {
    await verifyRestored(
      root,
      async () => {
        validateSourceConfig(parseJsonc(await readFile(join(root, configPath), "utf8"), configPath).value);
        await authoredInventory(root, await loadTokenData({ root, recovery: true }));
      },
      "token-details",
    );

    return { verifiedRestored: true, changed: [], proposals: [], warnings: [] };
  }

  /** Complete dependencies are captured before discovery/extraction, outside application guards. */
  const expected = await capturePaths([join(root, "src"), join(root, "package.json")]);
  const state = await observeWriter(root);

  if (state.busy)
    throw Object.assign(new Error("Writer busy; retry after the active writer finishes."), { code: "WRITER_BUSY" });
  const snapshot = await loadTokenData({ root, recovery: Boolean(recover) });
  const configSource = await readFile(join(root, configPath), "utf8");
  const config = validateSourceConfig(parseJsonc(configSource, configPath).value);
  const themes = await authoredInventory(root, snapshot);
  const replay = offline || check;
  const retrieval = createRetrieval({ policy: config.retrieval, signal, ...services.retrieval });

  if (replay && !config.lastSuccessful?.resolution)
    throw new Error("No successful recorded sources. Run an online npm run update:token-details first.");

  /** Online mode always discovers latest, regardless of existing cache entries. */
  const resolution = replay
    ? structuredClone(config.lastSuccessful.resolution)
    : await (services.resolveLatest ?? resolveLatest)(config, retrieval);
  const sources = [];

  for (const identity of resolution.inputs.filter((input) => input.kind === "core")) {
    sources.push(
      await (services.obtainSource ?? obtainSource)({
        root,
        identity,
        retrieval,
        replay,
        supplied: identity.id === "vscode-stable" ? vscodeSource : vscodeMainSource,
      }),
    );
  }

  for (const [index, directory] of extensionSources.entries()) {
    /** Replay requires a matching recorded identity; online runs verify the supplied contributor anew. */
    const recorded = replay
      ? resolution.inputs.find((input) => input.kind === "extension" && input.id === `extension-${index + 1}`)
      : undefined;

    if (replay && !recorded) throw new Error(`No recorded extension source identity for ${directory}`);

    sources.push(
      await verifySource(directory, recorded ?? { id: `extension-${index + 1}`, kind: "extension" }, retrieval),
    );
  }

  if (replay && sources.length !== resolution.inputs.length)
    throw new Error("Replay requires every recorded extension source; supply --extension-source in its original order");

  resolution.inputs = sources.map((source) => source.identity);

  /** Per-input extraction coverage is retained before stable-first deduplication. */
  const extracted = [];

  for (const source of sources) {
    signal?.throwIfAborted();
    extracted.push(await (services.extractSource ?? extractSource)(source, signal));
  }

  /** Successful coverage baselines and exact reviewed accepted outcomes form one resolution candidate. */
  const coverage = extracted.map(coverageRecord);
  const acceptedCoverage = validateCoverage(
    coverage,
    config.lastSuccessful?.coverage ?? [],
    config.coverageExceptions,
    config.lastSuccessful?.acceptedCoverage ?? [],
  );
  const merged = { ui: new Map(), types: new Map(), modifiers: new Map(), scopes: new Map() };
  const warnings = extracted.flatMap((input) => input.warnings),
    proposals = [];

  for (const input of extracted) {
    for (const family of Object.keys(merged)) {
      for (const [id, record] of input[family]) {
        if (!merged[family].has(id)) merged[family].set(id, record);
      }
    }
  }

  /** All three detail files and resolution metadata are applied as one affected set. */
  const output = new Map();

  for (const family of ["ui", "semantic", "syntax"]) {
    /** Refresh the union without expanding definition inventories or changing accepted categories. */
    const ids = new Set([
      ...snapshot.details[family].records.keys(),
      ...(snapshot.definitions[family]?.records.keys() ?? []),
      ...themes.flatMap((theme) => (family === "syntax" ? [] : [...theme.families.definitions[family].records.keys()])),
    ]);
    const input = snapshot.details[family].input;

    /** Shared source text remains structurally/comment-preserved through individual leaf edits. */
    let source = input.source;

    for (const id of ids) {
      /** Existing accepted category and eligible extracted documentation. */
      const existing = snapshot.details[family].records.get(id),
        definition = snapshot.definitions[family]?.records.get(id);
      const authored = themes
        .flatMap((theme) => [...theme.families.definitions[family].records.values()])
        .find((record) => record.id === id);
      const category = existing?.category ?? definition?.category ?? authored?.category ?? "nonStandard";
      const upstream =
        family === "ui"
          ? merged.ui.get(id)
          : family === "semantic"
            ? semanticDescription(id, merged.types, merged.modifiers)
            : undefined;

      if (upstream?.category && upstream.category !== category)
        proposals.push({
          family,
          id,
          current: category,
          proposed: upstream.category,
          evidence: upstream,
          affected: [
            input.path,
            definition?.inputPath,
            ...themes
              .filter((theme) => theme.families.definitions[family].records.has(id))
              .map((theme) => theme.families.definitions[family].input.path),
          ].filter(Boolean),
        });

      /** Reference syntax descriptions derive only from actual default rule scopes. */
      const reference =
        family === "syntax"
          ? themes
              .find((theme) => theme.target.group === "prod" && theme.target.name === "default")
              .families.definitions.syntax.records.get(id)
          : undefined;
      const description =
        upstream?.description ??
        (reference
          ? `TextMate rule ${reference.value.name || id} targeting ${scopeList(reference.value).join(", ") || "no explicit scope selectors"}.`
          : undefined);
      const candidate = refreshDescription(
        existing?.value,
        family === "syntax" ? undefined : description,
        resolution.version,
      );

      if (family === "syntax" && candidate["modified-desc"] !== true && description)
        candidate.description = description;

      if (!candidate.description)
        candidate.description = description ?? `UNREVIEWED: Describe the purpose of ${family} property ${id}.`;
      if (!description)
        warnings.push(`${family} ${id}: unresolved; retained existing wording/history or an UNREVIEWED marker`);

      if (JSON.stringify(candidate) !== JSON.stringify(existing?.value))
        source = editSource(source, recordPath(family, category, id), candidate);
    }

    for (const [id, record] of family === "ui" ? merged.ui : family === "semantic" ? merged.types : []) {
      if (!ids.has(id))
        proposals.push({
          family,
          id,
          current: "absent",
          proposed: record.category,
          evidence: record,
          affected: [input.path, snapshot.definitions[family].input.path],
        });
    }

    if (family === "syntax") {
      for (const { target, families } of themes) {
        for (const [id, record] of families.definitions.syntax.records) {
          /** Evidence proposals preserve accepted immutable historical records until explicit review. */
          const scopeEvidence = scopeList(record.value).map((scope) => merged.scopes.get(scope));
          const referenceScopes = snapshot.referenceScopes.get(id);

          if (
            JSON.stringify(scopeList(record.value)) !== JSON.stringify(referenceScopes) ||
            scopeEvidence.some((evidence) => evidence && evidence.category !== record.category)
          )
            proposals.push({
              family,
              id,
              theme: `${target.group}/${target.name}`,
              scopes: scopeList(record.value),
              current: record.category,
              proposed: scopeEvidence.some((evidence) => evidence?.category === "nonStandard")
                ? "nonStandard"
                : record.category,
              scopeEvidence: scopeEvidence.filter(Boolean),
              affected: [families.definitions.syntax.input.path, families.details.syntax.input.path],
            });
        }
      }
    }

    source = refreshedHeader(source, resolution, family);
    output.set(input.path, await formatSource(root, input.path, source));
  }

  /** Successful source resolution advances only with its complete refreshed data generation. */
  const successful = { resolution, coverage, acceptedCoverage };
  const updatedConfig = applyEdits(configSource, modify(configSource, ["lastSuccessful"], successful, {}));

  output.set(configPath, await formatSource(root, configPath, updatedConfig));

  // Validate the prepared shared files with the same local codec before application.
  for (const [path, source] of output) {
    if (path === configPath) continue;

    decode({ ...parseJsonc(source, path), source, path, label: path }, path.split("/")[2], "details", { shared: true });
  }

  for (const source of sources) await (services.assertSourceFresh ?? assertSourceFresh)(source);

  await assertFresh(expected);
  signal?.throwIfAborted();

  /** No-op/check comparisons do not touch any source/cache/state timestamps. */
  const changed = [];

  for (const [path, source] of output) {
    if ((await readFile(join(root, path), "utf8")) !== source) changed.push(path);
  }

  if (check) {
    if (changed.length)
      throw Object.assign(new Error(`Shared detail refresh drift: ${changed.join(", ")}`), { proposals, warnings });

    return { changed, proposals, warnings, resolution, replay: true };
  }

  await withGuards([root], async ([owner]) => {
    for (const source of sources) await (services.assertSourceFresh ?? assertSourceFresh)(source);

    if (recover && (await observeWriter(root)).marker?.id !== state.marker?.id)
      throw new Error("Recovery marker changed during preparation; retry recovery");

    signal?.throwIfAborted();
    await applyArtifacts({
      root,
      output,
      expected,
      owner,
      allowRecovery: recover ? state.marker?.id : undefined,
      recovery:
        "npm run update:token-details -- --recover (or restore the complete set and use --recover=verify-restored)",
      operations: services.operations,
      signal,
      operation: "token-details",
    });
  });

  return { changed, proposals, warnings, resolution, replay };
}

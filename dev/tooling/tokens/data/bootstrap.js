/**
 * Shared token bootstrap.
 * @file Prepare shared token inventories and details from verified upstream sources without loading existing shared data.
 */

import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { createRetrieval, obtainSource, resolveLatest, validateSourceConfig, verifySource } from "./sources.js";
import { extractSource, semanticDescription } from "./extraction.js";
import { discoverTargets, readTargetInput } from "../../themes/inputs.js";
import { repositoryRoot } from "../../shared/paths.js";
import { decode, semanticPath } from "../formats.js";
import { applyArtifacts, assertFresh, capturePaths, observeWriter, withGuards } from "../../shared/transactions.js";
import { parseJsonc } from "../../shared/jsonc.js";
import { formatSource } from "../../shared/formatting.js";

/**
 * Insert one dotted token ID into category data while preserving nested UI structure.
 * @param target - Category object to update.
 * @param id - Canonical token ID.
 * @param value - Generated definition or detail value.
 */
function insert(target, id, value) {
  const parts = id.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  const key = parts.at(-1);
  node[key] = node[key] && typeof node[key] === "object" ? { ...node[key], ...value } : value;
}

/**
 * Serialize one generated category family as formatted JSONC.
 * @param family - Shared token family.
 * @param kind - Generated file role.
 * @param value - Categorized records.
 */
function serialize(family, kind, value) {
  return `// Shared ${family} token ${kind}: generated from verified sources.\n${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Build shared token data from verified VS Code and extension sources.
 * @param options - Bootstrap inputs.
 * @param options.root - Checkout root.
 * @param options.extensionSources - Explicit extension checkout paths.
 * @param options.signal - Cancellation signal.
 */
export async function bootstrapTokenData({ root = repositoryRoot, extensionSources = [], signal }) {
  /** Shared files that must be absent before a clean bootstrap. */
  const paths = [
    "src/data/tokens/ui/definitions.jsonc",
    "src/data/tokens/ui/details.jsonc",
    "src/data/tokens/semantic/definitions.jsonc",
    "src/data/tokens/semantic/details.jsonc",
    "src/data/tokens/syntax/details.jsonc",
    "src/data/tokens/upstream-sources.jsonc",
  ];

  for (const path of paths) {
    try {
      await stat(join(root, path));
      throw new Error(`Bootstrap destination exists: ${path}; remove shared token data before bootstrapping`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  /** Refuse preparation while another writer owns the checkout or left an incomplete generation. */
  const writer = await observeWriter(root);
  if (writer.busy) throw new Error("Another token or theme writer is active; retry bootstrap when it finishes.");
  if (writer.marker) throw new Error(`Incomplete generation ${writer.marker.id}; recover it before bootstrapping.`);

  /** Stable-first VS Code release and verified extension inputs. */
  const policy = { repository: "microsoft/vscode", supplementalMain: true };
  const retrieval = createRetrieval({ policy: { requestMs: 30000, attempts: 3, totalMs: 300000 }, signal });
  const resolution = await resolveLatest(policy, retrieval);
  const sources = [];

  for (const identity of resolution.inputs) sources.push(await obtainSource({ root, identity, retrieval }));

  for (const [index, directory] of extensionSources.entries())
    sources.push(
      await verifySource(
        isAbsolute(directory) ? directory : resolve(root, directory),
        { id: `extension-${index + 1}`, kind: "extension" },
        retrieval,
      ),
    );

  const extracted = [];
  for (const source of sources) extracted.push(await extractSource(source, signal));

  /** Source records grouped by family, retaining every extension contributor. */
  const ui = new Map(),
    types = new Map(),
    modifiers = new Map();
  for (const input of extracted) {
    for (const [id, record] of input.ui) {
      const values = ui.get(id) ?? [];
      values.push(record);
      ui.set(id, values);
    }
    for (const [id, record] of input.types) if (!types.has(id)) types.set(id, record);
    for (const [id, record] of input.modifiers) if (!modifiers.has(id)) modifiers.set(id, record);
  }

  /** Default theme syntax input establishes local syntax documentation and provenance. */
  const targets = await discoverTargets(root);
  const defaultTarget = targets.find((target) => target.group === "prod" && target.name === "default");
  const syntaxInput = await readTargetInput(root, defaultTarget, "tokens/syntax/definitions.jsonc");
  const syntax = decode(syntaxInput, "syntax", "definitions");

  /** Load theme-owned semantic inventories and validate every source category. */
  const semanticIds = new Set();
  const themeUiIds = new Set();
  for (const target of targets) {
    const uiInput = await readTargetInput(root, target, "tokens/ui/definitions.jsonc");
    const uiData = decode(uiInput, "ui", "definitions");
    for (const record of uiData.records.values()) themeUiIds.add(record.id);

    const input = await readTargetInput(root, target, "tokens/semantic/definitions.jsonc");
    const data = decode(input, "semantic", "definitions");
    for (const record of data.records.values()) semanticIds.add(record.id);
  }

  /** Generated files and canonical category roots. */
  const uiDefinitions = Object.fromEntries(
    ["standard", "sourceCode", "nonStandard", "deprecated"].map((key) => [key, {}]),
  );
  const uiDetails = structuredClone(uiDefinitions);
  const semanticDefinitions = Object.fromEntries(Object.keys(uiDefinitions).map((key) => [key, []]));
  const semanticDetails = structuredClone(uiDefinitions);
  const syntaxDetails = structuredClone(uiDefinitions);

  for (const [id, records] of ui) {
    const category = records[0].category;
    if (!uiDefinitions[category]) throw new Error(`Unknown UI category for ${id}: ${category}`);
    const contributors = [
      ...new Set(records.filter((record) => record.extensionId).map((record) => record.extensionId)),
    ].sort();
    if (category === "nonStandard" && !contributors.length)
      throw new Error(`No verified extension source for nonstandard UI token ${id}`);
    const [property, ...parents] = id.split(".").reverse();
    const group = parents.reverse().join(".") || "_root";
    uiDefinitions[category][group] ??= [];
    uiDefinitions[category][group].push(property);
    insert(uiDetails[category], id, {
      description: records[0].description || `UNREVIEWED: Describe UI token ${id}.`,
      ...(category === "nonStandard" ? { source: contributors } : {}),
    });
  }

  for (const category of Object.keys(uiDefinitions)) {
    const groups = uiDefinitions[category];
    for (const properties of Object.values(groups)) properties.sort();
    if (!Object.keys(groups).length) uiDefinitions[category] = [];
  }

  for (const id of themeUiIds)
    if (!ui.has(id)) throw new Error(`No verified VS Code or extension source for theme UI token ${id}`);

  for (const id of semanticIds) {
    const record = semanticDescription(id, types, modifiers);
    if (!record) throw new Error(`Unable to classify semantic token ${id} from verified VS Code registrations`);
    const category = record.category;
    if (!semanticDefinitions[category]) throw new Error(`Unknown semantic category for ${id}: ${category}`);
    semanticDefinitions[category].push(id);
    const [typeKey, modifierKey] = semanticPath(id);
    const type = typeKey.split(":")[0];
    const modifiers = modifierKey === "default" ? [] : modifierKey.split(".");
    const sourceIds = [
      ...new Set(
        extracted
          .filter(
            (input) =>
              input.identity.kind === "extension" &&
              (input.types.has(type) || modifiers.some((modifier) => input.modifiers.has(modifier))),
          )
          .map((input) => input.identity.contributor)
          .filter(Boolean),
      ),
    ].sort();

    semanticDetails[category][id] = {
      description: record.description || `UNREVIEWED: Describe semantic token ${id}.`,
      ...(category === "nonStandard" ? { source: sourceIds } : {}),
    };
    if (category === "nonStandard" && !semanticDetails[category][id].source.length)
      throw new Error(`No verified extension source for nonstandard semantic token ${id}`);
  }

  for (const target of targets) {
    const input = await readTargetInput(root, target, "tokens/semantic/definitions.jsonc");
    for (const record of decode(input, "semantic", "definitions").records.values())
      if (!semanticIds.has(record.id))
        throw new Error(`Semantic source coverage missing for ${target.group}/${target.name}: ${record.id}`);
  }

  for (const record of syntax.records.values()) {
    const category = record.category;
    if (!syntaxDetails[category]) throw new Error(`Unknown syntax category for ${record.id}: ${category}`);
    insert(syntaxDetails[category], record.id, { description: `UNREVIEWED: Describe syntax token ${record.id}.` });
  }

  /** Each candidate is decoded before any destination is created. */
  const candidates = new Map([
    [paths[0], serialize("ui", "definitions", uiDefinitions)],
    [paths[1], serialize("ui", "details", uiDetails)],
    [paths[2], serialize("semantic", "definitions", semanticDefinitions)],
    [paths[3], serialize("semantic", "details", semanticDetails)],
    [paths[4], serialize("syntax", "details", syntaxDetails)],
  ]);

  for (const [path, source] of candidates) {
    const family = path.split("/")[3];
    decode(
      { ...parseJsonc(source, path), source, path, label: path },
      family,
      path.endsWith("definitions.jsonc") ? "definitions" : "details",
      { shared: true },
    );
    candidates.set(path, await formatSource(root, path, source));
  }

  /** Successful immutable source record, including exact extraction coverage and local syntax identity. */
  const config = {
    policy: "latest-stable",
    repository: "microsoft/vscode",
    supplementalMain: true,
    retrieval: { requestMs: 30000, attempts: 3, totalMs: 300000 },
    coverageExceptions: [],
    lastSuccessful: {
      resolution: { ...resolution, inputs: sources.map((source) => source.identity) },
      coverage: extracted.map((input) => ({
        identity: input.identity,
        ui: [...input.ui.keys()].sort(),
        types: [...input.types.keys()].sort(),
        modifiers: [...input.modifiers.keys()].sort(),
        scopes: [...input.scopes.keys()].sort(),
      })),
      acceptedCoverage: [],
      localSyntax: {
        path: syntaxInput.path,
        revision: `sha256:${createHash("sha256").update(syntaxInput.source).digest("hex")}`,
      },
    },
  };
  validateSourceConfig(config);
  candidates.set(
    paths[5],
    await formatSource(
      root,
      paths[5],
      `// Extraction policy and successful immutable input/coverage history.\n${JSON.stringify(config, null, 2)}\n`,
    ),
  );

  /** Guarded all-file application after source and destination freshness checks. */
  const expected = await capturePaths([
    ...sources.map((source) => source.directory),
    ...targets.map((target) => join(root, target.directory)),
    ...paths.map((path) => join(root, path)),
  ]);
  await assertFresh(expected);
  await withGuards([root], async ([owner]) =>
    applyArtifacts({
      root,
      output: candidates,
      expected,
      owner,
      operation: "token-bootstrap",
      recovery: "npm run bootstrap:tokens -- --recover=verify-restored",
      signal,
    }),
  );
  return { changed: [...candidates.keys()], warnings: extracted.flatMap((input) => input.warnings) };
}

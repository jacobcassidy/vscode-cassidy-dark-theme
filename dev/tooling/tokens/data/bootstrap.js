/**
 * Shared token bootstrap.
 * @file Prepare shared token inventories and details from verified upstream sources without loading existing shared data.
 */

import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { createRetrieval, obtainSource, resolveLatest, validateSourceConfig, verifySource } from "./sources.js";
import { extractSource, semanticDescription } from "./extraction.js";
import { discoverTargets, readTargetInput } from "../../themes/inputs.js";
import {
  repositoryRoot,
  generatedTokenDirectory,
  defaultThemeDirectory,
  manualTokenPaths,
  familyPath,
} from "../../shared/paths.js";
import { decode, semanticPath, scopeList } from "../formats.js";
import { validateCategories, validateReferenceScopes } from "../category-validation.js";
import { loadTokenData } from "./load.js";
import { applyArtifacts, assertFresh, capturePaths, observeWriter, withGuards } from "../../shared/transactions.js";
import { parseJsonc } from "../../shared/jsonc.js";
import { alphabetizeTokenData } from "./alphabetize.js";
import { formatSource } from "../../shared/formatting.js";
import { completeStarterTheme, starterTheme } from "./starter.js";
import { prepareColorSchema, colorSchemaReport } from "./color-schema.js";

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
 * @param resolution - Verified stable and supplemental commits.
 */
function serialize(family, kind, value, resolution) {
  /** Immutable source identities printed in every shared-data header. */
  const stable = resolution.inputs.find((input) => input.id === "vscode-stable")?.revision,
    main = resolution.inputs.find((input) => input.id === "vscode-main")?.revision;

  return `// Shared ${family} token ${kind}: generated from verified sources.
// Upstream inputs last processed: VS Code ${resolution.version}
// Stable commit: ${stable}
// Supplemental main commit: ${main}
/*
MIT License

Copyright (c) 2015 - present Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Updater (run from the repository root): npm run refresh
${JSON.stringify(value, null, 2)}
`;
}

/**
 * Build shared token data from verified VS Code and extension sources.
 * @param options - Bootstrap inputs.
 * @param options.root - Checkout root.
 * @param options.extensionSources - Explicit extension checkout paths.
 * @param options.signal - Cancellation signal.
 * @param options.onProgress - Report the current stage before potentially slow work.
 */
export async function bootstrapTokenData({
  root = repositoryRoot,
  extensionSources = [],
  signal,
  onProgress,
  services = {},
}) {
  onProgress?.("Checking bootstrap destinations and writer state");

  try {
    await lstat(join(root, generatedTokenDirectory));
    throw new Error(
      `Bootstrap destination exists: ${generatedTokenDirectory}; delete it manually before bootstrapping`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  /** An absent default theme is prepared in memory and applied with generated sources. */
  let preparedTheme = new Map();

  try {
    await lstat(join(root, defaultThemeDirectory));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    preparedTheme = await starterTheme(root);
  }

  /** Shared files that must be absent before a clean bootstrap. */
  const paths = [
    "src/data/tokens/generated/ui/definitions.jsonc",
    "src/data/tokens/generated/ui/details.jsonc",
    "src/data/tokens/generated/semantic/definitions.jsonc",
    "src/data/tokens/generated/semantic/details.jsonc",
    "src/data/tokens/generated/syntax/details.jsonc",
    "src/data/tokens/generated/upstream-sources.jsonc",
  ];

  for (const path of paths) {
    try {
      await lstat(join(root, path));
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
  onProgress?.("Resolving the latest VS Code sources");
  const resolution = await resolveLatest(policy, retrieval);
  const sources = [];

  for (const identity of resolution.inputs) {
    onProgress?.(`Retrieving and verifying ${identity.id}`);
    sources.push(await obtainSource({ root, identity, retrieval }));
  }

  for (const [index, directory] of extensionSources.entries()) {
    onProgress?.(`Verifying extension source ${index + 1}: ${directory}`);
    sources.push(
      await verifySource(
        isAbsolute(directory) ? directory : resolve(root, directory),
        { id: `extension-${index + 1}`, kind: "extension" },
        retrieval,
      ),
    );
  }

  const extracted = [];
  for (const source of sources) {
    onProgress?.(`Extracting token registrations from ${source.identity.id}`);
    extracted.push(await extractSource(source, signal));
  }

  /** Runtime schema supplements registrations that static extraction cannot resolve. */
  const schema = await prepareColorSchema({
    root,
    resolution,
    onProgress,
    capture: services.captureColorSchema,
  });

  onProgress?.("Preparing shared token inventories and details");

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

  for (const [family, target] of [
    ["ui", ui],
    ["types", types],
    ["modifiers", modifiers],
  ]) {
    for (const [id, value] of schema.records[family]) {
      /** Stable runtime membership is independent evidence when source extraction missed a registration. */
      const record = {
        description: value.description || `UNREVIEWED: Describe registered ${family} token ${id}.`,
        category: value.deprecated ? "deprecated" : "standard",
        inputId: "vscode-color-theme-schema",
        revision: schema.snapshot.commit,
        path: `vscode://schemas/${family === "ui" ? "workbench-colors" : "token-styling"}`,
      };

      if (family === "ui") {
        if (!target.has(id) || target.get(id)[0].category !== record.category)
          target.set(id, [record, ...(target.get(id) ?? [])]);
      } else if (!target.has(id) || target.get(id).category !== record.category) target.set(id, record);
    }
  }

  /** Default theme syntax input establishes local syntax documentation and provenance. */
  const targets = await discoverTargets(root, { includeMissingDefault: preparedTheme.size > 0 });
  const defaultTarget = targets.find((target) => target.group === "prod" && target.name === "default");
  const syntaxInput = await readTargetInput(root, defaultTarget, "tokens/syntax/definitions.jsonc", preparedTheme);
  const syntax = decode(syntaxInput, "syntax", "definitions");

  /** Load theme-owned semantic inventories and validate every source category. */
  const semanticIds = new Set();
  const themeUiIds = new Set();
  for (const target of targets) {
    const uiInput = await readTargetInput(root, target, "tokens/ui/definitions.jsonc", preparedTheme);
    const uiData = decode(uiInput, "ui", "definitions");
    for (const record of uiData.records.values()) themeUiIds.add(record.id);

    const input = await readTargetInput(root, target, "tokens/semantic/definitions.jsonc", preparedTheme);
    const data = decode(input, "semantic", "definitions");
    for (const record of data.records.values()) semanticIds.add(record.id);
  }

  /** Every stable registered semantic type and wildcard modifier is a default-theme selector candidate. */
  for (const id of schema.records.types.keys()) semanticIds.add(id);
  for (const id of schema.records.modifiers.keys()) semanticIds.add(`*.${id}`);

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
      ...(records[0].inherits ? { inherits: records[0].inherits } : {}),
      ...(records[0].overrides ? { overrides: records[0].overrides } : {}),
      ...(category === "nonStandard" ? { source: contributors } : {}),
    });
  }

  for (const category of Object.keys(uiDefinitions)) {
    const groups = uiDefinitions[category];
    for (const properties of Object.values(groups)) properties.sort();
    if (!Object.keys(groups).length) uiDefinitions[category] = [];
  }

  for (const id of semanticIds) {
    const record = semanticDescription(id, types, modifiers);
    if (!record) continue;
    const category = record.category;
    if (!semanticDefinitions[category]) throw new Error(`Unknown semantic category for ${id}: ${category}`);
    semanticDefinitions[category].push(id);
    const [typeKey, modifierKey] = semanticPath(id);
    const type = typeKey.split(":")[0];
    const selectedModifiers = modifierKey === "default" ? [] : modifierKey.split(".");
    const sourceIds = [
      ...new Set(
        extracted
          .filter(
            (input) =>
              input.identity.kind === "extension" &&
              (input.types.has(type) || selectedModifiers.some((modifier) => input.modifiers.has(modifier))),
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

  for (const record of syntax.records.values()) {
    const category = record.category;
    if (!syntaxDetails[category]) throw new Error(`Unknown syntax category for ${record.id}: ${category}`);
    insert(syntaxDetails[category], record.id, { description: `UNREVIEWED: Describe syntax token ${record.id}.` });
  }

  /** Each candidate is decoded before any destination is created. */
  const candidates = new Map([
    [paths[0], alphabetizeTokenData(serialize("ui", "definitions", uiDefinitions, resolution), paths[0])],
    [paths[1], alphabetizeTokenData(serialize("ui", "details", uiDetails, resolution), paths[1])],
    [paths[2], alphabetizeTokenData(serialize("semantic", "definitions", semanticDefinitions, resolution), paths[2])],
    [paths[3], alphabetizeTokenData(serialize("semantic", "details", semanticDetails, resolution), paths[3])],
    [paths[4], alphabetizeTokenData(serialize("syntax", "details", syntaxDetails, resolution), paths[4])],
  ]);

  for (const [path, source] of candidates) {
    const family = path.split("/").at(-2);
    decode(
      { ...parseJsonc(source, path), source, path, label: path },
      family,
      path.endsWith("definitions.jsonc") ? "definitions" : "details",
      { shared: true },
    );
    candidates.set(path, await formatSource(root, path, source));
  }

  /** Validate the effective generated/manual snapshot and all theme categories before any write. */
  const snapshot = await loadTokenData({ root, overrides: candidates });

  if (preparedTheme.size) completeStarterTheme(preparedTheme, snapshot);

  for (const [family, ids] of [
    ["ui", themeUiIds],
    ["semantic", semanticIds],
  ]) {
    for (const id of ids)
      if (!snapshot.definitions[family].records.has(id))
        throw new Error(`No verified or manual shared ${family} definition for theme token ${id}`);
  }

  for (const target of targets) {
    /** Independently inherited theme files retain their actual origin labels. */
    const families = { definitions: {}, details: {} };

    for (const family of ["variables", "ui", "semantic", "syntax"]) {
      for (const kind of ["definitions", "details"])
        families[kind][family] = decode(
          await readTargetInput(root, target, familyPath(family, kind), preparedTheme),
          family,
          kind,
        );
    }

    if (target.group === "prod" && target.name === "default") {
      validateReferenceScopes(snapshot, families.definitions.syntax);
      snapshot.referenceScopes = new Map(
        [...families.definitions.syntax.records].map(([id, record]) => [id, scopeList(record.value)]),
      );
    }

    validateCategories(families, snapshot, `${target.group}/${target.name}`);
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
      colorThemeSchema: {
        path: schema.path,
        revision: schema.snapshot.commit,
        digest: schema.snapshot.digest,
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

  candidates.set(schema.path, schema.source);
  candidates.set(schema.reportPath, await colorSchemaReport({ root, resolution, schema, extracted }));

  /** Preserve an existing shared README, or create the root reference during bootstrap. */
  const readmePath = "src/data/tokens/README.md";

  try {
    await readFile(join(root, readmePath), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    candidates.set(
      readmePath,
      `# Shared token data

\`generated/\` contains verified upstream definitions, descriptions, and source history. Run \`npm run bootstrap\` when this directory is absent, or \`npm run refresh\` to update its descriptions. Both commands capture the stable release's VS Code color theme schema and save a snapshot and readable report in \`dev/docs/refreshes/\`.

\`manual/\` contains optional authored UI, semantic, and syntax files with the same category roots as generated data. It is never written by bootstrap or refresh. Manual definitions may add IDs that generated data does not contain; a manual-only \`standard\` ID requires upstream verification and belongs in generated data. Nonstandard UI or semantic additions require a matching detail with sorted, unique \`Publisher.extension\` source attribution. Manual-only \`sourceCode\` or \`deprecated\` IDs require matching details with \`classificationEvidence\` containing \`inputId\`, immutable \`revision\`, source-relative \`path\`, and a review \`reason\`. Manual syntax details can provide reviewed \`scopeEvidence\` for default-theme rules. Manual details may override generated description fields while retaining generated source attribution and syntax scope evidence. Builds merge and validate both layers before using them.
`,
    );
  }

  for (const [path, source] of preparedTheme) candidates.set(path, await formatSource(root, path, source));

  /** Guarded all-file application after source and destination freshness checks. */
  onProgress?.("Validating and applying shared token files");
  const expected = await capturePaths([
    ...sources.map((source) => source.directory),
    ...targets.map((target) => join(root, target.directory)),
    ...paths.map((path) => join(root, path)),
    ...manualTokenPaths.map((path) => join(root, path)),
    ...[...preparedTheme.keys(), readmePath].map((path) => join(root, path)),
    join(root, schema.path),
    join(root, schema.reportPath),
  ]);
  await assertFresh(expected);
  await withGuards([root], async ([owner]) =>
    applyArtifacts({
      root,
      output: candidates,
      expected,
      owner,
      operation: "token-bootstrap",
      recovery: "Restore the complete source set, then rerun npm run bootstrap",
      signal,
    }),
  );
  return { changed: [...candidates.keys()], warnings: extracted.flatMap((input) => input.warnings) };
}

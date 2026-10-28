/**
 * Versioned VS Code color schema snapshots.
 * @file Capture the editor's virtual schemas from an exact stable build and compare their token registrations.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../../shared/serialization.js";
import { semanticPath } from "../formats.js";

/** Virtual schema identities that make up a complete color-theme schema bundle. */
const schemaIds = ["color-theme", "workbench-colors", "token-styling", "textmate-colors"];

/**
 * Return a stable SHA-256 identity for a schema bundle.
 * @param schemas - Captured virtual schema objects.
 */
function digest(schemas) {
  return `sha256:${createHash("sha256").update(canonicalJson(schemas)).digest("hex")}`;
}

/**
 * Run the schema-capture worker with library and VS Code output isolated in a log.
 * @param options - Runtime process inputs.
 * @param options.modulePath - Capture worker module to execute.
 * @param options.args - Worker argument strings.
 * @param options.logPath - File receiving both child output streams.
 * @param [options.onProgress] - Stage updates received over IPC.
 */
export async function runSchemaRuntime({ modulePath, args, logPath, onProgress }) {
  /** Shared log descriptor captures even direct console writes from the runtime library. */
  const log = await open(logPath, "w");

  try {
    await new Promise((resolve, reject) => {
      /** The capture process owns its console; only explicit stage messages reach the parent. */
      const child = fork(modulePath, args, { execArgv: [], stdio: ["ignore", log.fd, log.fd, "ipc"] });

      child.on("message", (message) => {
        if (typeof message?.stage === "string") onProgress?.(message.stage);
      });
      child.once("error", reject);
      child.once("close", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`Capture process exited with ${signal ?? code}`));
      });
    });
  } catch (error) {
    throw new Error(`VS Code schema capture failed: ${error.message}. See ${logPath}`, { cause: error });
  } finally {
    await log.close();
  }
}

/**
 * Capture registered schemas through an isolated VS Code worker.
 * @param options - Pinned release and staging inputs.
 * @param options.root - Project root containing the capture cache.
 * @param options.version - Stable release version.
 * @param options.commit - Exact stable source commit.
 * @param [options.onProgress] - Quiet-stage progress reporter.
 */
async function captureRuntimeSchema({ root, version, commit, onProgress }) {
  /** Runtime logs and output remain in the ignored cache. */
  const cache = join(root, "dev/.cache/token-details/schema-runtime"),
    host = resolve(import.meta.dirname, "schema-host"),
    output = join(cache, `capture-${version}.json`),
    logPath = join(cache, `capture-${version}.log`);

  await mkdir(cache, { recursive: true });

  /** Short profile paths avoid the platform's Unix-socket pathname limit. */
  const profile = await mkdtemp(join(tmpdir(), "cassidy-schema-"));

  try {
    onProgress?.(`Starting VS Code ${version} schema capture`);
    await rm(output, { force: true });
    await runSchemaRuntime({
      modulePath: fileURLToPath(new URL("./schema-runtime.js", import.meta.url)),
      args: [version, commit, cache, host, output, profile],
      logPath,
      onProgress,
    });

    /** Validate the worker's result before returning it to bootstrap or refresh. */
    const capture = JSON.parse(await readFile(output, "utf8"));

    if (capture.version !== version)
      throw new Error(`Captured VS Code version ${capture.version} does not match ${version}`);

    return capture.schemas;
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}

/**
 * Validate a complete capture and derive exact registered token IDs and wording.
 * @param schemas - Parsed virtual schema bundle.
 */
export function schemaRecords(schemas) {
  /** The theme schema must reference the two dynamic registries used for comparisons. */
  const theme = schemas?.["color-theme"];

  if (
    theme?.properties?.colors?.$ref !== "vscode://schemas/workbench-colors" ||
    theme?.properties?.semanticTokenColors?.$ref !== "vscode://schemas/token-styling" ||
    schemaIds.some((id) => !schemas[id] || typeof schemas[id] !== "object")
  )
    throw new Error("Incomplete VS Code color theme schema references");

  /** Exact UI color properties and semantic base type/modifier suggestions. */
  const ui = new Map(),
    types = new Map(),
    modifiers = new Map();

  for (const [id, value] of Object.entries(schemas["workbench-colors"].properties ?? {}))
    ui.set(id, { description: value.description, deprecated: Boolean(value.oneOf?.[0]?.deprecationMessage) });

  for (const [id, value] of Object.entries(schemas["token-styling"].properties ?? {})) {
    const destination = id.startsWith("*.") ? modifiers : types;

    destination.set(id.startsWith("*.") ? id.slice(2) : id, {
      description: value.description,
      deprecated: Boolean(value.deprecationMessage),
    });
  }

  if (!ui.size || !types.size || !modifiers.size) throw new Error("VS Code color schema registry is empty");

  return { ui, types, modifiers };
}

/**
 * Load a verified release snapshot or capture it from the exact stable runtime.
 * @param options - Schema preparation options.
 * @param options.root - Project root.
 * @param options.resolution - Verified stable release and commit.
 * @param [options.replay] - Require an existing matching snapshot without launching VS Code.
 * @param [options.capture] - Injectable runtime capture for focused tests.
 * @param [options.onProgress] - Quiet-stage progress reporter.
 */
export async function prepareColorSchema({
  root,
  resolution,
  replay = false,
  capture = captureRuntimeSchema,
  onProgress,
}) {
  /** Stable identity and per-release documentation paths. */
  const commit = resolution.inputs.find((input) => input.id === "vscode-stable")?.revision,
    version = resolution.version,
    path = `dev/docs/refreshes/vscode-${version}/color-theme.json`,
    reportPath = `dev/docs/refreshes/vscode-${version}/color-theme.md`;

  if (!/^[a-f0-9]{40}$/.test(commit ?? "")) throw new Error("Schema capture requires a verified stable commit");

  /** Reuse only an exact-version, exact-commit, internally consistent snapshot. */
  let snapshot;

  try {
    snapshot = JSON.parse(await readFile(join(root, path), "utf8"));

    if (snapshot.version !== version || snapshot.commit !== commit || snapshot.digest !== digest(snapshot.schemas))
      throw new Error(`Corrupt or mismatched color schema snapshot: ${path}`);

    schemaRecords(snapshot.schemas);
  } catch (error) {
    if (replay) throw error;

    onProgress?.(`Capturing VS Code ${version} color theme schema`);

    /** Fresh runtime result is validated before becoming a checked-in candidate. */
    const schemas = await capture({ root, version, commit, onProgress });

    schemaRecords(schemas);
    snapshot = { version, commit, digest: digest(schemas), schemas };
  }

  return {
    snapshot,
    path,
    reportPath,
    source: `${JSON.stringify(snapshot, null, 2)}\n`,
    records: schemaRecords(snapshot.schemas),
  };
}

/**
 * Format a stable release's schema changes and gaps against static extraction.
 * @param options - Report inputs.
 * @param options.root - Project root containing earlier snapshots.
 * @param options.resolution - Stable and supplemental source revisions.
 * @param options.schema - Prepared current schema capture.
 * @param options.extracted - Per-source static registration results.
 * @param [options.generated] - Current generated inventory for refresh comparisons.
 */
export async function colorSchemaReport({ root, resolution, schema, extracted, generated }) {
  /** Only earlier versioned JSON snapshots participate in release deltas. */
  const directory = join(root, "dev/docs/refreshes");

  /** Previous release snapshot, when the project has recorded one. */
  let previous;

  try {
    /** Numerical version ordering avoids lexicographic release mistakes. */
    const versions = (await readdir(directory))
      .map((name) => /^vscode-(\d+\.\d+\.\d+)$/.exec(name)?.[1])
      .filter(Boolean)
      .filter((version) => version.localeCompare(resolution.version, undefined, { numeric: true }) < 0)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    if (versions.length) {
      previous = JSON.parse(await readFile(join(directory, `vscode-${versions.at(-1)}`, "color-theme.json"), "utf8"));

      if (previous.version !== versions.at(-1) || previous.digest !== digest(previous.schemas))
        throw new Error(`Corrupt prior color schema snapshot: vscode-${versions.at(-1)}/color-theme.json`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  /** Exact stable and all-source registration sets retain the difference between extraction and inventory gaps. */
  const stable = extracted.find((input) => input.identity.id === "vscode-stable"),
    allUi = new Set(extracted.flatMap((input) => [...input.ui.keys()])),
    allTypes = new Set(extracted.flatMap((input) => [...input.types.keys()])),
    allModifiers = new Set(extracted.flatMap((input) => [...input.modifiers.keys()]));

  /** Previous schema records are compared only when a valid earlier release exists. */
  const prior = previous ? schemaRecords(previous.schemas) : undefined;

  /** Human-readable report sections in fixed family order. */
  const lines = [
    `# VS Code ${resolution.version} color theme schema refresh`,
    "",
    `Stable commit: \`${schema.snapshot.commit}\``,
    ...resolution.inputs
      .filter((input) => input.id === "vscode-main")
      .map((input) => `Supplemental main commit: \`${input.revision}\``),
    `Schema digest: \`${schema.snapshot.digest}\``,
    "",
  ];

  for (const [label, key, extractedIds] of [
    ["Workbench colors", "ui", allUi],
    ["Semantic types", "types", allTypes],
    ["Semantic modifiers", "modifiers", allModifiers],
  ]) {
    /** Current and previous exact schema keys and stable-source extraction keys. */
    const current = schema.records[key],
      old = prior?.[key] ?? new Map(),
      stableIds = stable?.[key] ?? new Map();

    /** Release changes and gaps are sorted for deterministic reports. */
    const added = [...current.keys()].filter((id) => !old.has(id)).sort(),
      removed = [...old.keys()].filter((id) => !current.has(id)).sort(),
      changed = [...current.keys()]
        .filter((id) => old.has(id) && old.get(id).description !== current.get(id).description)
        .sort(),
      missingStable = [...current.keys()].filter((id) => !stableIds.has(id)).sort(),
      missingAll = [...current.keys()].filter((id) => !extractedIds.has(id)).sort();

    lines.push(`## ${label}`, "", `Schema entries: ${current.size}.`, "");

    for (const [heading, ids] of [
      ["Added since prior snapshot", added],
      ["Removed since prior snapshot", removed],
      ["Descriptions changed", changed],
      ["Missing from stable source extraction", missingStable],
      ["Missing from all source extraction", missingAll],
    ])
      lines.push(`### ${heading}`, "", ...(ids.length ? ids.map((id) => `- \`${id}\``) : ["None."]), "");

    if (generated) {
      /** Generated inventory gaps remain review proposals during refresh. */
      const inventory =
        key === "ui"
          ? new Set(generated.definitions.ui.records.keys())
          : new Set(
              [...generated.definitions.semantic.records.keys()].flatMap((id) => {
                const [type, modifierKey] = semanticPath(id);

                return key === "types" ? [type.split(":")[0]] : modifierKey === "default" ? [] : modifierKey.split(".");
              }),
            );
      const missingInventory = [...current.keys()].filter((id) => !inventory.has(id)).sort();

      lines.push(
        "### Missing from generated inventory",
        "",
        ...(missingInventory.length ? missingInventory.map((id) => `- \`${id}\``) : ["None."]),
        "",
      );
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Versioned VS Code color schema snapshots.
 * @file Capture the editor's virtual schemas from an exact stable build and compare their token registrations.
 */

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
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
 * Locate an official VS Code build's product metadata relative to its executable.
 * @param executable - Downloaded VS Code executable path.
 */
async function productFor(executable) {
  /** Search both Linux and macOS bundle layouts without trusting an installed editor. */
  let directory = dirname(executable);

  for (let depth = 0; depth < 6; depth++) {
    for (const relative of ["resources/app/product.json", "Resources/app/product.json"]) {
      try {
        return JSON.parse(await readFile(join(directory, relative), "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    directory = dirname(directory);
  }

  throw new Error(`VS Code product.json was not found beside ${executable}`);
}

/**
 * Capture registered schemas through the VS Code extension test host.
 * @param options - Pinned release and staging inputs.
 * @param options.root - Project root containing the capture helper.
 * @param options.version - Stable release version.
 * @param options.commit - Exact stable source commit.
 * @param [options.onProgress] - Quiet-stage progress reporter.
 */
async function captureRuntimeSchema({ root, version, commit, onProgress }) {
  /** Ignored cache isolates downloaded builds, profiles, and transient capture output. */
  const cache = join(root, "dev/.cache/token-details/schema-runtime"),
    host = resolve(import.meta.dirname, "schema-host"),
    output = join(cache, `capture-${version}.json`);

  await mkdir(cache, { recursive: true });
  onProgress?.(`Downloading or reusing VS Code ${version} for schema capture`);

  /** Official exact-version build already cached when the release has been processed before. */
  const executable = await downloadAndUnzipVSCode({ version, cachePath: join(cache, "vscode") });

  /** Release binary must match the immutable source revision used in the same invocation. */
  const product = await productFor(executable);

  if (product.commit !== commit)
    throw new Error(`VS Code ${version} schema runtime commit ${product.commit} does not match ${commit}`);

  onProgress?.(`Reading registered color schemas from VS Code ${version}`);

  /** Short isolated profile paths avoid the platform's Unix-socket pathname limit. */
  const profile = await mkdtemp(join(tmpdir(), "cassidy-schema-"));

  try {
    await rm(output, { force: true });
    await runTests({
      vscodeExecutablePath: executable,
      extensionDevelopmentPath: host,
      extensionTestsPath: join(host, "run.js"),
      extensionTestsEnv: { CASSIDY_SCHEMA_OUTPUT: output },
      cachePath: join(cache, "profiles"),
      launchArgs: [
        `--user-data-dir=${join(profile, "user")}`,
        `--extensions-dir=${join(profile, "extensions")}`,
        "--locale=en-US",
        "--skip-welcome",
        "--skip-release-notes",
        "--new-window",
      ],
    });
  } finally {
    await rm(profile, { recursive: true, force: true });
  }

  /** The isolated test host confirms the runtime release as well as its captured schemas. */
  const capture = JSON.parse(await readFile(output, "utf8"));

  if (capture.version !== version)
    throw new Error(`Captured VS Code version ${capture.version} does not match ${version}`);

  return capture.schemas;
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
    path = `dev/docs/refreshes/vscode-color-theme-${version}.json`,
    reportPath = `dev/docs/refreshes/vscode-color-theme-${version}.md`;

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
      .map((name) => /^vscode-color-theme-(\d+\.\d+\.\d+)\.json$/.exec(name)?.[1])
      .filter(Boolean)
      .filter((version) => version.localeCompare(resolution.version, undefined, { numeric: true }) < 0)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    if (versions.length) {
      previous = JSON.parse(await readFile(join(directory, `vscode-color-theme-${versions.at(-1)}.json`), "utf8"));

      if (previous.version !== versions.at(-1) || previous.digest !== digest(previous.schemas))
        throw new Error(`Corrupt prior color schema snapshot: vscode-color-theme-${versions.at(-1)}.json`);
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

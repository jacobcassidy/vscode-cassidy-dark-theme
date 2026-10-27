/**
 * Description refresh contracts.
 * @file Verify static extraction, immutable inputs, coverage review, protected history, replay, rollback, and latest-resolution failures.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { cp, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createBuildProject, writeFixture } from "../../helpers/projects.js";
import { createUpstream } from "../../helpers/upstream.js";
import {
  updateTokenDetails,
  refreshDescription,
  validateCoverage,
} from "../../../tooling/tokens/data/update-details.js";
import {
  createRetrieval,
  verifySource,
  assertSourceFresh,
  obtainSource,
} from "../../../tooling/tokens/data/sources.js";
import { extractSource } from "../../../tooling/tokens/data/extraction.js";
import { parseJsonc } from "../../../tooling/shared/jsonc.js";
import { loadTokenData } from "../../../tooling/tokens/data/load.js";

/** Finite test retrieval policy; transport is always mocked or local. */
const policy = { requestMs: 30000, attempts: 3, totalMs: 300000 };

/**
 * Set up a complete local refresh invocation with a real Git-verified core source.
 * @param t - Test context.
 */
async function project(t) {
  /** Independent theme project, upstream source, and explicit tracking policy. */
  const root = await createBuildProject(t),
    upstream = await createUpstream(t);
  const config = {
    policy: "latest-stable",
    repository: "microsoft/vscode",
    supplementalMain: false,
    retrieval: policy,
    coverageExceptions: [],
  };

  await writeFixture(join(root, "src/token-data/upstream-sources.jsonc"), JSON.stringify(config));

  return {
    root,
    upstream,
    options: {
      root,
      vscodeSource: upstream.directory,
      services: {
        resolveLatest: async () => ({
          version: "1.2.3",
          tag: "1.2.3",
          inputs: [{ id: "vscode-stable", kind: "core", revision: upstream.revision }],
        }),
      },
    },
  };
}

for (const [previous, extracted, expected] of [
  [undefined, "New.", { description: "New.", descriptionAddedIn: "1.2.3", descriptionBasedOn: "1.2.3" }],
  [
    { description: "Old." },
    "New.",
    { description: "New.", descriptionUpdatedIn: "1.2.3", descriptionBasedOn: "1.2.3" },
  ],
  [
    { description: "Old.", descriptionAddedIn: "1.2.3" },
    "New.",
    { description: "New.", descriptionAddedIn: "1.2.3", descriptionBasedOn: "1.2.3" },
  ],
  [
    { description: "Same.", descriptionBasedOn: "1.0.0" },
    "Same.",
    { description: "Same.", descriptionBasedOn: "1.0.0" },
  ],
  [{ description: "Same." }, "Same.", { description: "Same.", descriptionBasedOn: "1.2.3" }],
  [
    { description: "Manual.", "modified-desc": true, descriptionBasedOn: "1.0.0" },
    "New.",
    { description: "Manual.", "modified-desc": true, descriptionBasedOn: "1.0.0" },
  ],
  [{ description: "Local." }, undefined, { description: "Local." }],
]) {
  test(`description history ${JSON.stringify(previous)} -> ${extracted}`, () => {
    assert.deepEqual(refreshDescription(previous, extracted, "1.2.3"), expected);
  });
}

test("AST extraction resolves imported constants/localization and contributor manifests without execution", async (t) => {
  /** Real Git source proof is independent from the AST parser. */
  const upstream = await createUpstream(t),
    retrieval = createRetrieval({ policy });
  const source = await verifySource(
    upstream.directory,
    { id: "vscode-stable", kind: "core", revision: upstream.revision },
    retrieval,
  );
  const core = extractSource(source);

  assert.equal(core.ui.get("editor.background").description, "Upstream editor background.");
  assert.equal(core.types.get("function").description, "Upstream functions.");

  /** A non-Git extension gets contributor identity plus a deterministic content manifest. */
  const extension = await createUpstream(t, { kind: "extension" });
  const verified = await verifySource(extension.directory, { id: "extension-1", kind: "extension" }, retrieval);
  const extracted = extractSource(verified);

  assert.match(verified.identity.revision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(extracted.ui.get("extension.foreground").description, "Extension foreground.");
  assert.equal(extracted.scopes.get("extension.special").extensionId, "fixture.extension");
  assert.equal((await verifySource(extension.directory, verified.identity, retrieval)).digest, verified.digest);
  await writeFile(join(extension.directory, "package.nls.json"), '{"color.description":"Changed."}');
  await assert.rejects(assertSourceFresh(verified), /changed after verification/);
  await assert.rejects(verifySource(extension.directory, verified.identity, retrieval), /manifest mismatch/);
});

test("relevant Git edits fail despite matching HEAD, while unrelated files do not alter extraction identity", async (t) => {
  /** Immutable fixture commit with separately mutable working tree. */
  const upstream = await createUpstream(t),
    retrieval = createRetrieval({ policy });
  const identity = { id: "vscode-stable", kind: "core", revision: upstream.revision };

  await writeFile(join(upstream.directory, "notes.txt"), "Unrelated.");
  await verifySource(upstream.directory, identity, retrieval);
  await writeFile(join(upstream.directory, "src/constants.ts"), 'export const UI_ID = "edited";');
  await assert.rejects(
    verifySource(upstream.directory, identity, retrieval),
    /Git source content differs.*constants.ts/,
  );
});

test("online refresh always discovers latest, no-op/replay preserves bytes, and checks never call discovery", async (t) => {
  /** Default fixture includes actual theme-local text, which refreshes cannot import or change. */
  const { root, options } = await project(t);
  const themePath = join(root, "src/themes/prod/default/tokens/ui/details.jsonc"),
    themeBefore = await readFile(themePath, "utf8");

  /** Count discovery calls across first and unchanged online runs. */
  let discoveries = 0;

  options.services.resolveLatest = async () => {
    discoveries++;

    return {
      version: "1.2.3",
      tag: "1.2.3",
      inputs: [
        {
          id: "vscode-stable",
          kind: "core",
          revision: (
            await verifySource(options.vscodeSource, { id: "vscode-stable", kind: "core" }, createRetrieval({ policy }))
          ).identity.revision,
        },
      ],
    };
  };

  assert.equal((await updateTokenDetails(options)).changed.length, 4);
  assert.equal((await updateTokenDetails(options)).changed.length, 0);
  assert.equal(discoveries, 2);
  assert.equal((await updateTokenDetails({ ...options, check: true })).changed.length, 0);
  assert.equal((await updateTokenDetails({ ...options, offline: true })).changed.length, 0);
  assert.equal(discoveries, 2);
  assert.equal(await readFile(themePath, "utf8"), themeBefore);
  assert.equal((await loadTokenData({ root })).details.ui.value["editor.background"].descriptionAddedIn, "1.2.3");
  assert.ok(
    (await updateTokenDetails({ ...options, check: true })).proposals.length,
    "classification proposals alone do not fail replay checks",
  );
});

test("protected shared wording and usage survive refresh; removing protection permits upstream text", async (t) => {
  /** Protected shared description differs intentionally from the theme-local copy. */
  const { root, options } = await project(t);

  await writeFixture(
    join(root, "src/token-data/ui/details.jsonc"),
    '{"editor.background":{"description":"Manual shared wording.","modified-desc":true,"descriptionBasedOn":"1.0.0","use":"When the fixture provider is active."}}',
  );
  await updateTokenDetails(options);
  assert.equal(
    (await loadTokenData({ root })).details.ui.value["editor.background"].description,
    "Manual shared wording.",
  );
  await writeFixture(
    join(root, "src/token-data/ui/details.jsonc"),
    '{"editor.background":{"description":"Manual shared wording.","modified-desc":false,"descriptionBasedOn":"1.0.0","use":"When the fixture provider is active."}}',
  );
  await updateTokenDetails(options);
  assert.equal(
    (await loadTokenData({ root })).details.ui.value["editor.background"].description,
    "Upstream editor background.",
  );
  assert.match((await loadTokenData({ root })).details.ui.value["editor.background"].use, /provider/);
});

test("partial updater replacement rolls back details, headers, and source resolution together", async (t) => {
  /** First successful generation provides all four prior artifacts. */
  const { root, options } = await project(t);

  await updateTokenDetails(options);

  /** Complete pre-failure affected set is compared byte-for-byte after rollback. */
  const paths = ["ui/details.jsonc", "semantic/details.jsonc", "syntax/details.jsonc", "upstream-sources.jsonc"];
  const before = await Promise.all(paths.map((path) => readFile(join(root, "src/token-data", path), "utf8")));

  options.services.resolveLatest = async () => ({
    version: "1.2.4",
    tag: "1.2.4",
    inputs: [
      {
        id: "vscode-stable",
        kind: "core",
        revision: parseJsonc(before[3], "config").value.lastSuccessful.resolution.inputs[0].revision,
      },
    ],
  });
  options.services.operations = {
    /**
     * Fail a later detail write after the earlier file has been replaced.
     * @param path - Destination.
     * @param source - Candidate bytes.
     */
    replace: async (path, source) => {
      if (path.includes("semantic/details")) throw new Error("injected updater failure");

      await writeFile(path, source);
    },
  };

  await assert.rejects(updateTokenDetails(options), /injected updater failure.*prior artifacts restored/);
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(join(root, "src/token-data", path), "utf8"))),
    before,
  );
});

test("cache publication verifies completed entries, reuses concurrent results, and replay never repairs corruption", async (t) => {
  /** Actual local Git contents are copied into owned staging, with no network calls. */
  const { root, upstream } = await project(t);
  const identity = { id: "vscode-stable", kind: "core", revision: upstream.revision };
  const retrieval = createRetrieval({ policy });

  /** Injectable population operation proves only unique staging is populated. */
  let populations = 0;

  /**
   * Populate a complete fixture source in the caller's unique staging directory.
   * @param path - Owned staging directory.
   */
  async function populate(path) {
    populations++;
    await cp(upstream.directory, path, { recursive: true });
  }

  await obtainSource({ root, identity, retrieval, populate });
  await obtainSource({ root, identity, retrieval, populate });
  assert.equal(populations, 1);
  await writeFile(join(root, ".cache/token-details", identity.revision, "src/constants.ts"), "broken");
  await assert.rejects(obtainSource({ root, identity, retrieval, replay: true }), /corrupt recorded source/);
  assert.equal(populations, 1);
  await obtainSource({ root, identity, retrieval, populate });
  assert.equal(populations, 2);
  assert.ok((await readdir(join(root, ".cache/token-details"))).every((name) => !name.includes("staging")));
});

test("coverage exceptions authorize exact empty transitions and exact-identity replay, retaining their evidence", () => {
  /** Independent old/new source identities and precise covered ID sets. */
  const old = {
    identity: { id: "vscode-stable", kind: "core", revision: "a".repeat(40) },
    ui: ["editor.background"],
    types: ["variable"],
    modifiers: [],
    scopes: [],
  };
  const current = { ...old, identity: { ...old.identity, revision: "b".repeat(40) }, ui: [], types: [] };
  const exception = {
    id: "review-1",
    inputId: old.identity.id,
    from: old.identity.revision,
    to: current.identity.revision,
    lost: { ui: ["editor.background"], types: ["variable"], modifiers: [], scopes: [] },
    allowEmpty: ["ui", "semantic"],
    reason: "Reviewed fixture transition.",
    evidence: "Fixture review record.",
  };

  assert.throws(() => validateCoverage([current], [old], []), /coverage regression/);

  /** Accepted outcome records authorize unchanged replay only. */
  const accepted = validateCoverage([current], [old], [exception]);

  assert.deepEqual(validateCoverage([current], [current], [exception], accepted), accepted);
  assert.throws(() => validateCoverage([current], [current], [], accepted), /evidence missing/);
  assert.throws(
    () =>
      validateCoverage(
        [{ ...current, identity: { ...current.identity, revision: "c".repeat(40) } }],
        [current],
        [exception],
        accepted,
      ),
    /coverage regression/,
  );
});

test("cancellation during shared application restores the complete previous generation", async (t) => {
  /** Cancellation is triggered at a deterministic operation boundary, not a wall-clock timeout. */
  const { root, options } = await project(t);
  const cancellation = new AbortController();
  const paths = ["ui/details.jsonc", "semantic/details.jsonc", "syntax/details.jsonc", "upstream-sources.jsonc"];
  const before = await Promise.all(paths.map((path) => readFile(join(root, "src/token-data", path), "utf8")));

  options.signal = cancellation.signal;
  options.services.operations = {
    /**
     * Abort after the first actual source replacement.
     * @param path - Destination filename.
     * @param source - Complete candidate contents.
     */
    replace: async (path, source) => {
      await writeFile(path, source);
      cancellation.abort(new Error("cancelled during application"));
    },
  };

  await assert.rejects(updateTokenDetails(options), /cancelled during application.*prior artifacts restored/);
  assert.deepEqual(
    await Promise.all(paths.map((path) => readFile(join(root, "src/token-data", path), "utf8"))),
    before,
  );
});

/**
 * Coordinated application failures.
 * @file Verify complete preparation, rollback ownership, contention, and explicit interrupted-generation recovery.
 */

import { buildFixture as buildThemes } from "../helpers/builds.js";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, rename, rm } from "node:fs/promises";
import {
  writeFixture as writeFile,
  createBuildProject,
  readBuildOutputs,
  writeDefaultPaletteConfig,
} from "../helpers/projects.js";
import { join } from "node:path";
import { prepareBuild, applyBuild } from "../../tooling/themes/build.js";
import {
  withGuards,
  capturePaths,
  applyArtifacts,
  requireStable,
  verifyRestored,
  observeWriter,
} from "../../tooling/shared/transactions.js";

test("a malformed development target prevents all production application", async (t) => {
  /** Isolated source tree with a valid already-built production generation. */
  const root = await createBuildProject(t);
  await buildThemes({ root, mode: "prod" });

  /** Complete previous artifacts, compared after failed combined preparation. */
  const before = await readBuildOutputs(root);
  await writeDefaultPaletteConfig(join(root, "src/themes/dev/broken"));
  await writeFile(join(root, "src/themes/dev/broken/metadata.jsonc"), "{");
  await assert.rejects(buildThemes({ root }), /broken/);
  assert.deepEqual(await readBuildOutputs(root), before);
});

test("later replacement failure restores earlier artifacts and absent paths", async (t) => {
  /** Temporary project root used only for application tests. */
  const root = await createBuildProject(t);

  await writeFile(join(root, "existing.txt"), "before");

  /** All candidates are prepared before acquiring the guard. */
  const output = new Map([
    ["existing.txt", "after"],
    ["new.txt", "new"],
    ["failure.txt", "fail"],
  ]);

  /** Pre-application fingerprints used to reject stale inputs. */
  const expected = await capturePaths([...output.keys()].map((path) => join(root, path)));

  await assert.rejects(
    withGuards([root], async ([owner]) =>
      applyArtifacts({
        root,
        output,
        expected,
        owner,
        operations: {
          /**
           * Fail only the last replacement after actual filesystem writes.
           * @param path - Destination path.
           * @param bytes - Complete replacement text.
           */
          replace: async (path, bytes) => {
            if (path.endsWith("failure.txt")) throw new Error("injected replacement failure");
            await writeFile(`${path}.staged`, bytes);
            await rename(`${path}.staged`, path);
          },
        },
      }),
    ),
    /injected replacement failure; prior artifacts restored/,
  );

  assert.equal(await readFile(join(root, "existing.txt"), "utf8"), "before");
  await assert.rejects(readFile(join(root, "new.txt")), { code: "ENOENT" });
  assert.equal((await observeWriter(root)).marker, undefined);
});

test("a later removal failure restores earlier replacements and removals without touching unrelated files", async (t) => {
  /** Isolated resource containing a manifest, stale artifacts, and an unrelated protected file. */
  const root = await createBuildProject(t);

  /** Original production manifest must survive a failed cleanup generation. */
  const manifest = await readFile(join(root, "package.json"), "utf8");

  for (const path of ["stale.txt", "failure.txt", "unrelated.txt"]) await writeFile(join(root, path), path);

  /** The final removal fails only after a manifest replacement and a real removal succeed. */
  const output = new Map([
    ["package.json", "replacement"],
    ["stale.txt", null],
    ["failure.txt", null],
  ]);

  /** Complete pre-application destination set. */
  const expected = await capturePaths([...output.keys()].map((path) => join(root, path)));

  await assert.rejects(
    withGuards([root], async ([owner]) =>
      applyArtifacts({
        root,
        output,
        expected,
        owner,
        operations: {
          /**
           * Fail one scheduled removal after a preceding deletion succeeded.
           * @param path - Artifact destination.
           * @param options - Native removal options.
           */
          async remove(path, options) {
            if (path.endsWith("failure.txt")) throw new Error("injected removal failure: failure.txt");
            await rm(path, options);
          },
        },
      }),
    ),
    /injected removal failure: failure.txt; prior artifacts restored/,
  );

  assert.equal(await readFile(join(root, "package.json"), "utf8"), manifest);

  for (const path of ["stale.txt", "failure.txt", "unrelated.txt"])
    assert.equal(await readFile(join(root, path), "utf8"), path);

  assert.equal((await observeWriter(root)).marker, undefined);
});

test("a restoration failure retains the original application error, failing path, and recovery marker", async (t) => {
  /** Isolated resource with one artifact that will require restoration. */
  const root = await createBuildProject(t);

  await writeFile(join(root, "existing.txt"), "before");

  /** A later replacement fails after the first artifact changes. */
  const output = new Map([
    ["existing.txt", "after"],
    ["failure.txt", "fail"],
  ]);

  /** Complete restoration verification set retained by the marker. */
  const expected = await capturePaths([...output.keys()].map((path) => join(root, path)));

  await assert.rejects(
    withGuards([root], async ([owner]) =>
      applyArtifacts({
        root,
        output,
        expected,
        owner,
        operations: {
          /**
           * Apply the first artifact and fail the later replacement.
           * @param path - Artifact destination.
           * @param bytes - Prepared replacement text.
           */
          async replace(path, bytes) {
            if (path.endsWith("failure.txt")) throw new Error("original application failure");
            await writeFile(path, bytes);
          },

          /**
           * Fail restoration itself, independently of the application failure.
           * @param path - Artifact needing restoration.
           */
          async restore(path) {
            throw new Error(`injected restoration failure at ${path}`);
          },
        },
      }),
    ),
    /original application failure; rollback incomplete: existing.txt: injected restoration failure/,
  );

  assert.equal(await readFile(join(root, "existing.txt"), "utf8"), "after");
  await assert.rejects(requireStable(root), { code: "INCOMPLETE_GENERATION" });
  await assert.rejects(
    verifyRestored(root, async () => {}),
    /Stale/,
  );

  await writeFile(join(root, "existing.txt"), "before");
  await verifyRestored(root, async () => {});
});

test("newer rollback edits survive and retain explicit complete-set verification metadata", async (t) => {
  /** Isolated coordinated resource. */
  const root = await createBuildProject(t);

  await writeFile(join(root, "existing.txt"), "before");

  /** Prepared application, with two distinct operation boundaries. */
  const output = new Map([
    ["existing.txt", "after"],
    ["failure.txt", "fail"],
  ]);

  /** Pre-application fingerprints used to reject stale inputs. */
  const expected = await capturePaths([...output.keys()].map((path) => join(root, path)));

  await assert.rejects(
    withGuards([root], async ([owner]) =>
      applyArtifacts({
        root,
        output,
        expected,
        owner,
        operations: {
          /**
           * Simulate an editor changing an earlier write before application fails.
           * @param path - Destination path.
           * @param bytes - Replacement text.
           */
          replace: async (path, bytes) => {
            if (path.endsWith("failure.txt")) {
              await writeFile(join(root, "existing.txt"), "newer outside edit");
              throw new Error("injected failure");
            }

            await writeFile(path, bytes);
          },
        },
      }),
    ),
    /rollback incomplete.*newer edit preserved/,
  );

  assert.equal(await readFile(join(root, "existing.txt"), "utf8"), "newer outside edit");
  await assert.rejects(requireStable(root), { code: "INCOMPLETE_GENERATION" });
  await assert.rejects(
    verifyRestored(root, async () => {}),
    /Stale/,
  );

  await writeFile(join(root, "existing.txt"), "before");
  await verifyRestored(root, async () => {});
  assert.equal((await observeWriter(root)).marker, undefined);
});

test("prepared dependencies and destinations reject outside changes before writes", async (t) => {
  /** Prepared build remains separate from guarded application. */
  const root = await createBuildProject(t);

  /** Fully validated preparation retained for checking or coordinated application. */
  const prepared = await prepareBuild({ root, mode: "prod" });
  await writeFile(join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"), "{}");
  await assert.rejects(applyBuild(prepared), /Stale prepared input/);
  await assert.rejects(readFile(join(root, "themes/cassidy-dark-color-theme.json")), { code: "ENOENT" });
});

test("canonical resources contend and dead-owner release never certifies an incomplete generation", async (t) => {
  /** Isolated resource and complete pre-application verification set. */
  const root = await createBuildProject(t);

  /** Original filesystem state retained for mutation or restoration assertions. */
  const before = await capturePaths([join(root, "package.json")]);

  await withGuards([root], async ([owner]) => {
    await assert.rejects(
      withGuards([join(root, ".")], async () => {}),
      { code: "WRITER_BUSY" },
    );

    await writeFile(join(owner.directory, "incomplete.json"), JSON.stringify({ id: "interrupted", before }));
  });

  await assert.rejects(requireStable(root), { code: "INCOMPLETE_GENERATION" });
  await verifyRestored(root, async () => {});
  await requireStable(root);
});

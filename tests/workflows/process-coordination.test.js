/**
 * Native process coordination.
 * @file Verify canonical guards, interrupted-generation retention, and competing cache publication through explicit process barriers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fork } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { createBuildProject } from "../helpers/projects.js";
import { createUpstream } from "../helpers/upstream.js";
import { withGuards, requireStable, observeWriter, verifyRestored } from "../../tooling/shared/transactions.js";
import { createRetrieval, obtainSource } from "../../tooling/tokens/data/sources.js";

/**
 * Start an isolated native subprocess and wait for an explicit ready barrier.
 * @param t - Test cleanup context.
 * @param args - Literal probe arguments.
 */
async function probe(t, args) {
  /** Child has no release credentials or installed extension access. */
  const child = fork(new URL("../fixtures/process/writer.js", import.meta.url), args, {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  const errors = [];

  child.stderr.on("data", (chunk) => errors.push(chunk.toString()));
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });

  /** Early process failure must not leave a test waiting forever for an IPC message. */
  const ready = await Promise.race([
    once(child, "message").then(([message]) => message),
    once(child, "exit").then(([code]) => {
      throw new Error(`Probe exited ${code}: ${errors.join("")}`);
    }),
  ]);

  return { child, ready, errors };
}

test("separate processes cannot overlap the same canonical checkout guard", async (t) => {
  /** Actual child guard blocks even an alternate root spelling. */
  const root = await createBuildProject(t),
    { child } = await probe(t, ["guard", root]);

  await assert.rejects(
    withGuards([join(root, ".")], async () => {}),
    { code: "WRITER_BUSY" },
  );

  /** Install the exit listener before releasing the deterministic child barrier. */
  const exited = once(child, "exit");

  child.send("release");
  assert.equal((await exited)[0], 0);
  await withGuards([root], async () => {});
});

test("a dead process guard can be reclaimed without clearing interrupted-generation detection", async (t) => {
  /** Child exits while still owning the application marker and guard. */
  const root = await createBuildProject(t),
    { child } = await probe(t, ["abandon", root]);
  const exited = once(child, "exit");

  child.send("exit");
  await exited;
  await withGuards([root], async () => {});
  assert.equal((await observeWriter(root)).marker.id, "process-interrupted");
  await assert.rejects(requireStable(root), { code: "INCOMPLETE_GENERATION" });
  await verifyRestored(root, async () => {});
  await requireStable(root);
});

test("competing native cache publishers expose only verified completed entries and clean only owned staging", async (t) => {
  /** Independent process staging is held before either process may publish. */
  const root = await createBuildProject(t),
    upstream = await createUpstream(t);
  const first = await probe(t, ["cache", root, upstream.directory, upstream.revision]);
  const second = await probe(t, ["cache", root, upstream.directory, upstream.revision]);

  assert.notEqual(first.ready.staging, second.ready.staging);
  await assert.rejects(
    obtainSource({
      root,
      identity: { id: "vscode-stable", kind: "core", revision: upstream.revision },
      retrieval: createRetrieval({ policy: { requestMs: 30000, attempts: 3, totalMs: 300000 } }),
      replay: true,
    }),
    /Missing or corrupt recorded source/,
  );

  /** Exit listeners precede release so fast successful publication cannot race the assertions. */
  const completed = Promise.all([once(first.child, "exit"), once(second.child, "exit")]);

  first.child.send("publish");
  second.child.send("publish");
  assert.deepEqual(
    (await completed).map(([code]) => code),
    [0, 0],
  );
  assert.deepEqual(first.errors, []);
  assert.deepEqual(second.errors, []);
  assert.equal(
    (
      await obtainSource({
        root,
        identity: { id: "vscode-stable", kind: "core", revision: upstream.revision },
        retrieval: createRetrieval({ policy: { requestMs: 30000, attempts: 3, totalMs: 300000 } }),
        replay: true,
      })
    ).identity.revision,
    upstream.revision,
  );
});

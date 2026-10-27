/**
 * Native no-change recovery resumption.
 * @file Resume an idle native watcher after exact restored-set verification clears only external metadata.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter, once } from "node:events";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createBuildProject } from "../helpers/projects.js";
import { watchThemes } from "../../tooling/themes/watch.js";
import { withGuards, capturePaths } from "../../tooling/shared/transactions.js";
import { updateTokenDetails } from "../../tooling/tokens/data/update-details.js";

/**
 * Wait for an observed condition with event barriers, avoiding filesystem timing sleeps.
 * @param events - Watcher log events.
 * @param predicate - Current-state predicate.
 */
async function observed(events, predicate) {
  while (!predicate()) await once(events, "update");
}

test(
  "native watcher resumes once after verify-restored without another source write or timestamp change",
  { timeout: 15000 },
  async (t) => {
    /** All source, metadata, and installed-extension destinations remain inside a temporary project. */
    const root = await createBuildProject(t),
      events = new EventEmitter(),
      logs = [],
      errors = [];

    await mkdir(join(root, "images"));
    await writeFile(
      join(root, "src/token-data/upstream-sources.jsonc"),
      JSON.stringify({
        policy: "latest-stable",
        repository: "microsoft/vscode",
        supplementalMain: false,
        retrieval: { requestMs: 30000, attempts: 3, totalMs: 300000 },
        coverageExceptions: [],
      }),
    );

    /** Native watcher reports progress through explicit observable barriers. */
    const controller = watchThemes({
      root,
      extensionDirectory: join(root, "extension"),
      debounceMs: 5,
      recoveryMs: 20,
      logger: {
        log: (message = "") => {
          logs.push(message);
          events.emit("update");
        },
        error: (message) => {
          errors.push(message);
          events.emit("update");
        },
      },
    });

    t.after(() => controller.close());
    await controller.ready;
    assert.deepEqual(errors, []);

    /** Simulated interrupted updater stores fingerprints for its entire four-file affected set. */
    const affected = ["ui/details.jsonc", "semantic/details.jsonc", "syntax/details.jsonc", "upstream-sources.jsonc"];

    await withGuards([root], async ([owner]) => {
      /** Marker has no automatic replay data and does not modify source bytes. */
      const before = await capturePaths(affected.map((path) => join(root, "src/token-data", path)));

      await writeFile(
        join(owner.directory, "incomplete.json"),
        JSON.stringify({
          id: "native-recovery-fixture",
          pid: process.pid,
          operation: "token-details",
          before,
          recovery: "npm run update:token-details -- --recover=verify-restored",
        }),
      );
    });

    /** One native source event establishes the blocked state; recovery itself writes no source files. */
    const input = join(root, "src/themes/prod/default/metadata.jsonc");

    await writeFile(input, await readFile(input));
    await observed(events, () => errors.some((error) => error.includes("Incomplete generation")));
    await controller.whenIdle();

    /** Baseline source timestamp/bytes are observed after that triggering event. */
    const before = await stat(input),
      source = await readFile(input),
      count = logs.filter((line) => line.includes("[watch] Built")).length;

    await updateTokenDetails({ root, recover: "verify-restored" });
    await observed(events, () => logs.filter((line) => line.includes("[watch] Built")).length > count);
    await controller.whenIdle();
    assert.equal((await stat(input)).mtimeMs, before.mtimeMs);
    assert.deepEqual(await readFile(input), source);
    assert.equal(logs.filter((line) => line.includes("[watch] Built")).length, count + 1);
    assert.equal(errors.length, 1);
  },
);

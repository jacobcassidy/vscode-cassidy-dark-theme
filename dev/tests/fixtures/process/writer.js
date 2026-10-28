/**
 * Separate-process coordination probe.
 * @file Hold real guards or cache staging behind explicit IPC barriers for temporary-project integration tests.
 */

import { cp, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { join } from "node:path";
import { withGuards, capturePaths } from "../../../tooling/shared/transactions.js";
import { obtainSource, createRetrieval } from "../../../tooling/tokens/data/sources.js";

/** Probe mode and isolated resource arguments. */
const [mode, resource, upstream, revision] = process.argv.slice(2);

if (mode === "guard") {
  await withGuards([resource], async ([owner]) => {
    process.send({ ready: true, directory: owner.directory });
    await once(process, "message");
    process.send({ finished: true });
  });
} else if (mode === "abandon") {
  await withGuards([resource], async ([owner]) => {
    /** Complete pre-application verification set survives intentional writer exit. */
    const before = await capturePaths([join(resource, "package.json")]);

    await writeFile(
      join(owner.directory, "incomplete.json"),
      JSON.stringify({ id: "process-interrupted", pid: process.pid, before }),
    );

    process.send({ ready: true, directory: owner.directory });
    await once(process, "message");
    process.exit(0);
  });
} else if (mode === "cache") {
  await obtainSource({
    root: resource,
    identity: { id: "vscode-stable", kind: "core", revision },
    retrieval: createRetrieval({ policy: { requestMs: 30000, attempts: 3, totalMs: 300000 } }),

    /**
     * Hold completed source staging before publication until the parent releases the barrier.
     * @param path - This process's unique owned staging directory.
     */
    populate: async (path) => {
      await cp(upstream, path, { recursive: true });
      process.send({ ready: true, staging: path });
      await once(process, "message");
    },
  });

  process.send({ finished: true });
} else throw new Error(`Unknown process probe: ${mode}`);

process.disconnect();

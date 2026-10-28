/**
 * Shared token bootstrap destination guards.
 * @file Reject every occupied generated-layer path before upstream retrieval or theme writes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { lstat, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapTokenData } from "../../../tooling/tokens/data/bootstrap.js";

for (const kind of ["directory", "file", "symlink"]) {
  test(`bootstrap rejects an existing generated ${kind} before source retrieval`, async (t) => {
    /** Isolated checkout with only the occupied destination under test. */
    const root = await mkdtemp(join(tmpdir(), "cassidy-bootstrap-")),
      destination = join(root, "src/data/tokens/generated");

    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, "src/data/tokens"), { recursive: true });

    if (kind === "directory") await mkdir(destination);
    if (kind === "file") await writeFile(destination, "partial");
    if (kind === "symlink") await symlink(root, destination);

    await assert.rejects(bootstrapTokenData({ root }), /Bootstrap destination exists/);
    assert.ok(await lstat(destination));
  });
}

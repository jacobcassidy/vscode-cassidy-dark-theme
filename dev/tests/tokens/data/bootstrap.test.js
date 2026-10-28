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
import { starterTheme } from "../../../tooling/tokens/data/starter.js";

test("starter metadata retains the VS Code schema and package author", async (t) => {
  /** Minimal package fixture for an absent default theme. */
  const root = await mkdtemp(join(tmpdir(), "cassidy-starter-"));

  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "starter", displayName: "Starter Theme", author: { name: "Example Author" } }),
  );

  /** Prepared metadata must preserve editor schema tooling and package attribution. */
  const sources = await starterTheme(root),
    metadata = JSON.parse(sources.get("src/themes/prod/default/metadata.jsonc"));

  assert.equal(metadata.$schema, "vscode://schemas/color-theme");
  assert.equal(metadata.name, "Starter Theme");
  assert.equal(metadata.author, "Example Author");
});

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

/**
 * Distributable package boundaries.
 * @file Inspect the actual VSCE package inventory for required production assets and excluded development material.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { repositoryRoot } from "../../tooling/shared/paths.js";

/** Package-inventory CLI runner; this command does not publish or contact a registry. */
const run = promisify(execFile);

test("VSIX inventory contains production assets and excludes tooling, sources, tests, samples, preview, caches, and CI", async () => {
  /** Actual VSCE exclusion result, independently from ignore-file text assertions. */
  const result = await run(join(repositoryRoot, "node_modules/.bin/vsce"), ["ls"], { cwd: repositoryRoot });

  /** Relevant file paths or package entries retained for deterministic assertions. */
  const paths = result.stdout.trim().split(/\r?\n/);

  for (const path of [
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "themes/cassidy-dark-color-theme.json",
    "images/cassidy-dark-logo-512.png",
  ])
    assert.ok(paths.includes(path), path);

  for (const path of paths)
    assert.doesNotMatch(
      path,
      /^(?:src|dev|\.cache|\.vscode)\/|^(?:azure-.*\.yml|AGENTS\.md|eslint\.config\.js|prettier\.config\.js|playwright\.config\.js)$/,
    );
});

/**
 * Executable reachability audit fixtures.
 * @file Detect dead implementations, stale subprocess/configuration references, unresolved imports, and unjustified test-only exports.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { createBuildProject, writeFixture } from "../helpers/projects.js";
import { auditModules } from "../../tooling/maintenance/reachability.js";
import { checkReachability } from "../../tooling/maintenance/check-reachability.js";

/**
 * Build a small independent graph whose root is a supported CLI.
 * @param entries - Owned source entries.
 * @param [roots] - Explicit configuration/CLI roots.
 * @param [testRoots] - Executable test roots.
 */
function audit(entries, roots = ["scripts/cli.js"], testRoots = []) {
  return auditModules({ sources: new Map(entries), roots, testRoots });
}

test("unreachable implementation and unused exports fail while CLI/configuration roots remain valid", () => {
  /** Concrete imports consume only the named current public API. */
  const graph = [
    ["scripts/cli.js", 'import { current } from "../tooling/current.js"; current();'],
    ["tooling/current.js", "export function current() {}"],
    ["formatter.config.js", "export default {};"],
  ];

  assert.deepEqual(audit(graph, ["scripts/cli.js", "formatter.config.js"]), []);
  assert.match(
    audit(
      [...graph, ["tooling/hidden-obsolete.js", "export function abandoned() {}"]],
      ["scripts/cli.js", "formatter.config.js"],
    ).join("\n"),
    /Unreachable executable module.*hidden-obsolete/,
  );

  assert.match(
    audit([
      ["scripts/cli.js", 'import { current } from "../tooling/current.js";'],
      ["tooling/current.js", "export function current() {} export function obsolete() {}"],
    ]).join("\n"),
    /Unused production export.*obsolete/,
  );
});

test("literal dynamic imports and module-URL subprocess roots resolve; unresolved dynamic entry points fail", () => {
  /** A child executable has no ordinary importer and is still a declared concrete consumer. */
  const graph = [
    ["scripts/cli.js", 'await import("../tooling/current.js"); fork(new URL("../tooling/child.js", import.meta.url));'],
    ["tooling/current.js", "export const current = true;"],
    ["tooling/child.js", "console.log('child');"],
  ];

  assert.deepEqual(audit(graph), []);
  assert.match(audit([["scripts/cli.js", "await import(configuredPath);"]]).join("\n"), /unresolved dynamic import/);
  assert.match(
    audit([["scripts/cli.js", 'run(process.execPath, [join(root, "tooling/missing.js")]);']]).join("\n"),
    /missing executable reference/,
  );
});

test("tests alone cannot justify a superseded production module or export", () => {
  /** Runtime imports only the active symbol; a test imports the obsolete surface. */
  const graph = [
    ["scripts/cli.js", 'import { current } from "../tooling/current.js";'],
    ["tooling/current.js", "export function current() {} export function obsolete() {}"],
    ["tests/example.test.js", 'import { obsolete } from "../tooling/current.js";'],
  ];

  assert.match(
    audit(graph, ["scripts/cli.js"], ["tests/example.test.js"]).join("\n"),
    /Test-only production export needs review.*obsolete/,
  );
});

test("repository audit rejects missing configuration roots and unreachable executable files", async (t) => {
  /** Small project uses actual command configuration, without importing any production workflow. */
  const root = await createBuildProject(t);

  await writeFixture(join(root, "package.json"), '{"scripts":{"fixture":"node scripts/cli.js"}}');
  await writeFixture(join(root, "scripts/cli.js"), 'console.log("fixture");');
  await checkReachability({ root, configuration: [] });
  await writeFixture(join(root, "validation.yml"), "steps:\n  - script: node tooling/missing.js\n");
  await assert.rejects(
    checkReachability({ root, configuration: [] }),
    /Missing declared executable root.*tooling\/missing.js/,
  );

  await writeFixture(join(root, "validation.yml"), "steps: []\n");

  /** Owned source without any executable consumer must fail repository discovery. */
  const unused = join(root, "tooling/unused.js");

  await writeFixture(unused, "console.log('unused');");
  await assert.rejects(checkReachability({ root, configuration: [] }), /Unreachable executable module.*unused/);
});

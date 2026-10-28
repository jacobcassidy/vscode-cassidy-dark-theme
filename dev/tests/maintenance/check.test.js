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
function audit(entries, roots = ["dev/scripts/cli.js"], testRoots = []) {
  return auditModules({ sources: new Map(entries), roots, testRoots });
}

test("named/default imports and named re-exports must exist, including cyclic star barrels", () => {
  /** Valid star and renamed re-exports preserve their actual public binding names. */
  const graph = [
    ["dev/scripts/cli.js", 'import { renamed, current, tools } from "../tooling/barrel.js";'],
    [
      "dev/tooling/barrel.js",
      'export { current as renamed } from "./current.js"; export * from "./cycle.js"; export * as tools from "./current.js";',
    ],
    ["dev/tooling/cycle.js", 'export * from "./barrel.js"; export * from "./current.js";'],
    ["dev/tooling/current.js", "export const current = true;"],
  ];

  assert.deepEqual(audit(graph), []);
  graph[0][1] = 'import { missing } from "../tooling/barrel.js";';
  assert.match(audit(graph).join("\n"), /missing export missing from dev\/tooling\/barrel.js/);
  graph[0][1] = 'import missing from "../tooling/barrel.js";';
  assert.match(audit(graph).join("\n"), /missing export default/);
  graph[1][1] = 'export { absent as renamed } from "./current.js";';
  assert.match(audit(graph).join("\n"), /missing export absent from dev\/tooling\/current.js/);
  assert.deepEqual(
    audit([
      ["dev/scripts/cli.js", 'import current from "../tooling/current.js";'],
      ["dev/tooling/current.js", "export default true;"],
    ]),
    [],
  );
});

test("unreachable implementation and unused exports fail while CLI/configuration roots remain valid", () => {
  /** Concrete imports consume only the named current public API. */
  const graph = [
    ["dev/scripts/cli.js", 'import { current } from "../tooling/current.js"; current();'],
    ["dev/tooling/current.js", "export function current() {}"],
    ["formatter.config.js", "export default {};"],
  ];

  assert.deepEqual(audit(graph, ["dev/scripts/cli.js", "formatter.config.js"]), []);
  assert.match(
    audit(
      [...graph, ["dev/tooling/hidden-obsolete.js", "export function abandoned() {}"]],
      ["dev/scripts/cli.js", "formatter.config.js"],
    ).join("\n"),
    /Unreachable executable module.*hidden-obsolete/,
  );

  assert.match(
    audit([
      ["dev/scripts/cli.js", 'import { current } from "../tooling/current.js";'],
      ["dev/tooling/current.js", "export function current() {} export function obsolete() {}"],
    ]).join("\n"),
    /Unused production export.*obsolete/,
  );
});

test("literal dynamic imports and module-URL subprocess roots resolve; unresolved dynamic entry points fail", () => {
  /** A child executable has no ordinary importer and is still a declared concrete consumer. */
  const graph = [
    [
      "dev/scripts/cli.js",
      'await import("../tooling/current.js"); fork(new URL("../tooling/child.js", import.meta.url));',
    ],
    ["dev/tooling/current.js", "export const current = true;"],
    ["dev/tooling/child.js", "console.log('child');"],
  ];

  assert.deepEqual(audit(graph), []);
  assert.match(
    audit([["dev/scripts/cli.js", "await import(configuredPath);"]]).join("\n"),
    /unresolved dynamic import/,
  );
  assert.match(
    audit([["dev/scripts/cli.js", 'run(process.execPath, [join(root, "dev/tooling/missing.js")]);']]).join("\n"),
    /missing executable reference/,
  );
});

test("tests alone cannot justify a superseded production module or export", () => {
  /** Runtime imports only the active symbol; a test imports the obsolete surface. */
  const graph = [
    ["dev/scripts/cli.js", 'import { current } from "../tooling/current.js";'],
    ["dev/tooling/current.js", "export function current() {} export function obsolete() {}"],
    ["dev/tests/example.test.js", 'import { obsolete } from "../tooling/current.js";'],
  ];

  assert.match(
    audit(graph, ["dev/scripts/cli.js"], ["dev/tests/example.test.js"]).join("\n"),
    /Test-only production export needs review.*obsolete/,
  );
});

test("repository audit rejects missing configuration roots and unreachable executable files", async (t) => {
  /** Small project uses actual command configuration, without importing any production workflow. */
  const root = await createBuildProject(t);

  await writeFixture(join(root, "package.json"), '{"scripts":{"fixture":"node dev/scripts/cli.js"}}');
  await writeFixture(join(root, "dev/scripts/cli.js"), 'console.log("fixture");');
  await checkReachability({ root, configuration: [] });
  await writeFixture(join(root, "validation.yml"), "steps:\n  - script: node dev/tooling/missing.js\n");
  await assert.rejects(
    checkReachability({ root, configuration: [] }),
    /Missing declared executable root.*tooling\/missing.js/,
  );

  await writeFixture(join(root, "validation.yml"), "steps: []\n");

  /** Owned source without any executable consumer must fail repository discovery. */
  const unused = join(root, "dev/tooling/unused.js");

  await writeFixture(unused, "console.log('unused');");
  await assert.rejects(checkReachability({ root, configuration: [] }), /Unreachable executable module.*unused/);
});

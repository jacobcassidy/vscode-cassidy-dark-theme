/**
 * Shared token bootstrap destination guards.
 * @file Reject every occupied generated-layer path before upstream retrieval or theme writes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { cp, lstat, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapTokenData } from "../../../tooling/tokens/data/bootstrap.js";
import { completeStarterTheme, starterTheme } from "../../../tooling/tokens/data/starter.js";
import { parseFormat } from "../../../tooling/tokens/formats.js";

test("bootstrap CLI shows unresolved registrations only with --debug", async (t) => {
  /** Isolated CLI fixture supplies a fixed bootstrap result without upstream retrieval or writes. */
  const root = await mkdtemp(join(tmpdir(), "cassidy-bootstrap-cli-"));

  t.after(() => rm(root, { recursive: true, force: true }));

  for (const directory of ["dev/scripts/themes", "dev/tooling/shared", "dev/tooling/tokens/data"])
    await mkdir(join(root, directory), { recursive: true });

  for (const path of [
    "scripts/themes/bootstrap.js",
    "tooling/shared/terminal-progress.js",
    "tooling/shared/terminal-output.js",
  ])
    await cp(new URL(`../../../${path}`, import.meta.url), join(root, "dev", path));

  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(
    join(root, "dev/tooling/shared/paths.js"),
    `/**
 * Bootstrap fixture paths.
 * @file Supply the isolated CLI root.
 */
/** Fixed root unused by the stub bootstrap operation. */
export const repositoryRoot = ".";
`,
  );
  await writeFile(
    join(root, "dev/tooling/tokens/data/bootstrap.js"),
    `/**
 * Bootstrap result fixture.
 * @file Return deterministic unresolved registration diagnostics.
 */
/** Return the prepared diagnostic without accessing upstream data. */
export async function bootstrapTokenData() {
  return { changed: ["fixture"], warnings: ["vscode-stable\\tcolors.ts\\t10:3\\tregisterColor ID expression id: unresolved dynamic registration"] };
}
`,
  );

  /** Execute the actual command wrapper with stdout/stderr captured independently. */
  const run = promisify(execFile);

  for (const args of [[], ["--debug"]]) {
    /** The command keeps ordinary stage feedback in both modes. */
    const { stdout, stderr } = await run(process.execPath, [join(root, "dev/scripts/themes/bootstrap.js"), ...args]);

    assert.match(stdout, /Generated 1 source files/);
    assert.match(stderr, /Bootstrapping shared token data/);

    if (args.length) assert.match(stderr, /vscode-stable:[\s\S]* {2}colors.ts:[\s\S]* {4}10:3: registerColor/);
    else assert.doesNotMatch(stderr, /vscode-stable|unresolved dynamic registration/);
  }
});

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

  /** Full standard palette configuration survives even before registration extraction. */
  const paletteSource = sources.get("src/themes/prod/default/palette/config.jsonc"),
    palette = JSON.parse(paletteSource);

  assert.equal(Object.keys(palette.families).length, 8);
  assert.equal(Object.keys(palette.neutrals).length, 23);
  assert.ok(paletteSource.indexOf('"000": 0.98') < paletteSource.indexOf('"100": 0.9'));

  /** One authored alias supplies the conspicuous unresolved color for every starter token. */
  const variables = JSON.parse(sources.get("src/themes/prod/default/tokens/variables/definitions.jsonc")),
    variableDetails = JSON.parse(sources.get("src/themes/prod/default/tokens/variables/details.jsonc")),
    syntax = JSON.parse(sources.get("src/themes/prod/default/tokens/syntax/definitions.jsonc"));

  assert.equal(variables.default.placeholder.color, "#f0f");
  assert.match(variables.default.placeholder.colorReason, /Review this selector/);
  assert.match(variableDetails.default.placeholder.description, /Placeholder color/);
  assert.equal(variables.default.background.color, "palette.gray.900");
  assert.equal(variables.default.foreground.color, "palette.gray.200");
  assert.equal(variables.diagnostic["error.foreground"].color, "palette.red.500");
  assert.equal(variables.diagnostic["warning.foreground"].color, "palette.orange.500");
  assert.equal(variables.diff["added.foreground"].color, "palette.green.400");
  assert.equal(variables.diff["removed.foreground"].color, "palette.red.400");
  assert.equal(syntax.standard.rules[0].color, "variables.default.placeholder");
  assert.equal(syntax.standard.rules[0].colorReason, undefined);
});

test("starter completion creates every standard UI and semantic definition with matching details", async (t) => {
  /** Small verified inventory with a parent UI color, modifier, and nonstandard exclusion. */
  const root = await mkdtemp(join(tmpdir(), "cassidy-starter-"));

  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "starter" }));

  /**
   * Build one normalized record for the tiny shared-data fixture.
   * @param category - Accepted token category.
   * @param description - Verified token purpose.
   */
  function record(category, description) {
    return { category, value: { description } };
  }

  /** Representative mapped variables and fallback tokens exercise every starter role. */
  const uiColors = new Map([
    ["editor", "variables.default.placeholder"],
    ["editor.background", "variables.default.background"],
    ["editor.foreground", "variables.default.placeholder"],
    ["foreground", "variables.default.foreground"],
    ["errorForeground", "variables.diagnostic.error.foreground"],
    ["editorWarning.foreground", "variables.diagnostic.warning.foreground"],
    ["diffEditorOverview.insertedForeground", "variables.diff.added.foreground"],
    ["diffEditorOverview.removedForeground", "variables.diff.removed.foreground"],
  ]);

  /** Exact category authority and description records used by completion. */
  const snapshot = {
    definitions: {
      ui: {
        records: new Map([
          ...[...uiColors.keys()].map((id) => [id, record("standard", `Purpose of ${id}.`)]),
          ["custom.color", record("nonStandard", "Custom")],
        ]),
      },
      semantic: {
        records: new Map([
          ["variable", record("standard", "Variable")],
          ["*.readonly", record("standard", "Read only")],
          ["obsolete", record("deprecated", "Obsolete")],
        ]),
      },
    },
    details: {
      ui: {
        records: new Map([
          ...[...uiColors.keys()].map((id) => [id, record("standard", `Purpose of ${id}.`)]),
        ]),
      },
      semantic: {
        records: new Map([
          ["variable", record("standard", "Variable")],
          ["*.readonly", record("standard", "Read only")],
        ]),
      },
    },
  };

  /** Complete source candidates must decode to exact standard membership. */
  const sources = completeStarterTheme(await starterTheme(root), snapshot),
    prefix = "src/themes/prod/default/tokens/";

  for (const [family, expected] of [
    ["ui", [...uiColors.keys()].sort()],
    ["semantic", ["*.readonly", "variable"]],
  ]) {
    for (const kind of ["definitions", "details"]) {
      /** Prepared source and normalized records for this family and file role. */
      const path = `${prefix}${family}/${kind}.jsonc`,
        decoded = parseFormat(sources.get(path), path, family, kind);

      assert.deepEqual([...decoded.records.keys()].sort(), expected);
      assert.ok([...decoded.records.values()].every((entry) => entry.category === "standard"));

      if (kind === "definitions")
        for (const entry of decoded.records.values()) {
          assert.equal(entry.value.color, family === "ui" ? uiColors.get(entry.id) : "variables.default.placeholder");
          assert.equal(entry.value.colorReason, undefined);
        }
    }
  }
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

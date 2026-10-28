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
import { completeStarterTheme, starterTheme } from "../../../tooling/tokens/data/starter.js";
import { parseFormat } from "../../../tooling/tokens/formats.js";

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

  assert.equal(variables.placeholder.color, "#f0f");
  assert.match(variableDetails.placeholder.description, /Placeholder color/);
  assert.equal(syntax.standard.rules[0].color, "variables.placeholder");
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

  /** Exact category authority and description records used by completion. */
  const snapshot = {
    definitions: {
      ui: {
        records: new Map([
          ["editor", record("standard", "Editor root")],
          ["editor.background", record("standard", "Editor background")],
          ["editor.foreground", record("standard", "Editor foreground")],
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
          ["editor", record("standard", "Editor root")],
          ["editor.background", record("standard", "Editor background")],
          ["editor.foreground", record("standard", "Editor foreground")],
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
    ["ui", ["editor", "editor.background", "editor.foreground"]],
    ["semantic", ["*.readonly", "variable"]],
  ]) {
    for (const kind of ["definitions", "details"]) {
      const path = `${prefix}${family}/${kind}.jsonc`,
        decoded = parseFormat(sources.get(path), path, family, kind);

      assert.deepEqual([...decoded.records.keys()].sort(), expected);
      assert.ok([...decoded.records.values()].every((entry) => entry.category === "standard"));

      if (kind === "definitions")
        for (const entry of decoded.records.values()) {
          assert.equal(entry.value.color, "variables.placeholder");
          assert.equal(entry.value.colorReason, "Default bootstrap value. Review this selector before publication");
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

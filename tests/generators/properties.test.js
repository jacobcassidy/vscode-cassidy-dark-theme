/**
 * Nested property generation.
 * @file Verify selective inventory additions, documentation protection, scope matching, idempotence, and pre-write validation.
 */

import { buildFixture as buildThemes } from "../helpers/builds.js";
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createBuildProject, writeFixture, readBuildOutputs, writeDefaultPaletteConfig } from "../helpers/projects.js";
import { addThemeProperties } from "../../tooling/generators/add-properties.js";
import { loadTokenData } from "../../tooling/tokens/data/load.js";
import { parseFormat } from "../../tooling/tokens/formats.js";

/**
 * Read a final-format fixture family without assuming its physical nesting.
 * @param root - Temporary root.
 * @param family - Token family.
 * @param kind - definitions or details.
 * @param [theme] - Selected group/name.
 */
async function family(root, family, kind, theme = "prod/default") {
  /** Exact input file and parsed final format. */
  const path = `src/themes/${theme}/tokens/${family}/${kind}.jsonc`;
  return parseFormat(await readFile(join(root, path), "utf8"), path, family, kind);
}

test("nested property addition preserves styles, disabled entries, parent records, comments, and reviewed details", async (t) => {
  /** Explicit authorities are independent of the authored file being validated. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/token-data/ui/definitions.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"testing": {"iconFailed": {"color":"#0ff","colorReason":"UNREVIEWED: Added from a token template; choose an intentional color.","retired": {"color":"#0ff","colorReason":"UNREVIEWED: Added from a token template; choose an intentional color."}}},"zeta": {"foreground": {"color":"#0ff","colorReason":"UNREVIEWED: Added from a token template; choose an intentional color."}}},"deprecated":{}}',
  );

  await writeFixture(
    join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"testing":{"iconFailed":{/* Parent explanation. */"disabled":true,"disabledReason":"Retain the upstream fallback."}},"editor":{"background":{"color":"variables.surface.editor"},"foreground":{"color":"syntax.string"}}},"deprecated":{}}',
  );

  await writeFixture(
    join(root, "src/themes/prod/default/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"editor": {"background": {"description":"My wording.","inherits":["widget.background"]}}},"deprecated":{}}',
  );

  /** First generation fills only missing records and descriptions. */
  const updates = await addThemeProperties({ root, themes: ["prod/default"] });

  /** Normalized definitions retained independently from matching documentation. */
  const definitions = await family(root, "ui", "definitions");

  /** Normalized documentation records retained separately from styling. */
  const details = await family(root, "ui", "details");

  assert.deepEqual(updates.find((update) => update.section === "ui").added, [
    "testing.iconFailed.retired",
    "zeta.foreground",
  ]);

  assert.equal(definitions.value["testing.iconFailed"].disabled, true);
  assert.equal(definitions.value["testing.iconFailed.retired"].color, "#0ff");
  assert.equal(definitions.value["editor.background"].color, "variables.surface.editor");
  assert.equal(details.value["editor.background"].description, "My wording.");
  assert.deepEqual([...details.value["editor.background"].inherits], ["widget.background"]);
  assert.match(definitions.input.source, /Parent explanation/);
  assert.equal(
    (await addThemeProperties({ root, themes: ["prod/default"] })).flatMap((update) => update.added).length,
    0,
  );

  await buildThemes({ root });
});

test("shared descriptions copy history and usage without shared flags, while theme wording stays authored", async (t) => {
  /** Shared definition and detail metadata supplied separately from the theme. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/token-data/ui/definitions.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"new": {"foreground": {"color":"#0ff","colorReason":"UNREVIEWED: Added from a token template; choose an intentional color."}}},"deprecated":{}}',
  );
  await writeFixture(
    join(root, "src/token-data/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"new": {"foreground": {"description":"Shared purpose.","modified-desc":true,"descriptionAddedIn":"1.2.3","descriptionUpdatedIn":"1.2.3","descriptionBasedOn":"1.2.3","use":"When the verified fixture provider is active."}}},"deprecated":{}}',
  );

  await addThemeProperties({ root, themes: ["prod/default"] });

  /** Generated documentation carries only eligible metadata. */
  const copied = (await family(root, "ui", "details")).value["new.foreground"];

  assert.equal(copied.description, "Shared purpose.");
  assert.equal(copied.descriptionAddedIn, "1.2.3");
  assert.equal(copied.descriptionUpdatedIn, undefined);
  assert.equal(copied["modified-desc"], undefined);
  assert.match(copied.use, /provider/);

  await writeFixture(
    join(root, "src/themes/prod/default/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"new": {"foreground": {"description":"Theme adaptation.","descriptionBasedOn":"1.2.3"}}},"deprecated":{}}',
  );

  await addThemeProperties({ root, themes: ["prod/default"] });
  assert.equal((await family(root, "ui", "details")).value["new.foreground"].description, "Theme adaptation.");
  assert.equal((await loadTokenData({ root })).details.ui.value["new.foreground"]["modified-desc"], true);
});

test("required syntax IDs remain stable, keep scope/order, and avoid collisions", async (t) => {
  /** Unnamed default rules require explicit ID assignment by the generator. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/themes/prod/default/tokens/syntax/definitions.jsonc"),
    '{"standard":{"rules":[{"id":"string","scope":"string","color":"palette.yellow.400","order":0},{"name":"String","scope":["first","second"],"fontStyle":"bold","order":1},{"name":"String","scope":"third","order":2}]},"sourceCode":{"rules":[]},"nonStandard":{"rules":[]},"deprecated":{"rules":[]}}',
  );

  await addThemeProperties({ root, themes: ["prod/default"] });

  /** Normalized rule order remains identical across explicit ID assignment. */
  const rules = (await family(root, "syntax", "definitions")).value;

  assert.deepEqual(
    rules.map((rule) => rule.id),
    ["string", "string-2", "string-3"],
  );

  assert.deepEqual([...rules[1].scope], ["first", "second"]);
  assert.equal(
    (await addThemeProperties({ root, themes: ["prod/default"] })).flatMap((update) => update.added).length,
    0,
  );
});

test("selected fallback targets receive local additions without modifying their fallback owner", async (t) => {
  /** An inheriting target intentionally has no family files. */
  const root = await createBuildProject(t);

  await writeDefaultPaletteConfig(join(root, "src/themes/dev/selected"));
  await writeDefaultPaletteConfig(join(root, "src/themes/dev/untouched"));
  await writeFixture(
    join(root, "src/token-data/ui/definitions.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"new": {"background": {"color":"#0ff","colorReason":"UNREVIEWED: Added from a token template; choose an intentional color."}}},"deprecated":{}}',
  );

  /** Original production input stays byte-identical. */
  const path = join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"),
    before = await readFile(path, "utf8");

  await addThemeProperties({ root, themes: ["dev/selected"] });
  assert.equal(await readFile(path, "utf8"), before);
  assert.equal((await family(root, "ui", "definitions", "dev/selected")).value["new.background"].color, "#0ff");
  await assert.rejects(readFile(join(root, "src/themes/dev/untouched/tokens/ui/definitions.jsonc")), {
    code: "ENOENT",
  });
});

test("all selected candidates validate before source or artifact writes", async (t) => {
  /** Existing artifacts make partial publication detectable. */
  const root = await createBuildProject(t);

  await buildThemes({ root });
  await writeDefaultPaletteConfig(join(root, "src/themes/dev/broken"));
  await writeFixture(
    join(root, "src/themes/dev/broken/tokens/ui/definitions.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"bad": {"foreground": {"color":"missing.alias"}}},"deprecated":{}}',
  );

  await writeFixture(
    join(root, "src/themes/dev/broken/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{},"deprecated":{}}',
  );

  /** Earlier valid candidates must never be applied when a later input fails. */
  const path = join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"),
    before = await readFile(path, "utf8");

  /** Original generated artifact bytes retained to detect partial application. */
  const artifacts = await readBuildOutputs(root);

  await assert.rejects(addThemeProperties({ root, themes: ["prod/default", "dev/broken"] }), /Unknown reference/);
  assert.equal(await readFile(path, "utf8"), before);
  assert.deepEqual(await readBuildOutputs(root), artifacts);
  await assert.rejects(addThemeProperties({ root, themes: ["dev/unknown"] }), /known group\/name/);
});

test("filling a missing purpose preserves interior comments and theme-reviewed relationships", async (t) => {
  /** Shared relationships deliberately differ from the theme's reviewed documentation. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/token-data/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"editor": {"background": {"description":"Shared purpose.","inherits":["shared.review"]}}},"deprecated":{}}',
  );

  await writeFixture(
    join(root, "src/themes/prod/default/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"editor":{"background":{/* Preserve this review. */"inherits":["theme.review"]}}},"deprecated":{}}',
  );

  await addThemeProperties({ root, themes: ["prod/default"] });

  /** Record-level field insertion must retain all existing branch/comment spans. */
  const details = await family(root, "ui", "details");

  assert.deepEqual([...details.value["editor.background"].inherits], ["theme.review"]);
  assert.match(details.input.source, /Preserve this review/);
  assert.equal(details.value["editor.background"].description, "Shared purpose.");
});

test("same-ID scope variants get local scope-derived details while preserving the default reference", async (t) => {
  /** A dev syntax override intentionally no longer matches inherited reference wording. */
  const root = await createBuildProject(t);

  await writeDefaultPaletteConfig(join(root, "src/themes/dev/variant"));
  await writeFixture(
    join(root, "src/themes/dev/variant/tokens/syntax/definitions.jsonc"),
    '{"standard":{"rules":[{"id":"string","scope":"custom.scope","color":"#010203","colorReason":"Isolated scope variant.","order":0}]},"sourceCode":{"rules":[]},"nonStandard":{"rules":[]},"deprecated":{"rules":[]}}',
  );

  /** Default reference bytes are independently protected from the explicit generator operation. */
  const defaultPath = join(root, "src/themes/prod/default/tokens/syntax/details.jsonc"),
    before = await readFile(defaultPath, "utf8");

  await assert.rejects(buildThemes({ root }), /inherited syntax details.*do not match effective scopes/);
  await addThemeProperties({ root, themes: ["dev/variant"] });
  assert.match((await family(root, "syntax", "details", "dev/variant")).value.string.description, /custom.scope/);
  assert.equal(await readFile(defaultPath, "utf8"), before);
  await buildThemes({ root });
});

/**
 * Categorized format contracts.
 * @file Check canonical identities, source diagnostics, schema agreement, membership, metadata, and scope-based classifications.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import Ajv from "ajv";
import { categories, decode, parseFormat, semanticPath, semanticId } from "../../tooling/tokens/formats.js";
import { loadTokenData } from "../../tooling/tokens/data/load.js";
import { validateCategories } from "../../tooling/tokens/category-validation.js";
import { emptyFamily } from "../../tooling/generators/source-edits.js";
import { createBuildProject, writeFixture } from "../helpers/projects.js";
import { prepareBuild } from "../../tooling/themes/build.js";

/**
 * Build explicit categorized test data without deriving authorities from tokens.
 * @param category - Selected root category.
 * @param values - Supplied nested content.
 */
function categorized(category, values) {
  return { ...emptyFamily("ui", "details"), [category]: values };
}

test("shared inventory arrays preserve exact UI and semantic IDs without styling metadata", async () => {
  /** Shared inventories use independent editor schemas alongside the runtime codec. */
  const ajv = new Ajv({ strict: false });

  for (const [family, category, accepted, rejected] of [
    [
      "ui",
      { testing: ["iconFailed"], "testing.iconFailed": ["retired"] },
      ["testing.iconFailed", "testing.iconFailed.retired"],
      [
        { testing: { iconFailed: { $token: true } } },
        {},
        { testing: [] },
        { testing: ["iconFailed", "iconFailed"] },
        { "bad group": ["foreground"] },
        { testing: ["bad property"] },
      ],
    ],
    [
      "semantic",
      ["variable", "variable.readonly:typescript"],
      ["variable", "variable.readonly:typescript"],
      [["variable", "variable"], ["bad selector"], { variable: { $token: true } }],
    ],
  ]) {
    /** Per-family schema validates the same explicit membership contract as the codec. */
    const schema = JSON.parse(
      await readFile(new URL(`../../tooling/tokens/schemas/shared-${family}-definitions.schema.json`, import.meta.url)),
    );

    /** Compiled editor schema for the current inventory family. */
    const validate = ajv.compile(schema);

    /** Current array format has no per-token marker or usage fields. */
    const value = { ...emptyFamily(family, "definitions", true), standard: category };

    assert.equal(validate(value), true, `${family}: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual([...decode({ value }, family, "definitions", { shared: true }).records.keys()], accepted);

    for (const invalid of rejected) {
      /** Rejected shape replaces only one category in an otherwise valid inventory. */
      const candidate = { ...value, standard: invalid };

      assert.equal(validate(candidate), false, `${family}: ${JSON.stringify(invalid)}`);
      assert.throws(() => decode({ value: candidate }, family, "definitions", { shared: true }));
    }
  }
});

for (const [id, path] of [
  ["parameter", ["parameter", "default"]],
  ["*.builtin.deprecated", ["*", "builtin.deprecated"]],
  ["variable.readonly:typescript", ["variable:typescript", "readonly"]],
  ["variable:typescript", ["variable:typescript", "default"]],
]) {
  test(`semantic selector ${id} round-trips exactly`, () => {
    assert.deepEqual(semanticPath(id), path);
    assert.equal(semanticId(...path), id);
  });
}

test("UI parent/child records both survive and canonical duplicates retain exact source origins", () => {
  /** Parent record shares a branch with a real child record. */
  const value = categorized("standard", {
    testing: { iconFailed: { description: "Parent.", retired: { description: "Child." } } },
  });

  /** Normalized family records with canonical identities and source origins. */
  const decoded = decode({ value, label: "fixture.jsonc" }, "ui", "details");

  assert.deepEqual([...decoded.records.keys()], ["testing.iconFailed", "testing.iconFailed.retired"]);
  value.nonStandard = value.standard;
  assert.throws(
    () => parseFormat(JSON.stringify(value, null, 2), "fixture.jsonc", "ui", "details"),
    /fixture.jsonc:\d+:\d+.*duplicate canonical.*testing.iconFailed.*first at/,
  );

  assert.throws(
    () =>
      decode(
        { value: categorized("standard", { a: { color: "#fff", disabled: { color: "#000" } } }) },
        "ui",
        "definitions",
      ),
    /reserved record field\/child-name collision/,
  );

  assert.throws(() => semanticPath("variable.default"), /reserved unmodified selector/);
});

for (const [record, shared, accepted] of [
  [{ description: "Text." }, false, true],
  [{ description: "Text.", "modified-desc": true }, true, true],
  [{ description: "Text.", "modified-desc": true }, false, false],
  [{ description: "Text.", "modified-desc": "true" }, true, false],
  [{ description: "", "modified-desc": true }, true, false],
  [{ description: "Text.", descriptionAddedIn: "1.2.3", descriptionUpdatedIn: "1.2.2" }, true, false],
  [{ description: "Text.", descriptionBasedOn: "unknown" }, false, false],
  [{ description: "Text.", source: "upstream" }, true, false],
  [{ description: "Text.", use: " " }, true, false],
]) {
  test(`detail validation ${JSON.stringify(record)} shared=${shared}`, () => {
    /** Independent record input covers a genuine accepted or rejected contract. */
    const run = () =>
      decode(
        { value: categorized("nonStandard", { widget: { foreground: record } }), label: "details.jsonc" },
        "ui",
        "details",
        { shared },
      );

    if (accepted) assert.doesNotThrow(run);
    else assert.throws(run, /details.jsonc/);
  });
}

test("syntax order merges categories globally and rejects missing, fractional, negative, and duplicate values", () => {
  /** Category placement deliberately differs from rule precedence. */
  const value = emptyFamily("syntax", "definitions");

  value.standard.rules.push({ id: "last", order: 2, scope: "last" });
  value.nonStandard.rules.push({ id: "first", order: 0, scope: ["first", "ordinary"] });
  assert.deepEqual(
    decode({ value }, "syntax", "definitions").value.map((rule) => rule.id),
    ["first", "last"],
  );

  for (const order of [undefined, -1, 0.5, 2]) {
    value.nonStandard.rules[0].order = order;
    assert.throws(() => decode({ value }, "syntax", "definitions"), /syntax order/);
  }
});

test("independent exact authorities reject disabled standard impostors and definition/detail conflicts", async (t) => {
  /** Independent fixture authority contains editor.background and no other standard entry. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/data/tokens/ui/definitions.jsonc"),
    JSON.stringify({ ...emptyFamily("ui", "definitions", true), standard: { editor: ["background"] } }),
  );

  await writeFixture(
    join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"),
    JSON.stringify(
      categorized("standard", { widget: { unknownBackground: { disabled: true, disabledReason: "Retained." } } }),
    ),
  );

  await assert.rejects(
    prepareBuild({ root }),
    /widget.unknownBackground.*standard.*nonStandard.*src\/data\/tokens\/ui\/definitions.jsonc.*no exact standard definition membership/,
  );

  await writeFixture(
    join(root, "src/data/tokens/ui/details.jsonc"),
    JSON.stringify(categorized("nonStandard", { editor: { background: { description: "Conflict." } } })),
  );

  await assert.rejects(loadTokenData({ root }), /editor.background.*conflicting category.*expected standard/);
});

test("scope evidence is immutable, exact, independent of IDs, and rejects contributor conflicts", async (t) => {
  /** Reviewed scope has a concrete immutable contributor identity. */
  const root = await createBuildProject(t);

  /** Explicit immutable contributor/scope evidence independent from the candidate rule. */
  const evidence = {
    selector: "extension.special",
    category: "nonStandard",
    extensionId: "fixture.extension",
    inputId: "fixture",
    revision: "a".repeat(40),
    path: "syntaxes/fixture.json",
  };

  await writeFixture(
    join(root, "src/data/tokens/syntax/details.jsonc"),
    JSON.stringify(
      categorized("nonStandard", {
        reference: { description: "Extension scope.", scopeEvidence: { scopes: [evidence] } },
      }),
    ),
  );

  /** Same ID has independent scope-based categories across themes. */
  const snapshot = await loadTokenData({ root });

  /** Normalized definitions retained independently from matching documentation. */
  const definitions = decode(
    {
      value: {
        ...emptyFamily("syntax", "definitions"),
        nonStandard: { rules: [{ id: "string", order: 0, scope: ["ordinary", "extension.special"] }] },
      },
    },
    "syntax",
    "definitions",
  );

  /** Normalized documentation records retained separately from styling. */
  const details = decode(
    { value: categorized("nonStandard", { string: { description: "Mixed rule." } }) },
    "syntax",
    "details",
  );

  /** Independently supplied effective definitions and matching details. */
  const families = {
    definitions: { ui: { records: new Map() }, semantic: { records: new Map() }, syntax: definitions },
    details: { ui: { records: new Map() }, semantic: { records: new Map() }, syntax: details },
  };

  assert.doesNotThrow(() => validateCategories(families, snapshot, "dev/extension"));
  definitions.records.get("string").value.scope = "unknown.compound scope";
  assert.throws(() => validateCategories(families, snapshot, "dev/extension"), /expected "standard"/);
  await writeFixture(
    join(root, "src/data/tokens/syntax/details.jsonc"),
    JSON.stringify(
      categorized("nonStandard", {
        reference: { description: "One.", scopeEvidence: { scopes: [evidence] } },
        other: {
          description: "Two.",
          scopeEvidence: { scopes: [{ ...evidence, extensionId: "different.extension" }] },
        },
      }),
    ),
  );

  await assert.rejects(loadTokenData({ root }), /Conflicting scope evidence.*extension.special.*reference.*other/);
});

test("all checked-in authored/shared token files satisfy their associated local schemas and codec", async () => {
  /** Local-only schema validator uses bundled draft metadata and never downloads schemas. */
  const ajv = new Ajv({ strict: false });

  for (const path of await readdir(new URL("../../../src/", import.meta.url), { recursive: true })) {
    /** Only final token family inputs participate in this structural agreement check. */
    const match = path.match(
      /(?:themes\/[^/]+\/[^/]+\/tokens|data\/tokens)\/(variables|ui|semantic|syntax)\/(definitions|details)\.jsonc$/,
    );

    if (!match) continue;

    /** Schema role is selected independently from file contents. */
    const [, family, kind] = match,
      shared = path.startsWith("data/tokens/");

    /** Local schema role selected from the final family filename. */
    const schemaName = `${family === "variables" ? "" : shared ? "shared-" : "theme-"}${family}-${kind}`;

    /** Parsed local editor schema, requiring no remote resolution. */
    const schema = JSON.parse(
      await readFile(new URL(`../../tooling/tokens/schemas/${schemaName}.schema.json`, import.meta.url)),
    );

    /** Normalized family records with canonical identities and source origins. */
    const decoded = parseFormat(
      await readFile(new URL(`../../../src/${path}`, import.meta.url), "utf8"),
      path,
      family,
      kind,
      { shared },
    );

    /** Compiled local schema validator used alongside the source codec. */
    const validate = ajv.compile(schema);
    assert.equal(validate(decoded.input.value), true, `${path}: ${JSON.stringify(validate.errors)}`);
  }

  assert.deepEqual(categories, ["standard", "sourceCode", "nonStandard", "deprecated"]);
});

test("classification projection ignores documentation/history/key order and retains reference scope coverage", async (t) => {
  /** Accepted membership is supplied independently of subsequent documentation changes. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/data/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"fixture": {"foreground": {"description":"Original."}}},"deprecated":{}}',
  );

  /** Original projection is compared after non-classification edits. */
  const original = (await loadTokenData({ root })).projection;

  await writeFixture(
    join(root, "src/data/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"fixture": {"foreground": {"description":"New wording.","descriptionBasedOn":"1.2.3","modified-desc":true,"use":"When the fixture is visible."}}},"deprecated":{}}',
  );

  assert.equal((await loadTokenData({ root })).projection, original);
  await writeFixture(
    join(root, "src/data/tokens/ui/details.jsonc"),
    JSON.stringify(
      categorized("sourceCode", {
        fixture: { foreground: { description: "Same identity, different accepted membership." } },
      }),
    ),
  );

  assert.notEqual((await loadTokenData({ root })).projection, original);
});

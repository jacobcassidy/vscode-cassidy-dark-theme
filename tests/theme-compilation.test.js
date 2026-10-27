/**
 * Consolidated token compilation tests.
 * @file Verify aliases, disabled output, independent documentation, and token schema validation.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonc } from "../scripts/lib/jsonc-validation.js";
import { generatePalette } from "../scripts/lib/palette-generation.js";
import { compileTokens, renderTheme } from "../scripts/lib/theme-compilation.js";
import { createDetails, createPaletteConfig, createTokens } from "./test-projects.js";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";

/** Palette shared by independent, freshly created token fixtures. */
const palette = generatePalette(createPaletteConfig());

/**
 * Compile tokens with independent documentation defaults.
 * @param tokens - Consolidated token sections.
 * @param [details] - Separate documentation sections.
 * @returns Compiled entries and resolved aliases.
 */
function compile(tokens, details = createDetails()) {
  return compileTokens(tokens, details, palette);
}

test("forward and cross-section aliases preserve alpha replacement and exact selector keys", () => {
  /** Authored sections with forward aliases and independent formatting. */
  const tokens = createTokens();

  tokens.variables.text = {
    first: { color: "semantic.function.defaultLibrary", alpha: 0.1 },
    second: { color: "variables.text.first", alpha: 0.2 },
    opaque: { color: "variables.text.second", alpha: 1 },
    empty: { color: "variables.text.second", alpha: 0 },
    inherited: { color: "variables.text.second" },
  };
  tokens.semantic["function.defaultLibrary"] = { color: "ui.editor.foreground" };
  tokens.semantic["*.async:javascript"] = { color: "palette.blue.400" };
  tokens.ui.wildcard = { color: "semantic.*.async:javascript" };
  tokens.semantic["*.readonly:typescript"] = { bold: false, italic: true, underline: false, strikethrough: true };

  /** Resolved values indexed by aliases and compiled selectors. */
  const result = compile(tokens);

  assert.equal(result.resolved.get("variables.text.first"), "#f1dda51a");
  assert.equal(result.resolved.get("variables.text.second"), "#f1dda533");
  assert.equal(result.resolved.get("variables.text.opaque"), "#f1dda5");
  assert.equal(result.resolved.get("variables.text.empty"), "#f1dda500");
  assert.equal(result.resolved.get("variables.text.inherited"), "#f1dda533");
  assert.equal(result.resolved.get("ui.wildcard"), palette.get("palette.blue.400").hex);
  assert.deepEqual(result.semanticTokenColors.at(-1).value, {
    bold: false,
    italic: true,
    underline: false,
    strikethrough: true,
  });
  assert.deepEqual(result.tokenColors[0].value.scope, ["second", "first"]);
  assert.equal(result.tokenColors[0].value.settings.background, "#242424");
});

test("disabled entries retain resolved styles and aliases while placeholders remain documentation targets", async () => {
  /** Disabled retained styles, formatting, and placeholders in every section. */
  const tokens = createTokens();

  tokens.ui = {
    first: { disabled: true, disabledReason: "  First\n explanation.  " },
    active: { color: "ui.retained" },
    retained: { color: "#1234", colorReason: "Literal rationale.", disabled: true, disabledReason: "Use fallback." },
    last: { disabled: true, disabledReason: "Last explanation." },
  };
  tokens.semantic = {
    first: { disabled: true, disabledReason: "Semantic placeholder." },
    active: { color: "syntax.retained", bold: false },
    middle: { italic: true, disabled: true, disabledReason: "Formatting disabled." },
    last: { color: "ui.retained", disabled: true, disabledReason: "Semantic fallback." },
  };
  tokens.syntax = [
    {
      id: "placeholder",
      name: "Placeholder",
      scope: ["first"],
      disabled: true,
      disabledReason: "No configured style.",
    },
    { name: "Active", scope: "active", color: "ui.retained" },
    {
      id: "retained",
      name: "Retained",
      scope: ["middle"],
      color: "palette.blue.400",
      background: { color: "ui.retained" },
      fontStyle: "bold italic",
      disabled: true,
      disabledReason: "  Syntax\n explanation. ",
    },
    { name: "Last", scope: "last", disabled: true, disabledReason: "Last syntax explanation." },
  ];

  /** Independent documentation referencing entries without colors. */
  const details = createDetails();

  details.ui.first = { for: "Document fallback behavior.", globallyOverriddenBy: ["active"] };
  details.syntax.placeholder = { inherits: ["scope:unknown.upstream"] };

  /** Deliberate comments survive parsing and repeated formatting. */
  const source = renderTheme({ name: "Fixture", type: "dark" }, compile(tokens, details));

  /** Formatted JSONC inspected both as text and as an active theme. */
  const formatted = await prettier.format(source, { parser: "jsonc" });

  /** Parsed theme excludes every disabled entry. */
  const theme = JSON.parse(JSON.stringify(parseJsonc(formatted, "disabled theme").value));

  assert.deepEqual(theme.colors, { active: "#1234" });
  assert.deepEqual(theme.semanticTokenColors, {
    active: { foreground: palette.get("palette.blue.400").hex, bold: false },
  });
  assert.deepEqual(theme.tokenColors, [{ name: "Active", scope: "active", settings: { foreground: "#1234" } }]);
  assert.match(formatted, /\/\/ "first": null \/\/ First explanation\./);
  assert.match(formatted, /\/\/ "retained": "#1234" \/\/ Use fallback\./);
  assert.match(formatted, /\/\/ \{ \/\/ Syntax explanation\./);
  assert.match(formatted, /\/\/\s*"background": "#1234"/);
  assert.match(formatted, /\/\/\s*"settings": \{\}/);
  assert.doesNotMatch(formatted, /Literal rationale|colorReason|disabledReason|"id"/);
  assert.equal(await prettier.format(formatted, { parser: "jsonc" }), formatted);

  for (const reference of ["ui.first", "semantic.first", "syntax.placeholder"]) {
    tokens.ui.active.color = reference;
    assert.throws(() => compile(tokens, details), /referenced entry has no configured color/);
  }
});

for (const disabledIndices of [[], [0], [1], [2], [0, 1], [1, 2], [0, 2], [0, 1, 2]]) {
  test(`active commas and disabled sections parse for disabled positions ${disabledIndices}`, () => {
    /** Three entries per section exercise every active/disabled combination. */
    const tokens = { variables: {}, ui: {}, semantic: {}, syntax: [] };

    for (let index = 0; index < 3; index++) {
      /** Shared color and disabling choice for this entry position. */
      const definition = {
        color: "palette.blue.400",
        disabled: disabledIndices.includes(index),
        disabledReason: `Reason ${index}.`,
      };

      tokens.ui[`entry${index}`] = definition;
      tokens.semantic[`entry${index}`] = definition;
      tokens.syntax.push({ name: `Entry ${index}`, scope: `scope${index}`, ...definition });
    }

    /** Parsed result ignores every deliberate disabled-entry comment. */
    const theme = parseJsonc(renderTheme({}, compile(tokens)), "commas").value;

    assert.equal(Object.keys(theme.colors).length, 3 - disabledIndices.length);
    assert.equal(Object.keys(theme.semanticTokenColors).length, 3 - disabledIndices.length);
    assert.equal(theme.tokenColors.length, 3 - disabledIndices.length);
  });
}

test("colorReason and disabledReason remain separate validated explanations, including retained values", () => {
  for (const value of [undefined, "", " \n ", null, 123, []]) {
    /** Literal disabled style must satisfy both explanation contracts. */
    const tokens = createTokens();
    tokens.ui.bad = { color: "#abc", disabled: true, disabledReason: "Disabled explanation." };
    if (value !== undefined) tokens.ui.bad.colorReason = value;
    assert.throws(() => compile(tokens), /colorReason/);
    tokens.ui.bad.colorReason = "Color explanation.";
    tokens.ui.bad.disabledReason = value;
    assert.throws(() => compile(tokens), /disabledReason/);
    tokens.ui.bad.disabled = false;
    assert.throws(() => compile(tokens), /disabledReason/);
    tokens.ui.bad = { color: "palette.blue.400", colorReason: value };
    assert.throws(() => compile(tokens), /colorReason/);
  }

  /** Multiline explanations are valid, including a retained reason while enabled. */
  const tokens = createTokens();

  tokens.ui.valid = { color: "#abc", colorReason: "Color\n explanation.", disabledReason: "Retained\n explanation." };
  assert.equal(compile(tokens).colors.at(-1).value, "#abc");
});

test("retained styles reject unknown references, cycles, duplicate IDs, and invalid alpha", () => {
  for (const [definition, pattern] of [
    [{ color: "missing.token" }, /Unknown reference/],
    [{ color: "ui.bad" }, /Token cycle/],
    [{ color: "palette.blue.400", alpha: 2 }, /finite number/],
    [{ color: "#xyz", colorReason: "Invalid." }, /hex color/],
    [{ color: "palette.blue.400", reason: "Legacy." }, /unknown field reason/],
    [{ alpha: 0.5 }, /requires a color/],
    [{ color: "" }, /nonempty string/],
    [{ color: null }, /nonempty string/],
    [{ color: 123 }, /nonempty string/],
    [{ disabled: "yes" }, /must be a boolean/],
  ]) {
    /** Bad definitions remain invalid even when their output is disabled. */
    const tokens = createTokens();
    tokens.ui.bad = { ...definition, disabled: definition.disabled ?? true, disabledReason: "Retained style." };
    assert.throws(() => compile(tokens), pattern);
  }

  /** Cycles can cross section boundaries before aliases have been resolved. */
  const tokens = createTokens();

  tokens.syntax[0].color = "semantic.variable";
  assert.throws(() => compile(tokens), /syntax.string → semantic.variable → syntax.string/);
  tokens.syntax[0].color = "palette.blue.400";
  tokens.syntax.push({ ...tokens.syntax[0] });
  assert.throws(() => compile(tokens), /duplicate token ID syntax.string/);
  tokens.syntax.pop();
  tokens.variables.surface = {
    nested: { one: { color: "palette.blue.400" } },
    "nested.one": { color: "palette.blue.400" },
  };
  assert.throws(() => compile(tokens), /duplicate token ID variables.surface.nested.one/);
});

test("token schemas validate selectors, flags, syntax backgrounds, and source-only fields", () => {
  for (const [section, value, pattern] of [
    ["variables", { unknown: {} }, /unknown field/],
    ["variables", { surface: { editor: { color: "palette.blue.400", disabled: false } } }, /unknown field disabled/],
    [
      "variables",
      { surface: { editor: { color: "palette.blue.400", disabledReason: "Unused." } } },
      /unknown field disabledReason/,
    ],
    ["variables", { surface: { "bad key": { color: "palette.blue.400" } } }, /invalid variable ID/],
    ["ui", { invalid: "#123456" }, /expected an object/],
    ["ui", { "bad key": { color: "palette.blue.400" } }, /invalid ui key/],
    ["ui", { bad: {} }, /requires styling/],
    ["semantic", { "*.bad key": { bold: true } }, /invalid semantic key/],
    ["semantic", { variable: { italic: "yes" } }, /must be a boolean/],
    ["syntax", {}, /token color array/],
    ["syntax", [{ id: "bad id" }], /invalid syntax ID/],
    ["syntax", [{ scope: [null] }], /scope must be/],
    ["syntax", [{ name: " " }], /nonempty string/],
    ["syntax", [{ fontStyle: "blink" }], /supported formatting flags/],
    ["syntax", [{ background: {} }], /requires a color/],
    ["syntax", [{ background: { color: "#fff" } }], /colorReason/],
    ["syntax", [{ settings: {} }], /unknown field settings/],
  ]) {
    /** One malformed section replaces the corresponding fixture section. */
    const tokens = createTokens();
    tokens[section] = value;
    assert.throws(() => compile(tokens), pattern);
  }
});

test("details enforce reviewed global replacements independently from aliases and conditional overrides", () => {
  /** Active tokens used as independent documentation targets. */
  const tokens = createTokens();

  /** Relationships need not identify existing aliases. */
  const details = createDetails();

  details.ui["editor.background"] = {
    for: "Editor background.",
    inherits: ["unknown.upstream"],
    overrides: ["component.color"],
  };
  assert.doesNotThrow(() => compile(tokens, details));

  for (const section of ["ui", "semantic", "syntax"]) {
    /** Existing documentation key selected from each emitted section. */
    const key = section === "ui" ? "editor.background" : section === "semantic" ? "variable" : "string";

    /** Effective definition corresponding to that documentation key. */
    const definition = section === "syntax" ? tokens.syntax[0] : tokens[section][key];
    details[section][key] = { globallyOverriddenBy: ["reviewed.replacement"] };
    assert.throws(() => compile(tokens, details), /globallyOverriddenBy requires disabled/);
    definition.disabled = true;
    assert.throws(() => compile(tokens, details), /disabledReason/);
    definition.disabledReason = "Reviewed complete replacement.";
    assert.doesNotThrow(() => compile(tokens, details));
  }

  details.variables["surface.editor"] = { globallyOverriddenBy: ["editor.background"] };
  assert.throws(() => compile(tokens, details), /internal variables cannot be globallyOverriddenBy/);
});

test("details reject blank entries, malformed lists, unknown fields, wrappers, and absent syntax IDs", () => {
  for (const value of [
    null,
    [],
    {},
    { typo: "Unknown" },
    { for: "" },
    { for: " " },
    { for: [] },
    { inherits: [] },
    { inherits: "color" },
    { inherits: [""] },
    { inherits: [123] },
    { overrides: ["same", "same"] },
    { overrides: ["same", " same "] },
    { globallyOverriddenBy: [null] },
  ]) {
    /** Invalid details for an existing authored UI entry. */
    const details = createDetails();
    details.ui["editor.background"] = value;
    assert.throws(() => compile(createTokens(), details), /details.ui.editor.background/);
  }

  for (const section of ["variables", "ui", "semantic", "syntax"]) {
    /** Details keys must name effective authored entries in their own section. */
    const details = createDetails();
    details[section].missing = { for: "Absent entry." };
    assert.throws(() => compile(createTokens(), details), /unknown authored entry/);
    details[section] = { details: {} };
    assert.throws(() => compile(createTokens(), details), /unknown authored entry/);
  }
});

/**
 * Color variable tests.
 * @file Verify nested references, alpha handling, metadata, invalid identifiers, and alias-cycle detection.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { withAlpha } from "../scripts/lib/color-math.js";
import { generatePalette } from "../scripts/lib/palette-generation.js";
import { resolveTokens } from "../scripts/lib/color-variable-resolution.js";
import { createPaletteConfig } from "./test-projects.js";

test("nested tokens resolve forward aliases, dotted selectors, and absolute alpha", () => {
  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(createPaletteConfig());

  /** Resolved named color variables inspected by the current assertion. */
  const tokens = resolveTokens(
    {
      overlay: {
        first: { color: "syntax.string", alpha: 0.1 },
        second: { color: "overlay.first", alpha: 0.2 },
        opaque: { color: "overlay.second", alpha: 1 },
        empty: { color: "overlay.second", alpha: 0 },
        inherited: { color: "overlay.second" },
      },
      syntax: { string: { color: "palette.yellow.400", alpha: 1 } },
      ui: { activityBar: { activeBackground: { color: "palette.gray.900", alpha: 1 } } },
      semantic: {
        function: { color: "syntax.string" },
        "function.defaultLibrary": { color: "ui.activityBar.activeBackground" },
      },
      diff: { added: { foreground: { color: "#abc", reason: "A component-specific exception" } } },
    },
    palette,
  );

  assert.equal(tokens.get("overlay.first"), "#f1dda51a");
  assert.equal(tokens.get("overlay.second"), "#f1dda533");
  assert.equal(tokens.get("overlay.opaque"), "#f1dda5");
  assert.equal(tokens.get("overlay.empty"), "#f1dda500");
  assert.equal(tokens.get("overlay.inherited"), "#f1dda533");
  assert.equal(tokens.get("ui.activityBar.activeBackground"), "#242424");
  assert.equal(tokens.get("semantic.function"), "#f1dda5");
  assert.equal(tokens.get("semantic.function.defaultLibrary"), "#242424");
  assert.equal(tokens.get("diff.added.foreground"), "#aabbcc");
  assert.equal(withAlpha("#0009", 0.5), "#00000080");
  assert.throws(() => withAlpha("#123456", NaN), /finite number/);
});

test("unknown references, cycles, invalid alpha, and undocumented literal tokens fail", () => {
  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(createPaletteConfig());

  assert.throws(
    () => resolveTokens({ unused: { alias: { color: "missing.token" } } }, palette),
    /unused.alias → missing.token/,
  );

  assert.throws(
    () => resolveTokens({ a: { one: { color: "b.two" } }, b: { two: { color: "a.one" } } }, palette),
    /a.one → b.two → a.one/,
  );

  assert.throws(
    () => resolveTokens({ a: { one: { color: "palette.yellow.400", alpha: 2 } } }, palette),
    /finite number/,
  );
  assert.throws(() => resolveTokens({ a: { one: { color: "#123456" } } }, palette), /reason/);
  assert.throws(
    () => resolveTokens({ a: { one: { color: "palette.yellow.400", typo: true } } }, palette),
    /unknown field/,
  );

  for (const color of ["", null, 123]) {
    assert.throws(() => resolveTokens({ a: { one: { color } } }, palette), /color must be/);
  }

  assert.throws(() => resolveTokens({ a: { one: { alpha: 1 } } }, palette), /color must be/);
  assert.throws(() => resolveTokens({ a: { one: { color: "#xyz", reason: "Invalid" } } }, palette), /hex color/);
  assert.throws(() => resolveTokens({ a: { one: "palette.yellow.400" } }, palette), /expected an object/);
});

test("token groups reject invalid IDs, reserved palette IDs, and ambiguous flattened paths", () => {
  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(createPaletteConfig());

  for (const input of [
    { "bad key": { one: { color: "palette.yellow.400" } } },
    { a: { "bad key": { color: "palette.yellow.400" } } },
    { palette: { one: { color: "palette.yellow.400" } } },
    { "palette.one": { color: "palette.yellow.400" } },
  ]) {
    assert.throws(() => resolveTokens(input, palette), /invalid semantic token ID/);
  }

  assert.throws(
    () =>
      resolveTokens(
        { a: { nested: { one: { color: "palette.yellow.400" } }, "nested.one": { color: "palette.blue.400" } } },
        palette,
      ),
    /duplicate semantic token ID a.nested.one/,
  );
});

test("token details document upstream relationships without resolving them as color aliases", () => {
  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(createPaletteConfig());

  /** Resolved named color variables inspected by the current assertion. */
  const tokens = resolveTokens(
    {
      ui: {
        statusBar: {
          noFolderForeground: {
            color: "palette.blue.400",
            alpha: 0.5,
            details: {
              for: "Status bar text in an empty window.",
              inherits: ["statusBar.foreground"],
              overrides: ["statusBar.foreground"],
            },
          },
        },
      },
    },
    palette,
  );

  assert.equal(tokens.get("ui.statusBar.noFolderForeground"), `${palette.get("palette.blue.400").hex}80`);
});

test("token details reject unknown fields, empty values, and malformed relationship lists", () => {
  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(createPaletteConfig());

  for (const details of [
    null,
    [],
    {},
    { typo: "Unknown" },
    { for: "" },
    { for: "  " },
    { for: [] },
    { inherits: [] },
    { inherits: "foreground" },
    { inherits: [""] },
    { inherits: [123] },
    { overrides: ["foreground", "foreground"] },
    { "overridden-by": ["statusBar.debuggingForeground"] },
    { overrides: [null] },
  ]) {
    assert.throws(
      () => resolveTokens({ ui: { custom: { color: "palette.blue.400", details } } }, palette),
      /token ui.custom.details/,
    );
  }
});

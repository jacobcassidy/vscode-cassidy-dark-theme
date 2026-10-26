/**
 * Palette generation tests.
 * @file Verify generated tones, chroma anchors, gamut bounds, overrides, and invalid palette inputs.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { inGamut, maxChroma } from "../scripts/lib/color-math.js";
import { generatePalette } from "../scripts/lib/palette-generation.js";
import { createPaletteConfig } from "./test-projects.js";

test("palette overrides require a nonempty colorReason and preserve multiline explanations", () => {
  for (const override of [null, false, 0, "", []]) {
    /** Supplied overrides must validate even when their values are falsy. */
    const input = createPaletteConfig();
    input.overrides["palette.blue.400"] = override;
    assert.throws(() => generatePalette(input), /expected an object/);
  }

  for (const colorReason of [undefined, "", " \n ", null, false, []]) {
    /** Palette override with an absent, blank, or malformed explanation. */
    const input = createPaletteConfig();
    input.overrides["palette.blue.400"] = { hex: "#123456", colorReason };
    assert.throws(() => generatePalette(input), /colorReason is required/);
  }

  /** Multiline explanations remain intact in generated measurement records. */
  const input = createPaletteConfig();

  input.overrides["palette.blue.400"] = { hex: "#123456", colorReason: "Preserve\n the comparison color." };
  assert.equal(generatePalette(input).get("palette.blue.400").colorReason, "Preserve\n the comparison color.");
});

test("yellow's selected anchor generates the agreed five tones", () => {
  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(createPaletteConfig());

  for (const [tone, expected] of Object.entries({
    300: "#fef6e2",
    400: "#f1dda5",
    "400-muted": "#e8ddc3",
    500: "#ddba56",
    600: "#bd9a2c",
  })) {
    assert.equal(palette.get(`palette.yellow.${tone}`).hex, expected);
  }

  assert.equal(palette.get("palette.yellow.300").target.l, 0.975);
  assert.equal(palette.get("palette.yellow.400").target.c, 0.075);
  assert.equal(palette.get("palette.yellow.400-muted").resolved.c, palette.get("palette.yellow.400").resolved.c / 2);
});

test("default chroma, zero anchors, gamut headroom, and override policy", () => {
  /** Authored fixture configuration mutated for the current validation scenario. */
  const input = createPaletteConfig();

  /** Generated palette shared by this test’s color and variable assertions. */
  const palette = generatePalette(input);

  /** Generated base blue primitive used to inspect chroma and gamut behavior. */
  const blue = palette.get("palette.blue.400");

  assert.equal(blue.target.c, 0.125);
  assert.ok(Math.abs(blue.resolved.c - 0.9 * maxChroma(0.75, 255)) < 1e-8);
  assert.equal(palette.get("palette.blue.400-muted").resolved.c, blue.resolved.c / 2);

  for (const color of palette.values()) {
    assert.ok(inGamut(color.resolved));
  }

  input.families.yellow.baseChroma = 0;

  /** Palette generated with a zero chroma anchor. */
  const zero = generatePalette(input);

  assert.equal(zero.get("palette.yellow.400").target.c, 0);
  assert.equal(zero.get("palette.yellow.300").target.c, 0);
  input.overrides["palette.blue.400"] = { oklch: { l: 0.75, c: 1, h: 255 }, colorReason: "Test gamut boundary" };

  /** Primitive generated from an explicit palette override. */
  const overridden = generatePalette(input).get("palette.blue.400");

  assert.ok(inGamut(overridden.resolved));
  assert.ok(overridden.resolved.c > blue.resolved.c);
  assert.equal(overridden.colorReason, "Test gamut boundary");
  input.overrides["palette.blue.400"] = { hex: "#123456", colorReason: "Preserve a released value" };
  assert.equal(generatePalette(input).get("palette.blue.400").hex, "#123456");
});

test("invalid palette parameters and unknown overrides fail", () => {
  for (const mutate of [
    (value) => {
      value.families.yellow.hue = 360;
    },
    (value) => {
      value.families.yellow.lightness = 0.1;
    },
    (value) => {
      value.families.yellow.baseChroma = -1;
    },
    (value) => {
      value.chroma.strength = Infinity;
    },
    (value) => {
      value.chroma.gamutFraction = 1.1;
    },
    (value) => {
      value.families.yellow.typo = 1;
    },
    (value) => {
      value.overrides["palette.yellow.999"] = { hex: "#123456", colorReason: "Unknown" };
    },
    (value) => {
      value.overrides["palette.yellow.400"] = { hex: "#123456" };
    },
    (value) => {
      value.overrides["palette.yellow.400"] = {
        hex: "#123456",
        oklch: { l: 0.9, c: 0.1, h: 90 },
        colorReason: "Ambiguous",
      };
    },
  ]) {
    /** Authored fixture configuration mutated for the current validation scenario. */
    const input = createPaletteConfig();
    mutate(input);
    assert.throws(() => generatePalette(input));
  }
});

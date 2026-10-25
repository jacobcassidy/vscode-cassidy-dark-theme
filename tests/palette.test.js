import assert from "node:assert/strict";
import test from "node:test";
import { inGamut, maxChroma } from "../scripts/lib/colors.js";
import { generatePalette } from "../scripts/lib/palette.js";
import { createPaletteConfig } from "./test-projects.js";

test("yellow's selected anchor generates the agreed five tones", () => {
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
  const input = createPaletteConfig();
  const palette = generatePalette(input);
  const blue = palette.get("palette.blue.400");

  assert.equal(blue.target.c, 0.125);
  assert.ok(Math.abs(blue.resolved.c - 0.9 * maxChroma(0.75, 255)) < 1e-8);
  assert.equal(palette.get("palette.blue.400-muted").resolved.c, blue.resolved.c / 2);

  for (const color of palette.values()) {
    assert.ok(inGamut(color.resolved));
  }

  input.families.yellow.baseChroma = 0;

  const zero = generatePalette(input);

  assert.equal(zero.get("palette.yellow.400").target.c, 0);
  assert.equal(zero.get("palette.yellow.300").target.c, 0);
  input.overrides["palette.blue.400"] = { oklch: { l: 0.75, c: 1, h: 255 }, reason: "Test gamut boundary" };

  const overridden = generatePalette(input).get("palette.blue.400");

  assert.ok(inGamut(overridden.resolved));
  assert.ok(overridden.resolved.c > blue.resolved.c);
  assert.equal(overridden.reason, "Test gamut boundary");
  input.overrides["palette.blue.400"] = { hex: "#123456", reason: "Preserve a released value" };
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
      value.overrides["palette.yellow.999"] = { hex: "#123456", reason: "Unknown" };
    },
    (value) => {
      value.overrides["palette.yellow.400"] = { hex: "#123456" };
    },
    (value) => {
      value.overrides["palette.yellow.400"] = { hex: "#123456", oklch: { l: 0.9, c: 0.1, h: 90 }, reason: "Ambiguous" };
    },
  ]) {
    const input = createPaletteConfig();

    mutate(input);
    assert.throws(() => generatePalette(input));
  }
});

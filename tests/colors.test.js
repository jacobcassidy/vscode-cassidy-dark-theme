/**
 * Color mathematics tests.
 * @file Verify reference color conversions, neutral endpoints, luminance contrast, and alpha restrictions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, fromHex, toHex } from "../scripts/lib/color-math.js";

test("known sRGB/OKLCH conversions and neutral endpoints", () => {
  assert.equal(toHex({ l: 0.9, c: 0.075, h: 90 }), "#f1dda5");
  assert.equal(toHex({ l: 0, c: 0, h: 0 }), "#000000");
  assert.equal(toHex({ l: 1, c: 0, h: 0 }), "#ffffff");
  assert.equal(fromHex("#808080").c, 0);

  /** OKLCH representation of the reference red used by conversion assertions. */
  const red = fromHex("#ff0000");

  assert.ok(Math.abs(red.l - 0.627955) < 0.000001);
  assert.ok(Math.abs(red.c - 0.257683) < 0.000001);
  assert.ok(Math.abs(red.h - 29.234) < 0.001);
  assert.equal(toHex(red), "#ff0000");
  assert.throws(() => toHex({ l: 0.9, c: 0.3, h: 90 }), /out-of-gamut/);
});

test("contrast uses exported sRGB luminance and requires opaque colors", () => {
  assert.equal(contrastRatio("#fff", "#000"), 21);
  assert.equal(contrastRatio("#f8f8f8", "#f8f8f8"), 1);
  assert.equal(contrastRatio("#f8f8f8", "#1e70ce").toFixed(2), "4.64");
  assert.equal(contrastRatio("#1e70ce", "#f8f8f8ff"), contrastRatio("#f8f8f8", "#1e70ce"));
  assert.equal(contrastRatio("#f8f8f8", "#1e70ce80"), null);
  assert.equal(contrastRatio("#fff8", "#000"), null);
  assert.throws(() => contrastRatio("invalid", "#000"), /hex color/);
});

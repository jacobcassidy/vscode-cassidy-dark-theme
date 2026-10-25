/**
 * Color mathematics.
 * @file Convert OKLCH and sRGB colors, find gamut limits, handle alpha, and calculate contrast.
 */

import { fields, number } from "./jsonc-validation.js";

// OKLab/sRGB matrices: https://www.w3.org/TR/css-color-4/#color-conversion-code

/**
 * Convert an OKLCH color to linear-light sRGB channels without gamut clipping.
 *
 * @param color - OKLCH lightness, chroma, and hue components.
 * @param color.l - OKLCH lightness in the zero-to-one range.
 * @param color.c - Nonnegative OKLCH chroma.
 * @param color.h - OKLCH hue angle in degrees.
 * @returns Linear-light red, green, and blue channels.
 */
export function linearRgb({ l: L, c: C, h: H }) {
  /** OKLab red/green axis derived from chroma and hue. */
  const a = C * Math.cos((H * Math.PI) / 180);

  /** OKLab yellow/blue axis derived from chroma and hue. */
  const b = C * Math.sin((H * Math.PI) / 180);

  /** Cubed LMS-like light-response component used by the conversion matrix. */
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;

  /** Cubed LMS-like medium-response component used by the conversion matrix. */
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;

  /** Cubed LMS-like short-response component used by the conversion matrix. */
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Check whether an OKLCH color fits sRGB, allowing conversion-matrix roundoff.
 *
 * @param color - OKLCH lightness, chroma, and hue components.
 * @returns Whether every converted channel lies within sRGB bounds.
 */
export function inGamut(color) {
  // Allow conversion-matrix roundoff at the gamut boundary, below 8-bit precision.
  return linearRgb(color).every((value) => value >= -1e-7 && value <= 1 + 1e-7);
}

/**
 * Find the greatest in-gamut chroma for a fixed lightness and hue using binary search.
 *
 * @param l - OKLCH lightness between zero and one.
 * @param h - OKLCH hue angle in degrees.
 * @returns Maximum supported chroma at the requested lightness and hue.
 */
export function maxChroma(l, h) {
  if (l === 0 || l === 1) return 0;

  /** Known in-gamut lower bound of the chroma search. */
  let low = 0;

  /** Upper chroma bound expanded until it leaves sRGB. */
  let high = 0.5;

  while (inGamut({ l, c: high, h })) {
    high *= 2;
  }

  while (high - low > 1e-8) {
    /** Midpoint chroma tested during binary search. */
    const middle = (low + high) / 2;

    if (inGamut({ l, c: middle, h })) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return low;
}

/**
 * Require finite OKLCH components within the supported lightness, chroma, and hue ranges.
 *
 * @param color - OKLCH lightness, chroma, and hue components.
 * @param label - Human-readable context included in validation diagnostics.
 */
export function validateOklch(color, label) {
  fields(color, ["l", "c", "h"], label);
  number(color.l, 0, 1, `${label}.l`);
  number(color.c, 0, Number.MAX_VALUE, `${label}.c`);
  number(color.h, 0, 360, `${label}.h`);

  if (color.h === 360) throw new Error(`${label}.h: use 0 instead of 360`);
}

/**
 * Require a short or full sRGB hex color, with an optional alpha channel.
 *
 * @param hex - Short or full hexadecimal sRGB color.
 * @param [label] - Human-readable context included in validation diagnostics.
 */
export function validateHex(hex, label = "color") {
  if (typeof hex !== "string" || !/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex)) {
    throw new Error(`${label}: expected an sRGB hex color`);
  }
}

/**
 * Expand short hex notation and normalize hexadecimal digits to lowercase.
 *
 * @param hex - Short or full hexadecimal sRGB color.
 * @returns A lowercase, expanded hex color.
 */
export function normalizeHex(hex) {
  validateHex(hex);

  return hex.length <= 5
    ? `#${[...hex.slice(1)].map((digit) => digit.repeat(2)).join("")}`.toLowerCase()
    : hex.toLowerCase();
}

/**
 * Replace a hex color’s alpha channel, omitting it for fully opaque output.
 *
 * @param hex - Short or full hexadecimal sRGB color.
 * @param alpha - Opacity between zero and one, inclusive.
 * @returns Hex color with the requested opacity.
 */
export function withAlpha(hex, alpha) {
  number(alpha, 0, 1, "alpha");

  /** Normalized RGB hex channels without the incoming alpha suffix. */
  const rgb = normalizeHex(hex).slice(0, 7);

  return alpha === 1
    ? rgb
    : `${rgb}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
}

// WCAG relative luminance and contrast: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance

/**
 * Calculate WCAG contrast from exported sRGB channels, returning null for translucent colors.
 *
 * @param foreground - Foreground sRGB hex color.
 * @param background - Background sRGB hex color.
 * @returns Contrast ratio, or null when a backdrop is required.
 */
export function contrastRatio(foreground, background) {
  /** Normalized foreground and background hex values. */
  const colors = [foreground, background].map(normalizeHex);

  if (colors.some((hex) => hex.length === 9 && !hex.endsWith("ff"))) return null;

  /** Relative luminance measured from each exported sRGB color. */
  const luminances = colors.map((hex) =>
    [1, 3, 5]
      .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0),
  );

  /** Luminances ordered from darker to lighter for the contrast formula. */
  const [low, high] = luminances.sort((a, b) => a - b);

  return (high + 0.05) / (low + 0.05);
}

/**
 * Encode an in-gamut OKLCH color as a rounded, six-digit sRGB hex string.
 *
 * @param color - OKLCH lightness, chroma, and hue components.
 * @returns Rounded six-digit sRGB hex color.
 */
export function toHex(color) {
  if (!inGamut(color)) throw new Error("Cannot encode an out-of-gamut color");

  return `#${linearRgb(color)
    .map((value) => {
      /** Linear channel clamped against conversion roundoff at gamut boundaries. */
      const clean = Math.max(0, Math.min(1, value));

      /** Gamma-encoded sRGB channel before eight-bit rounding. */
      const encoded = clean <= 0.0031308 ? 12.92 * clean : 1.055 * clean ** (1 / 2.4) - 0.055;

      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

/**
 * Convert normalized sRGB hex channels to OKLCH, ignoring any alpha channel.
 *
 * @param hex - Short or full hexadecimal sRGB color.
 * @returns OKLCH lightness, chroma, and hue measured from the input channels.
 */
export function fromHex(hex) {
  /** Expanded lowercase hex value used to read channel pairs. */
  const normalized = normalizeHex(hex);

  /** Linear-light RGB channels decoded from the normalized hex color. */
  const [r, g, b] = [1, 3, 5].map((offset) => {
    /** Encoded channel normalized to the zero-to-one range. */
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  /** Cube-root long-response component of the inverse conversion. */
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);

  /** Cube-root medium-response component of the inverse conversion. */
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);

  /** Cube-root short-response component of the inverse conversion. */
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  /** OKLab red/green axis measured from the RGB channels. */
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;

  /** OKLab yellow/blue axis measured from the RGB channels. */
  const axisB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  /** Chroma magnitude derived from the two OKLab color axes. */
  const c = Math.hypot(a, axisB);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: c < 1e-7 ? 0 : c,
    h: c < 1e-7 ? 0 : ((Math.atan2(axisB, a) * 180) / Math.PI + 360) % 360,
  };
}

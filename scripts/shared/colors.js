import { fields, number } from "./jsonc.js";

// OKLab/sRGB matrices: https://www.w3.org/TR/css-color-4/#color-conversion-code
export function linearRgb({ l: L, c: C, h: H }) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function inGamut(color) {
  // Allow conversion-matrix roundoff at the gamut boundary, below 8-bit precision.
  return linearRgb(color).every((value) => value >= -1e-7 && value <= 1 + 1e-7);
}

export function maxChroma(l, h) {
  if (l === 0 || l === 1) return 0;

  let low = 0;
  let high = 0.5;

  while (inGamut({ l, c: high, h })) {
    high *= 2;
  }

  while (high - low > 1e-8) {
    const middle = (low + high) / 2;

    if (inGamut({ l, c: middle, h })) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return low;
}

export function validateOklch(color, label) {
  fields(color, ["l", "c", "h"], label);
  number(color.l, 0, 1, `${label}.l`);
  number(color.c, 0, Number.MAX_VALUE, `${label}.c`);
  number(color.h, 0, 360, `${label}.h`);

  if (color.h === 360) throw new Error(`${label}.h: use 0 instead of 360`);
}

export function validateHex(hex, label = "color") {
  if (typeof hex !== "string" || !/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex)) {
    throw new Error(`${label}: expected an sRGB hex color`);
  }
}

export function normalizeHex(hex) {
  validateHex(hex);

  return hex.length <= 5
    ? `#${[...hex.slice(1)].map((digit) => digit.repeat(2)).join("")}`.toLowerCase()
    : hex.toLowerCase();
}

export function withAlpha(hex, alpha) {
  number(alpha, 0, 1, "alpha");

  const rgb = normalizeHex(hex).slice(0, 7);

  return alpha === 1
    ? rgb
    : `${rgb}${Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0")}`;
}

// WCAG relative luminance and contrast: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
export function contrastRatio(foreground, background) {
  const colors = [foreground, background].map(normalizeHex);

  if (colors.some((hex) => hex.length === 9 && !hex.endsWith("ff"))) return null;

  const luminances = colors.map((hex) =>
    [1, 3, 5]
      .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0),
  );

  const [low, high] = luminances.sort((a, b) => a - b);

  return (high + 0.05) / (low + 0.05);
}

export function toHex(color) {
  if (!inGamut(color)) throw new Error("Cannot encode an out-of-gamut color");

  return `#${linearRgb(color)
    .map((value) => {
      const clean = Math.max(0, Math.min(1, value));
      const encoded = clean <= 0.0031308 ? 12.92 * clean : 1.055 * clean ** (1 / 2.4) - 0.055;

      return Math.round(encoded * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

export function fromHex(hex) {
  const normalized = normalizeHex(hex);

  const [r, g, b] = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const axisB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, axisB);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    c: c < 1e-7 ? 0 : c,
    h: c < 1e-7 ? 0 : ((Math.atan2(axisB, a) * 180) / Math.PI + 360) % 360,
  };
}

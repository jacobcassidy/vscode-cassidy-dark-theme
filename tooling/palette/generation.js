/**
 * Palette generation.
 * @file Validate palette inputs and generate gamut-limited color families, neutrals, and overrides.
 */

import { fields, number, object } from "../shared/jsonc.js";
import { fromHex, maxChroma, normalizeHex, toHex, validateHex, validateOklch } from "../shared/color-math.js";

/**
 * Require a palette identifier composed of letters, digits, and hyphens.
 *
 * @param value - Palette family identifier to validate.
 * @param label - Human-readable context included in validation diagnostics.
 */
function identifier(value, label) {
  if (!/^[a-z][a-z0-9-]*$/i.test(value)) throw new Error(`${label}: invalid identifier ${value}`);
}

/**
 * Record requested, resolved, and exported colors with an optional override explanation.
 *
 * @param target - Requested OKLCH color before gamut limiting or overrides.
 * @param resolved - Color after gamut limiting or an authored override.
 * @param [hex] - Short or full hexadecimal sRGB color.
 * @param [colorReason] - Explanation attached to a deliberate color override.
 */
function record(target, resolved, hex = toHex(resolved), colorReason) {
  return { target, resolved, hex, exported: fromHex(hex), ...(colorReason ? { colorReason } : {}) };
}

/**
 * Generate chromatic tones and neutrals while enforcing gamut limits and override rules.
 *
 * @param config - Authored palette configuration to validate and expand.
 * @returns Palette records indexed by primitive identifier.
 */
export function generatePalette(config) {
  fields(config, ["chroma", "families", "neutrals", "overrides"], "palette");
  fields(config.chroma, ["strength", "gamutFraction"], "palette.chroma");
  number(config.chroma.strength, 0, Number.MAX_VALUE, "palette.chroma.strength");
  number(config.chroma.gamutFraction, 0, 1, "palette.chroma.gamutFraction");
  object(config.families, "palette.families");
  object(config.neutrals, "palette.neutrals");
  object(config.overrides ?? {}, "palette.overrides");

  /** Generated primitive records indexed by palette identifier. */
  const colors = new Map();

  /** Authored exceptions to normal tone generation. */
  const overrides = config.overrides ?? {};

  /**
   * Add one gamut-limited palette primitive, applying its documented override when present.
   *
   * @param id - Dotted palette or color variable identifier.
   * @param target - Requested OKLCH color before gamut limiting or overrides.
   * @param [fraction] - Fraction of maximum sRGB chroma allowed for this primitive.
   */
  function add(id, target, fraction = config.chroma.gamutFraction) {
    validateOklch(target, id);

    /** Optional exception for the primitive currently being added. */
    const override = overrides[id];

    /** Requested color with chroma limited to the allowed gamut fraction. */
    const resolved = { ...target, c: Math.min(target.c, fraction * maxChroma(target.l, target.h)) };

    if (!Object.hasOwn(overrides, id)) {
      colors.set(id, record(target, resolved));
      return;
    }

    fields(override, ["hex", "oklch", "colorReason"], `override ${id}`);

    if (typeof override.colorReason !== "string" || !override.colorReason.trim()) {
      throw new Error(`override ${id}: a colorReason is required`);
    }

    if (Object.hasOwn(override, "hex") === Object.hasOwn(override, "oklch")) {
      throw new Error(`override ${id}: provide exactly one of hex or oklch`);
    }

    if (Object.hasOwn(override, "hex")) {
      validateHex(override.hex, id);

      /** Normalized literal hex supplied by a documented override. */
      const hex = normalizeHex(override.hex);
      colors.set(id, record(target, fromHex(hex), hex, override.colorReason));
    } else {
      validateOklch(override.oklch, id);

      /** OKLCH override limited to the full sRGB gamut. */
      const color = { ...override.oklch, c: Math.min(override.oklch.c, maxChroma(override.oklch.l, override.oklch.h)) };
      colors.set(id, record(override.oklch, color, toHex(color), override.colorReason));
    }
  }

  for (const [name, family] of Object.entries(config.families)) {
    identifier(name, "family");

    if (name === "gray") throw new Error("family gray is reserved for neutrals");

    fields(family, ["hue", "lightness", "baseChroma"], `family ${name}`);
    number(family.lightness, 0.2, 0.975, `${name}.lightness`);
    number(family.hue, 0, 360, `${name}.hue`);

    if (family.hue === 360) throw new Error(`${name}.hue: use 0 instead of 360`);

    if (Object.hasOwn(family, "baseChroma")) {
      number(family.baseChroma, 0, Number.MAX_VALUE, `${name}.baseChroma`);
    }

    /** Family base chroma, either explicitly anchored or derived from lightness. */
    const base = family.baseChroma ?? config.chroma.strength * (1 - family.lightness);

    for (const [tone, l] of [
      ["300", Math.min(family.lightness + 0.1, 0.975)],
      ["400", family.lightness],
      ["400-muted", family.lightness],
      ["500", family.lightness - 0.1],
      ["600", family.lightness - 0.2],
    ]) {
      /** Requested tone chroma before gamut limiting. */
      const c =
        tone === "400-muted"
          ? colors.get(`palette.${name}.400`).resolved.c / 2
          : Math.max(0, base + config.chroma.strength * (family.lightness - l));
      add(`palette.${name}.${tone}`, { l, c, h: family.hue }, tone === "400-muted" ? 1 : config.chroma.gamutFraction);
    }
  }

  /** Neutral entries ordered numerically before nonnumeric names. */
  const neutrals = Object.entries(config.neutrals).sort(([a], [b]) => {
    /** Numeric interpretation of the first neutral tone key. */
    const left = Number(a);

    /** Numeric interpretation of the second neutral tone key. */
    const right = Number(b);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    if (Number.isFinite(left)) return -1;
    if (Number.isFinite(right)) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  for (const [tone, l] of neutrals) {
    if (!/^[a-z0-9-]+$/i.test(tone)) throw new Error(`invalid neutral ID ${tone}`);
    number(l, 0, 1, `neutral ${tone}`);
    add(`palette.gray.${tone}`, { l, c: 0, h: 0 });
  }

  for (const id of Object.keys(overrides)) {
    if (!colors.has(id)) throw new Error(`override ${id}: unknown primitive`);
  }

  return colors;
}

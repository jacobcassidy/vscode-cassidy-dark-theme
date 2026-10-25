import { fields, number, object } from "./jsonc.js";
import { fromHex, maxChroma, normalizeHex, toHex, validateHex, validateOklch, withAlpha } from "./colors.js";

function identifier(value, label) {
  if (!/^[a-z][a-z0-9-]*$/i.test(value)) throw new Error(`${label}: invalid identifier ${value}`);
}

function record(target, resolved, hex = toHex(resolved), reason) {
  return { target, resolved, hex, exported: fromHex(hex), ...(reason ? { reason } : {}) };
}

function validateDetails(details, id) {
  const label = `token ${id}.details`;

  fields(details, ["for", "inherits", "overrides"], label);

  if (!Object.keys(details).length) throw new Error(`${label}: omit empty details`);

  for (const [key, value] of Object.entries(details)) {
    if (key === "for") {
      if (typeof value !== "string" || !value.trim()) throw new Error(`${label}.for: expected a nonempty string`);
    } else if (
      !Array.isArray(value) ||
      !value.length ||
      value.some((token) => typeof token !== "string" || !token.trim()) ||
      new Set(value).size !== value.length
    ) {
      throw new Error(`${label}.${key}: expected a nonempty array of unique token names`);
    }
  }
}

export function generatePalette(config) {
  fields(config, ["chroma", "families", "neutrals", "overrides"], "palette");
  fields(config.chroma, ["strength", "gamutFraction"], "palette.chroma");
  number(config.chroma.strength, 0, Number.MAX_VALUE, "palette.chroma.strength");
  number(config.chroma.gamutFraction, 0, 1, "palette.chroma.gamutFraction");
  object(config.families, "palette.families");
  object(config.neutrals, "palette.neutrals");
  object(config.overrides ?? {}, "palette.overrides");

  const colors = new Map();
  const overrides = config.overrides ?? {};

  function add(id, target, fraction = config.chroma.gamutFraction) {
    validateOklch(target, id);

    const override = overrides[id];
    const resolved = { ...target, c: Math.min(target.c, fraction * maxChroma(target.l, target.h)) };

    if (!override) {
      colors.set(id, record(target, resolved));

      return;
    }

    fields(override, ["hex", "oklch", "reason"], `override ${id}`);

    if (typeof override.reason !== "string" || !override.reason.trim()) {
      throw new Error(`override ${id}: a reason is required`);
    }

    if (Object.hasOwn(override, "hex") === Object.hasOwn(override, "oklch")) {
      throw new Error(`override ${id}: provide exactly one of hex or oklch`);
    }

    if (Object.hasOwn(override, "hex")) {
      validateHex(override.hex, id);

      const hex = normalizeHex(override.hex);

      colors.set(id, record(target, fromHex(hex), hex, override.reason));
    } else {
      validateOklch(override.oklch, id);

      const color = { ...override.oklch, c: Math.min(override.oklch.c, maxChroma(override.oklch.l, override.oklch.h)) };

      colors.set(id, record(override.oklch, color, toHex(color), override.reason));
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

    const base = family.baseChroma ?? config.chroma.strength * (1 - family.lightness);

    for (const [tone, l] of [
      ["300", Math.min(family.lightness + 0.1, 0.975)],
      ["400", family.lightness],
      ["400-muted", family.lightness],
      ["500", family.lightness - 0.1],
      ["600", family.lightness - 0.2],
    ]) {
      const c =
        tone === "400-muted"
          ? colors.get(`palette.${name}.400`).resolved.c / 2
          : Math.max(0, base + config.chroma.strength * (family.lightness - l));

      add(`palette.${name}.${tone}`, { l, c, h: family.hue }, tone === "400-muted" ? 1 : config.chroma.gamutFraction);
    }
  }

  const neutrals = Object.entries(config.neutrals).sort(([a], [b]) => {
    const left = Number(a);
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

export function resolveTokens(definitions, palette) {
  object(definitions, "tokens");

  const tokens = new Map();
  const resolved = new Map();

  function collect(group, path = []) {
    object(group, `token group ${path.join(".") || "tokens"}`);

    for (const [key, value] of Object.entries(group)) {
      const parts = [...path, key];
      const id = parts.join(".");

      if (!/^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/i.test(key) || parts[0] === "palette" || id.startsWith("palette.")) {
        throw new Error(`invalid semantic token ID ${id}`);
      }

      object(value, `token ${id}`);

      if (["color", "alpha", "details", "reason"].some((field) => Object.hasOwn(value, field))) {
        fields(value, ["color", "alpha", "details", "reason"], `token ${id}`);

        if (parts.length < 2 || typeof value.color !== "string" || !value.color.trim()) {
          throw new Error(`token ${id}: color must be a hex color or token reference in a named group`);
        }

        if (tokens.has(id)) throw new Error(`duplicate semantic token ID ${id}`);

        if (Object.hasOwn(value, "details")) validateDetails(value.details, id);

        tokens.set(id, value);
      } else {
        collect(value, parts);
      }
    }
  }

  collect(definitions);

  function resolve(id, chain = []) {
    if (chain.includes(id)) throw new Error(`Token cycle: ${[...chain, id].join(" → ")}`);

    if (resolved.has(id)) return resolved.get(id);

    if (palette.has(id)) return palette.get(id).hex;

    if (!tokens.has(id)) throw new Error(`Unknown reference: ${[...chain, id].join(" → ")}`);

    const definition = tokens.get(id);
    let hex;

    if (!definition.color.startsWith("#")) {
      hex = resolve(definition.color, [...chain, id]);
    } else {
      validateHex(definition.color, id);

      if (typeof definition.reason !== "string" || !definition.reason.trim()) {
        throw new Error(`token ${id}: literal hex requires a reason`);
      }

      hex = normalizeHex(definition.color);
    }

    if (Object.hasOwn(definition, "alpha")) {
      hex = withAlpha(hex, definition.alpha);
    }

    resolved.set(id, hex);

    return hex;
  }

  for (const id of tokens.keys()) {
    resolve(id);
  }

  return resolved;
}

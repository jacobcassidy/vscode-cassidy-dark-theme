import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "jsonc-parser";
import { buildTheme, renderTemplate } from "../scripts/build-theme.js";
import { contrastRatio, fromHex, inGamut, maxChroma, toHex, withAlpha } from "../scripts/lib/colors.js";
import { parseJsonc } from "../scripts/lib/jsonc.js";
import { generatePalette, resolveTokens } from "../scripts/lib/palette.js";

function configuration() {
  return {
    chroma: { strength: 0.5, gamutFraction: 0.9 },
    families: { yellow: { hue: 90, lightness: 0.9, baseChroma: 0.075 }, blue: { hue: 255, lightness: 0.75 } },
    neutrals: { 900: 0.26, "000": 0.98, white: 1, black: 0 },
    overrides: {},
  };
}

const template = `{
  // Keep comments, including disabled {missing.reference} examples.
  "name": "Fixture",
  "colors": { "editor.background": "{surface.editor}", "editor.foreground": "{syntax.string}" },
  "semanticHighlighting": true,
  "semanticTokenColors": {
    "variable": "{syntax.string}",
    "function": { "foreground": "{syntax.string}", "italic": true }
  },
  "tokenColors": [{
    "name": "Ordered scopes", "scope": ["second", "first"],
    "settings": { "foreground": "{syntax.string}", "background": "{surface.editor}", "fontStyle": "bold italic" }
  }]
}`;

function definitions() {
  return { "surface.editor": { ref: "palette.gray.900" }, "syntax.string": { ref: "palette.yellow.400" } };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "cassidy-build-"));

  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/palette.jsonc"), JSON.stringify(configuration()));
  await writeFile(join(root, "src/tokens.jsonc"), JSON.stringify(definitions()));
  await writeFile(join(root, "src/cassidy-dark-color-theme.jsonc"), template);

  return root;
}

test("known sRGB/OKLCH conversions and neutral endpoints", () => {
  assert.equal(toHex({ l: 0.9, c: 0.075, h: 90 }), "#f1dda5");
  assert.equal(toHex({ l: 0, c: 0, h: 0 }), "#000000");
  assert.equal(toHex({ l: 1, c: 0, h: 0 }), "#ffffff");
  assert.equal(fromHex("#808080").c, 0);

  const red = fromHex("#ff0000");

  assert.ok(Math.abs(red.l - 0.627955) < 0.000001);
  assert.ok(Math.abs(red.c - 0.257683) < 0.000001);
  assert.ok(Math.abs(red.h - 29.234) < 0.001);
  assert.equal(toHex(red), "#ff0000");
  assert.throws(() => toHex({ l: 0.9, c: 0.3, h: 90 }), /out-of-gamut/);
});

test("yellow's selected anchor generates the agreed five tones", () => {
  const palette = generatePalette(configuration());

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

test("contrast uses exported sRGB luminance and requires opaque colors", () => {
  assert.equal(contrastRatio("#fff", "#000"), 21);
  assert.equal(contrastRatio("#f8f8f8", "#f8f8f8"), 1);
  assert.equal(contrastRatio("#f8f8f8", "#1e70ce").toFixed(2), "4.64");
  assert.equal(contrastRatio("#1e70ce", "#f8f8f8ff"), contrastRatio("#f8f8f8", "#1e70ce"));
  assert.equal(contrastRatio("#f8f8f8", "#1e70ce80"), null);
  assert.equal(contrastRatio("#fff8", "#000"), null);
  assert.throws(() => contrastRatio("invalid", "#000"), /hex color/);
});

test("default chroma, zero anchors, gamut headroom, and override policy", () => {
  const input = configuration();
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
    const input = configuration();

    mutate(input);
    assert.throws(() => generatePalette(input));
  }
});

test("token aliases resolve chains and replace inherited alpha", () => {
  const palette = generatePalette(configuration());

  const tokens = resolveTokens(
    {
      "syntax.string": { ref: "palette.yellow.400" },
      "overlay.first": { ref: "syntax.string", alpha: 0.1 },
      "overlay.second": { ref: "overlay.first", alpha: 0.2 },
      "overlay.opaque": { ref: "overlay.second", alpha: 1 },
      "overlay.empty": { ref: "overlay.second", alpha: 0 },
      "ui.custom": { hex: "#abc", reason: "A component-specific exception" },
    },
    palette,
  );

  assert.equal(tokens.get("overlay.first"), "#f1dda51a");
  assert.equal(tokens.get("overlay.second"), "#f1dda533");
  assert.equal(tokens.get("overlay.opaque"), "#f1dda5");
  assert.equal(tokens.get("overlay.empty"), "#f1dda500");
  assert.equal(tokens.get("ui.custom"), "#aabbcc");
  assert.equal(withAlpha("#0009", 0.5), "#00000080");
  assert.throws(() => withAlpha("#123456", NaN), /finite number/);
});

test("unknown references, cycles, invalid alpha, and undocumented literal tokens fail", () => {
  const palette = generatePalette(configuration());

  assert.throws(
    () => resolveTokens({ "unused.alias": { ref: "missing.token" } }, palette),
    /unused.alias → missing.token/,
  );

  assert.throws(
    () => resolveTokens({ "a.one": { ref: "b.two" }, "b.two": { ref: "a.one" } }, palette),
    /a.one → b.two → a.one/,
  );

  assert.throws(() => resolveTokens({ "a.one": { ref: "palette.yellow.400", alpha: 2 } }, palette), /finite number/);
  assert.throws(() => resolveTokens({ "a.one": { hex: "#123456" } }, palette), /reason/);
  assert.throws(() => resolveTokens({ "a.one": { ref: "palette.yellow.400", typo: true } }, palette), /unknown field/);
});

test("JSONC parsing rejects duplicate keys and reports file locations", () => {
  assert.throws(
    () => parseJsonc('{\n "nested": {"a": 1, "a": 2}}', "input.jsonc"),
    /input.jsonc:2:\d+: duplicate key a/,
  );

  assert.throws(() => parseJsonc('{"a":}', "input.jsonc"), /input.jsonc:1:/);
  assert.equal(parseJsonc('{ // Comment\n"a": 1,}', "input.jsonc").value.a, 1);
});

test("template replacement covers all color positions and preserves comments and non-color data", () => {
  const palette = generatePalette(configuration());
  const output = renderTemplate(template, resolveTokens(definitions(), palette), palette);
  const theme = parse(output);

  assert.equal(theme.colors["editor.foreground"], "#f1dda5");
  assert.equal(theme.semanticTokenColors.variable, "#f1dda5");
  assert.deepEqual(theme.semanticTokenColors.function, { foreground: "#f1dda5", italic: true });
  assert.deepEqual(theme.tokenColors[0].scope, ["second", "first"]);
  assert.deepEqual(theme.tokenColors[0].settings, {
    foreground: "#f1dda5",
    background: "#242424",
    fontStyle: "bold italic",
  });

  assert.match(output, /Keep comments, including disabled \{missing.reference\} examples/);
  assert.match(output, /^\/\/ Generated/);
  assert.throws(
    () =>
      renderTemplate(
        template.replace('"fontStyle": "bold italic"', '"fontStyle": "{syntax.string}"'),
        resolveTokens(definitions(), palette),
        palette,
      ),
    /outside a color position/,
  );

  assert.throws(
    () =>
      renderTemplate(
        template.replace("{syntax.string}", "{missing.reference}"),
        resolveTokens(definitions(), palette),
        palette,
      ),
    /unknown template reference/,
  );

  assert.throws(
    () => renderTemplate(template.replace('"tokenColors": [', '"tokenColors": null, "other": ['), new Map(), palette),
    /must be an array/,
  );
});

test("build is deterministic, checks every artifact without writing, and updates only stale output", async (t) => {
  const root = await fixture(t);

  await assert.rejects(buildTheme({ root, check: true }), /missing or stale/);
  assert.deepEqual(await readdir(root), ["src"]);

  const first = await buildTheme({ root });

  assert.equal(first.changed.length, 4);

  const themePath = join(root, "themes/cassidy-dark-color-theme.json");
  const before = await stat(themePath);
  const output = await readFile(themePath, "utf8");

  assert.equal((await buildTheme({ root })).changed.length, 0);
  await buildTheme({ root, check: true });
  assert.equal((await stat(themePath)).mtimeMs, before.mtimeMs);

  const reportPath = join(root, "docs/references/palettes/generated/palette.generated.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert.equal(report.primitives["palette.yellow.400"].hex, "#f1dda5");
  await writeFile(reportPath, "stale");
  await assert.rejects(buildTheme({ root, check: true }), /palette.generated.json/);
  assert.equal(await readFile(reportPath, "utf8"), "stale");
  assert.deepEqual((await buildTheme({ root })).changed, ["docs/references/palettes/generated/palette.generated.json"]);
  assert.equal(await readFile(themePath, "utf8"), output);
});

test("failed validation leaves all previous outputs intact and palette-only mode needs no template", async (t) => {
  const root = await fixture(t);
  const initial = await buildTheme({ root });
  const snapshots = await Promise.all(
    initial.changed.map(async (path) => [path, await readFile(join(root, path), "utf8")]),
  );

  await writeFile(join(root, "src/tokens.jsonc"), '{"unused.alias":{"ref":"missing.color"}}');
  await assert.rejects(buildTheme({ root }), /Unknown reference/);

  for (const [path, text] of snapshots) {
    assert.equal(await readFile(join(root, path), "utf8"), text);
  }

  assert.deepEqual(await readdir(join(root, "themes")), ["cassidy-dark-color-theme.json"]);
  await rm(join(root, "src/tokens.jsonc"));
  await rm(join(root, "src/cassidy-dark-color-theme.jsonc"));
  assert.equal((await buildTheme({ root, paletteOnly: true })).changed.length, 0);
});

test("palette reports include 600 contrast from final hex and flag translucent overrides", async (t) => {
  const root = await fixture(t);
  await buildTheme({ root, paletteOnly: true });
  const path = join(root, "docs/references/palettes/generated/palette.generated.md");
  const markdown = await readFile(path, "utf8");
  const section = markdown.split("## Tone 600 contrast")[1].split("## Full palette")[0];
  assert.match(section, /Foreground: `#f8f8f8`/);
  assert.match(section, /`palette.blue.600`\s*\|\s*`#1e70ce`\s*\|\s*4\.64:1/);
  assert.match(section, /`palette.yellow.600`\s*\|\s*`#bd9a2c`\s*\|\s*2\.53:1/);
  assert.doesNotMatch(section, /palette\.gray|palette\.blue\.500/);
  const input = configuration();
  input.overrides["palette.blue.600"] = { hex: "#000000", reason: "Check exported override contrast" };
  await writeFile(join(root, "src/palette.jsonc"), JSON.stringify(input));
  await buildTheme({ root, paletteOnly: true });
  assert.match(await readFile(path, "utf8"), /`palette.blue.600`\s*\|\s*`#000000`\s*\|\s*19\.77:1/);
  input.overrides["palette.blue.600"].hex = "#00000080";
  await writeFile(join(root, "src/palette.jsonc"), JSON.stringify(input));
  await buildTheme({ root, paletteOnly: true });
  assert.match(await readFile(path, "utf8"), /`palette.blue.600`\s*\|\s*`#00000080`\s*\|\s*Needs backdrop/);
});

test("the authored palette keeps base syntax and colored control text readable", async () => {
  const config = parseJsonc(await readFile(new URL("../src/palette.jsonc", import.meta.url), "utf8"), "palette").value;
  const aliases = parseJsonc(await readFile(new URL("../src/tokens.jsonc", import.meta.url), "utf8"), "tokens").value;
  const source = await readFile(new URL("../src/cassidy-dark-color-theme.jsonc", import.meta.url), "utf8");
  const palette = generatePalette(config);
  const theme = parse(renderTemplate(source, resolveTokens(aliases, palette), palette));

  for (const name of Object.keys(config.families)) {
    assert.ok(contrastRatio(palette.get(`palette.${name}.400`).hex, theme.colors["editor.background"]) >= 4.5, name);
  }

  for (const [background, foreground] of [
    ["button.background", "button.foreground"],
    ["button.hoverBackground", "button.foreground"],
    ["statusBar.debuggingBackground", "statusBar.debuggingForeground"],
  ]) {
    assert.ok(contrastRatio(theme.colors[foreground], theme.colors[background]) >= 4.5, background);
  }
});

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse, parseTree } from "jsonc-parser";
import { assembleThemeTemplate, buildDev, buildTheme, renderTemplate } from "../scripts/build/build-theme.js";
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
  "name": "Fixture",
  "colors": {
    // Keep comments, including disabled {missing.reference} examples.
    "editor.background": "{surface.editor}", "editor.foreground": "{syntax.string}"
  },
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

const themePartNames = ["base", "colors", "semantic", "syntax"];
const themePartGroups = {
  base: ["$schema", "name", "type", "author"],
  colors: ["colors"],
  semantic: ["semanticHighlighting", "semanticTokenColors"],
  syntax: ["tokenColors"],
};

async function writeThemeParts(directory, source) {
  const tree = parseTree(source);
  const properties = new Map(
    (tree.children ?? []).map((property) => {
      const [key] = property.children;

      return [key.value, source.slice(property.offset, property.offset + property.length)];
    }),
  );

  await mkdir(directory, { recursive: true });

  for (const name of themePartNames) {
    const part = themePartGroups[name].map((key) => properties.get(key)).filter(Boolean);

    await writeFile(join(directory, `${name}.jsonc`), `{\n${part.join(",\n")}\n}\n`);
  }
}

async function readThemeParts(directory) {
  const path = directory instanceof URL ? fileURLToPath(directory) : directory;
  const parts = await Promise.all(themePartNames.map((name) => readFile(join(path, `${name}.jsonc`), "utf8")));

  return assembleThemeTemplate(parts);
}

function definitions() {
  return {
    surface: { editor: { color: "palette.gray.900", alpha: 1 } },
    syntax: { string: { color: "palette.yellow.400", alpha: 1 } },
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "cassidy-build-"));

  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/palette.jsonc"), JSON.stringify(configuration()));
  await writeFile(join(root, "src/tokens.jsonc"), JSON.stringify(definitions()));
  await writeThemeParts(join(root, "src/theme"), template);

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

test("nested tokens resolve forward aliases, dotted selectors, and absolute alpha", () => {
  const palette = generatePalette(configuration());

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
  const palette = generatePalette(configuration());

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
  const palette = generatePalette(configuration());

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
  const palette = generatePalette(configuration());
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
  const palette = generatePalette(configuration());

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

  const reportPath = join(root, "dev/generated/palette/palette.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert.equal(report.primitives["palette.yellow.400"].hex, "#f1dda5");
  await writeFile(reportPath, "stale");
  await assert.rejects(buildTheme({ root, check: true }), /palette.json/);
  assert.equal(await readFile(reportPath, "utf8"), "stale");
  assert.deepEqual((await buildTheme({ root })).changed, ["dev/generated/palette/palette.json"]);
  assert.equal(await readFile(themePath, "utf8"), output);
});

test("failed validation leaves all previous outputs intact and palette-only mode needs no template", async (t) => {
  const root = await fixture(t);
  const initial = await buildTheme({ root });
  const snapshots = await Promise.all(
    initial.changed.map(async (path) => [path, await readFile(join(root, path), "utf8")]),
  );

  await writeFile(join(root, "src/tokens.jsonc"), '{"unused":{"alias":{"color":"missing.color"}}}');
  await assert.rejects(buildTheme({ root }), /Unknown reference/);

  for (const [path, text] of snapshots) {
    assert.equal(await readFile(join(root, path), "utf8"), text);
  }

  assert.deepEqual(await readdir(join(root, "themes")), ["cassidy-dark-color-theme.json"]);
  await rm(join(root, "src/tokens.jsonc"));
  await rm(join(root, "src/theme"), { recursive: true });
  assert.equal((await buildTheme({ root, paletteOnly: true })).changed.length, 0);
});

test("editing token details leaves all generated artifacts unchanged", async (t) => {
  const root = await fixture(t);

  await buildTheme({ root });

  const input = definitions();

  input.surface.editor.details = { for: "Editor background." };
  await writeFile(join(root, "src/tokens.jsonc"), JSON.stringify(input));
  assert.deepEqual((await buildTheme({ root, check: true })).changed, []);
  assert.deepEqual((await buildTheme({ root })).changed, []);
});

test("palette reports include 600 contrast from final hex and flag translucent overrides", async (t) => {
  const root = await fixture(t);
  await buildTheme({ root, paletteOnly: true });
  const path = join(root, "dev/generated/palette/palette.md");
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
  const source = await readThemeParts(new URL("../src/theme", import.meta.url));
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

test("development targets merge palette settings, replace token leaves, and isolate outputs", async (t) => {
  const root = await fixture(t);
  const experiment = join(root, "dev/experiments/sample");
  const productionTheme = join(root, "src/theme");

  await mkdir(experiment, { recursive: true });
  await writeFile(join(experiment, "palette.jsonc"), '{"families":{"yellow":{"hue":95}}}');
  await writeFile(
    join(experiment, "tokens.jsonc"),
    '{"syntax":{"string":{"color":"#abcdef","reason":"Test exception"}}}',
  );
  await writeFile(join(experiment, "colors.jsonc"), '{"colors":{"editor.background":"#010203"}}');
  await writeFile(join(experiment, "base.jsonc"), '{"author":"Sample"}');
  await writeFile(
    join(experiment, "syntax.jsonc"),
    '{"tokenColors":[{"scope":"test.syntax","settings":{"foreground":"{syntax.string}"}}]}',
  );

  const result = await buildDev({ root });

  assert.equal(result[0].name, "sample");
  assert.equal(result[0].palette.get("palette.yellow.400").target.h, 95);
  assert.equal(result[0].changed.length, 4);
  const experimentTheme = await readFile(join(root, "dev/themes/cassidy-dark-color-theme-sample.json"), "utf8");

  assert.match(experimentTheme, /#abcdef/);
  assert.equal(parse(experimentTheme).colors["editor.background"], "#010203");
  assert.equal(parse(experimentTheme).author, "Sample");
  assert.equal(parse(experimentTheme).semanticTokenColors.variable, "#abcdef");
  assert.deepEqual(parse(experimentTheme).tokenColors[0].scope, "test.syntax");
  await assert.rejects(readFile(join(root, "themes/cassidy-dark-color-theme.json")), { code: "ENOENT" });
  assert.equal(await readThemeParts(productionTheme), template);
  assert.deepEqual(
    (await buildDev({ root, check: true })).map(({ changed }) => changed),
    [[]],
  );
});

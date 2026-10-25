import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parse } from "jsonc-parser";
import { buildDev, buildTheme, renderTemplate } from "../scripts/themes/build-theme.js";
import { contrastRatio } from "../scripts/lib/colors.js";
import { parseJsonc } from "../scripts/lib/jsonc.js";
import { generatePalette, resolveTokens } from "../scripts/lib/palette.js";
import {
  createBuildProject,
  createPaletteConfig,
  createVariables,
  readBuildOutputs,
  readThemeParts,
  themePartNames,
  themeTemplate,
} from "./test-projects.js";

test("JSONC parsing rejects duplicate keys and reports file locations", () => {
  assert.throws(
    () => parseJsonc('{\n "nested": {"a": 1, "a": 2}}', "input.jsonc"),
    /input.jsonc:2:\d+: duplicate key a/,
  );

  assert.throws(() => parseJsonc('{"a":}', "input.jsonc"), /input.jsonc:1:/);
  assert.equal(parseJsonc('{ // Comment\n"a": 1,}', "input.jsonc").value.a, 1);
});

test("template replacement covers all color positions and preserves comments and non-color data", () => {
  const palette = generatePalette(createPaletteConfig());
  const output = renderTemplate(themeTemplate, resolveTokens(createVariables(), palette), palette);
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
        themeTemplate.replace('"fontStyle": "bold italic"', '"fontStyle": "{syntax.string}"'),
        resolveTokens(createVariables(), palette),
        palette,
      ),
    /outside a color position/,
  );

  assert.throws(
    () =>
      renderTemplate(
        themeTemplate.replace("{syntax.string}", "{missing.reference}"),
        resolveTokens(createVariables(), palette),
        palette,
      ),
    /unknown template reference/,
  );

  assert.throws(
    () =>
      renderTemplate(themeTemplate.replace('"tokenColors": [', '"tokenColors": null, "other": ['), new Map(), palette),
    /must be an array/,
  );
});

test("build is deterministic, checks every artifact without writing, and updates only stale output", async (t) => {
  const root = await createBuildProject(t);

  await assert.rejects(buildTheme({ root, check: true }), /missing or stale/);
  assert.deepEqual(await readdir(root), ["package.json", "src"]);

  const first = await buildTheme({ root });

  assert.equal(first.changed.length, 5);

  const themePath = join(root, "themes/cassidy-dark-color-theme.json");
  const before = await stat(themePath);
  const output = await readFile(themePath, "utf8");

  assert.equal((await buildTheme({ root })).changed.length, 0);
  await buildTheme({ root, check: true });
  assert.equal((await stat(themePath)).mtimeMs, before.mtimeMs);

  const reportPath = join(root, "docs/palettes/generated-reports/default/palette.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert.equal(report.primitives["palette.yellow.400"].hex, "#f1dda5");
  await writeFile(reportPath, "stale");
  await assert.rejects(buildTheme({ root, check: true }), /palette.json/);
  assert.equal(await readFile(reportPath, "utf8"), "stale");
  assert.deepEqual((await buildTheme({ root })).changed, ["docs/palettes/generated-reports/default/palette.json"]);
  assert.equal(await readFile(themePath, "utf8"), output);
});

test("failed validation leaves all previous outputs intact and palette-only mode needs no template", async (t) => {
  const root = await createBuildProject(t);
  const initial = await buildTheme({ root });
  const snapshots = await Promise.all(
    initial.changed.map(async (path) => [path, await readFile(join(root, path), "utf8")]),
  );

  await writeFile(
    join(root, "src/production/themes/default/colors/variables.jsonc"),
    '{"unused":{"alias":{"color":"missing.color"}}}',
  );
  await assert.rejects(buildTheme({ root }), /Unknown reference/);

  for (const [path, text] of snapshots) {
    assert.equal(await readFile(join(root, path), "utf8"), text);
  }

  assert.deepEqual(await readdir(join(root, "themes")), ["cassidy-dark-color-theme.json"]);
  await rm(join(root, "src/production/themes/default/colors/variables.jsonc"));
  await rm(join(root, "src/production/themes/default/tokens"), { recursive: true });
  await rm(join(root, "src/production/themes/default/metadata.jsonc"));
  assert.equal((await buildTheme({ root, paletteOnly: true })).changed.length, 0);
});

test("editing token details leaves all generated artifacts unchanged", async (t) => {
  const root = await createBuildProject(t);

  await buildTheme({ root });

  const input = createVariables();

  input.surface.editor.details = { for: "Editor background." };
  await writeFile(join(root, "src/production/themes/default/colors/variables.jsonc"), JSON.stringify(input));
  assert.deepEqual((await buildTheme({ root, check: true })).changed, []);
  assert.deepEqual((await buildTheme({ root })).changed, []);
});

test("palette reports include 600 contrast from final hex and flag translucent overrides", async (t) => {
  const root = await createBuildProject(t);
  await buildTheme({ root, paletteOnly: true });
  const path = join(root, "docs/palettes/generated-reports/default/palette.md");
  const markdown = await readFile(path, "utf8");
  const section = markdown.split("## Tone 600 contrast")[1].split("## Full palette")[0];
  assert.match(section, /Foreground: `#f8f8f8`/);
  assert.match(section, /`palette.blue.600`\s*\|\s*`#1e70ce`\s*\|\s*4\.64:1/);
  assert.match(section, /`palette.yellow.600`\s*\|\s*`#bd9a2c`\s*\|\s*2\.53:1/);
  assert.doesNotMatch(section, /palette\.gray|palette\.blue\.500/);
  const input = createPaletteConfig();
  input.overrides["palette.blue.600"] = { hex: "#000000", reason: "Check exported override contrast" };
  await writeFile(join(root, "src/production/themes/default/colors/palette.jsonc"), JSON.stringify(input));
  await buildTheme({ root, paletteOnly: true });
  assert.match(await readFile(path, "utf8"), /`palette.blue.600`\s*\|\s*`#000000`\s*\|\s*19\.77:1/);
  input.overrides["palette.blue.600"].hex = "#00000080";
  await writeFile(join(root, "src/production/themes/default/colors/palette.jsonc"), JSON.stringify(input));
  await buildTheme({ root, paletteOnly: true });
  assert.match(await readFile(path, "utf8"), /`palette.blue.600`\s*\|\s*`#00000080`\s*\|\s*Needs backdrop/);
});

test("the authored palette keeps base syntax and colored control text readable", async () => {
  const config = parseJsonc(
    await readFile(new URL("../src/production/themes/default/colors/palette.jsonc", import.meta.url), "utf8"),
    "palette",
  ).value;
  const aliases = parseJsonc(
    await readFile(new URL("../src/production/themes/default/colors/variables.jsonc", import.meta.url), "utf8"),
    "tokens",
  ).value;
  const source = await readThemeParts(new URL("../src/production/themes/default", import.meta.url));
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

test("local targets use independent complete palettes and variables and isolate outputs", async (t) => {
  const root = await createBuildProject(t);
  const experiment = join(root, "src/local/themes/sample");
  const productionTheme = join(root, "src/production/themes/default");
  const input = createPaletteConfig();
  const variables = createVariables();

  input.families.yellow.hue = 95;
  variables.syntax.string = { color: "#abcdef", reason: "Test exception" };
  await mkdir(join(experiment, "colors"), { recursive: true });
  await mkdir(join(experiment, "tokens"));
  await writeFile(join(experiment, "colors/palette.jsonc"), JSON.stringify(input));
  await writeFile(join(experiment, "colors/variables.jsonc"), JSON.stringify(variables));
  await writeFile(join(experiment, "tokens/ui.jsonc"), '{"colors":{"editor.background":"#010203"}}');
  await writeFile(join(experiment, "metadata.jsonc"), '{"name":"Sample","type":"dark","author":"Sample"}');
  await writeFile(
    join(experiment, "tokens/syntax.jsonc"),
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
  assert.equal(await readThemeParts(productionTheme), themeTemplate);
  assert.deepEqual(
    (await buildDev({ root, check: true })).map(({ changed }) => changed),
    [[]],
  );
});

for (const relative of [
  "colors/palette.jsonc",
  "colors/variables.jsonc",
  ...themePartNames.map((name) => `${name}.jsonc`),
]) {
  test(`missing default ${relative} fails even for an otherwise inherited local theme`, async (t) => {
    const root = await createBuildProject(t);

    await mkdir(join(root, "src/local/themes/inherited"), { recursive: true });
    await rm(join(root, "src/production/themes/default", relative));
    await assert.rejects(buildDev({ root }), /missing required theme input/);
    assert.deepEqual(await readdir(root), ["package.json", "src"]);
  });
}

test("fully inherited local targets produce their own reports and follow changed default palettes", async (t) => {
  const root = await createBuildProject(t);
  const local = join(root, "src/local/themes/inherited");

  await mkdir(local, { recursive: true });
  await buildTheme({ root });

  const production = await readBuildOutputs(root);
  const result = await buildDev({ root });
  const reportPath = join(root, "docs/palettes/generated-reports/inherited/palette.json");
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert.equal(result.length, 1);
  assert.equal(report.generated.target, "local/inherited");
  assert.equal(report.generated.source, "src/production/themes/default/colors/palette.jsonc");
  assert.equal(report.generated.fallback, true);
  assert.equal(
    parse(await readFile(join(root, "dev/themes/cassidy-dark-color-theme-inherited.json"), "utf8")).name,
    "Fixture",
  );

  for (const [path, text] of production) assert.equal(await readFile(join(root, path), "utf8"), text);

  const input = createPaletteConfig();

  input.families.yellow.hue = 95;
  await writeFile(join(root, "src/production/themes/default/colors/palette.jsonc"), JSON.stringify(input));
  await assert.rejects(buildDev({ root, check: true }), /missing or stale/);
  assert.equal(await readFile(reportPath, "utf8"), JSON.stringify(report, null, 2) + "\n");
  await buildDev({ root });
  assert.equal(JSON.parse(await readFile(reportPath, "utf8")).primitives["palette.yellow.400"].target.h, 95);
  await assert.rejects(buildTheme({ root, check: true }), /missing or stale/);
});

for (const [path, contents, pattern] of [
  ["colors/palette.jsonc", '{"families":{"yellow":{"hue":95}}}', /palette.chroma/],
  [
    "colors/variables.jsonc",
    '{"syntax":{"string":{"color":"palette.yellow.400"}}}',
    /unknown template reference surface.editor/,
  ],
  ["metadata.jsonc", "{}", /theme name must be/],
  ["tokens/ui.jsonc", "{}", /colors: expected an object/],
  ["tokens/semantic.jsonc", '{"semanticHighlighting":"yes"}', /semanticHighlighting must be a boolean/],
  ["tokens/syntax.jsonc", '{"tokenColors":{}}', /tokenColors must be an array/],
  ["colors/palette.jsonc", "", /ValueExpected/],
  ["colors/palette.jsonc", '{"chroma":', /ValueExpected/],
  ["colors/variables.jsonc", '{"unused":{"one":{"color":"unused.two"},"two":{"color":"unused.one"}}}', /Token cycle/],
]) {
  test(`supplied ${path} validates in full without merging or falling back: ${contents}`, async (t) => {
    const root = await createBuildProject(t);
    const local = join(root, "src/local/themes/sample");

    await mkdir(join(local, path, ".."), { recursive: true });
    await writeFile(join(local, path), contents);
    await assert.rejects(buildDev({ root }), pattern);
    await assert.rejects(readFile(join(root, "dev/themes/cassidy-dark-color-theme-sample.json")), { code: "ENOENT" });
  });
}

test("a supplied UI mapping replaces the whole file while omitted files inherit", async (t) => {
  const root = await createBuildProject(t);

  await mkdir(join(root, "src/local/themes/sample/tokens"), { recursive: true });
  await writeFile(join(root, "src/local/themes/sample/tokens/ui.jsonc"), '{"colors":{"editor.background":"#010203"}}');
  await buildDev({ root });

  const theme = parse(await readFile(join(root, "dev/themes/cassidy-dark-color-theme-sample.json"), "utf8"));

  assert.deepEqual(theme.colors, { "editor.background": "#010203" });
  assert.equal(theme.type, "dark");
  assert.equal(theme.tokenColors[0].settings.foreground, "#f1dda5");
});

for (const group of ["production", "local"]) {
  test(`an invalid later ${group} target leaves every previous output and manifest intact`, async (t) => {
    const root = await createBuildProject(t);
    const build = group === "production" ? buildTheme : buildDev;
    const target = join(root, `src/${group}/themes/z-invalid`);

    await mkdir(join(target, "colors"), { recursive: true });
    await build({ root });

    const before = await readBuildOutputs(root);
    const config = createPaletteConfig();

    config.families.yellow.hue = 95;
    await writeFile(join(root, "src/production/themes/default/colors/palette.jsonc"), JSON.stringify(config));
    await writeFile(join(target, "colors/variables.jsonc"), '{"unused":{"alias":{"color":"unknown.color"}}}');
    await assert.rejects(build({ root }), /Unknown reference/);
    assert.deepEqual(await readBuildOutputs(root), before);
  });
}

test("production targets register matching theme types and preserve unrelated manifest fields", async (t) => {
  const root = await createBuildProject(t);
  const manifestPath = join(root, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  manifest.contributes.commands = [{ command: "fixture.command", title: "Keep" }];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await mkdir(join(root, "src/production/themes/high-contrast"));
  await writeFile(join(root, "src/production/themes/high-contrast/metadata.jsonc"), '{"name":"Fixture","type":"hc"}');
  await buildTheme({ root });

  const registered = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.deepEqual(registered.extra, { preserved: true });
  assert.deepEqual(registered.contributes.commands, manifest.contributes.commands);
  assert.deepEqual(registered.contributes.themes, [
    { label: "Fixture", uiTheme: "vs-dark", path: "./themes/cassidy-dark-color-theme.json" },
    {
      label: "Fixture (High Contrast)",
      uiTheme: "hc-black",
      path: "./themes/cassidy-dark-color-theme-high-contrast.json",
    },
  ]);

  registered.contributes.themes[1].uiTheme = "vs-dark";
  await writeFile(manifestPath, JSON.stringify(registered));

  const before = await readBuildOutputs(root);

  await assert.rejects(buildTheme({ root, check: true }), /package.json/);
  assert.deepEqual(await readBuildOutputs(root), before);
});

for (const name of ["default", "bad..name", "Uppercase", ".hidden"]) {
  test(`target discovery rejects duplicate or unsafe local name ${name} before writing`, async (t) => {
    const root = await createBuildProject(t);

    await mkdir(join(root, "src/local/themes", name), { recursive: true });
    await assert.rejects(buildTheme({ root }), /Duplicate theme name|Invalid theme name/);
    assert.deepEqual(await readdir(root), ["package.json", "src"]);
  });
}

test("stale report and theme detection is read-only and archives are never regenerated", async (t) => {
  const root = await createBuildProject(t);

  await mkdir(join(root, "docs/palettes/archive"), { recursive: true });
  await writeFile(join(root, "docs/palettes/archive/old.md"), "Historical palette\n");
  await buildTheme({ root });
  await mkdir(join(root, "docs/palettes/generated-reports/removed"));
  await writeFile(join(root, "docs/palettes/generated-reports/removed/palette.md"), "stale");

  const before = await readBuildOutputs(root);

  await assert.rejects(buildTheme({ root, check: true }), /Stale generated outputs.*removed/);
  await assert.rejects(buildDev({ root }), /Stale generated outputs.*removed/);
  assert.deepEqual(await readBuildOutputs(root), before);
  await rm(join(root, "docs/palettes/generated-reports/removed"), { recursive: true });
  await writeFile(join(root, "themes/cassidy-dark-color-theme-removed.json"), "stale");
  await assert.rejects(buildTheme({ root }), /Stale generated outputs.*theme-removed.json/);
  assert.equal(await readFile(join(root, "docs/palettes/archive/old.md"), "utf8"), "Historical palette\n");
});

test("palette-only builds all production reports without metadata, variables, mappings, or a manifest", async (t) => {
  const root = await createBuildProject(t);

  await mkdir(join(root, "src/production/themes/inherited"));
  await rm(join(root, "package.json"));
  await rm(join(root, "src/production/themes/default/metadata.jsonc"));
  await rm(join(root, "src/production/themes/default/colors/variables.jsonc"));
  await rm(join(root, "src/production/themes/default/tokens"), { recursive: true });

  const result = await buildTheme({ root, paletteOnly: true });

  assert.equal(result.targets.length, 2);
  assert.equal(result.changed.length, 6);
  assert.equal((await buildTheme({ root, paletteOnly: true, check: true })).changed.length, 0);
  await assert.rejects(readFile(join(root, "themes/cassidy-dark-color-theme.json")), { code: "ENOENT" });
});

/**
 * Theme build tests.
 * @file Verify template resolution, deterministic generation, inheritance, reports, and failed-build protections.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parse } from "jsonc-parser";
import { buildDevThemes, buildProdThemes } from "../scripts/themes/build.js";
import { contrastRatio } from "../scripts/lib/color-math.js";
import { parseJsonc } from "../scripts/lib/jsonc-validation.js";
import { generatePalette } from "../scripts/lib/palette-generation.js";
import { compileTokens, renderTheme } from "../scripts/lib/theme-compilation.js";
import {
  createBuildProject,
  createPaletteConfig,
  createTokens,
  readBuildOutputs,
  readThemeParts,
  themePartNames,
} from "./test-projects.js";

test("JSONC parsing rejects duplicate keys and reports file locations", () => {
  assert.throws(
    () => parseJsonc('{\n "nested": {"a": 1, "a": 2}}', "input.jsonc"),
    /input.jsonc:2:\d+: duplicate key a/,
  );

  assert.throws(() => parseJsonc('{"a":}', "input.jsonc"), /input.jsonc:1:/);
  assert.equal(parseJsonc('{ // Comment\n"a": 1,}', "input.jsonc").value.a, 1);
});

test("compilation resolves all color positions and strips source-only fields", () => {
  /** Generated palette used to compile the independent token sections. */
  const palette = generatePalette(createPaletteConfig());

  /** Compiled theme source with a generated notice and no ordinary source comments. */
  const output = renderTheme(
    { name: "Fixture", type: "dark" },
    compileTokens(createTokens(), { base: {}, ui: {}, semantic: {}, syntax: {} }, palette),
  );

  /** Active theme entries and preserved scope order. */
  const theme = parse(output);

  assert.equal(theme.colors["editor.foreground"], "#f1dda5");
  assert.deepEqual(theme.semanticTokenColors.variable, { foreground: "#f1dda5" });
  assert.deepEqual(theme.semanticTokenColors.function, { foreground: "#f1dda5", italic: true });
  assert.deepEqual(theme.tokenColors[0].scope, ["second", "first"]);
  assert.deepEqual(theme.tokenColors[0].settings, {
    foreground: "#f1dda5",
    background: "#242424",
    fontStyle: "bold italic",
  });
  assert.match(output, /^\/\/ Generated/);
  assert.doesNotMatch(output, /"id"|"colorReason"/);
  assert.throws(
    () =>
      renderTheme(
        { colors: {} },
        compileTokens(createTokens(), { base: {}, ui: {}, semantic: {}, syntax: {} }, palette),
      ),
    /belongs in its section file/,
  );
});

test("prod theme build is deterministic, checks every artifact without writing, and updates only stale output", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  await assert.rejects(buildProdThemes({ root, check: true }), /missing or stale/);
  assert.deepEqual(await readdir(root), ["package.json", "src"]);

  /** Initial build or manifest result retained for repeatability checks. */
  const first = await buildProdThemes({ root });

  assert.equal(first.changed.length, 5);

  /** Production theme output path used for timestamp or content assertions. */
  const themePath = join(root, "themes/cassidy-dark-color-theme.json");

  /** Output snapshot or file metadata retained before the operation under test. */
  const before = await stat(themePath);

  /** Rendered theme source used to inspect preserved text and resolved colors. */
  const output = await readFile(themePath, "utf8");

  assert.equal((await buildProdThemes({ root })).changed.length, 0);
  await buildProdThemes({ root, check: true });
  assert.equal((await stat(themePath)).mtimeMs, before.mtimeMs);

  /** Generated palette JSON report path used by the assertion. */
  const reportPath = join(root, "src/themes/prod/default/palette/generated/palette.json");

  /** Parsed palette measurements and source provenance. */
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert.equal(report.primitives["palette.yellow.400"].hex, "#f1dda5");
  await writeFile(reportPath, "stale");
  await assert.rejects(buildProdThemes({ root, check: true }), /palette.json/);
  assert.equal(await readFile(reportPath, "utf8"), "stale");
  assert.deepEqual((await buildProdThemes({ root })).changed, [
    "src/themes/prod/default/palette/generated/palette.json",
  ]);
  assert.equal(await readFile(themePath, "utf8"), output);
});

test("failed prod validation leaves all previous outputs intact and palette-only mode needs no template", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  /** First successful build result before deliberately invalidating an input. */
  const initial = await buildProdThemes({ root });

  /** Generated artifact contents captured before a rejected build. */
  const snapshots = await Promise.all(
    initial.changed.map(async (path) => [path, await readFile(join(root, path), "utf8")]),
  );

  await writeFile(
    join(root, "src/themes/prod/default/tokens/base.jsonc"),
    '{"surface":{"unused":{"color":"missing.color"}}}',
  );
  await assert.rejects(buildProdThemes({ root }), /Unknown reference/);

  for (const [path, text] of snapshots) {
    assert.equal(await readFile(join(root, path), "utf8"), text);
  }

  assert.deepEqual(await readdir(join(root, "themes")), ["cassidy-dark-color-theme.json"]);
  await rm(join(root, "src/themes/prod/default/tokens"), { recursive: true });
  await rm(join(root, "src/themes/prod/default/details"), { recursive: true });
  await rm(join(root, "src/themes/prod/default/metadata.jsonc"));
  assert.equal((await buildProdThemes({ root, paletteOnly: true })).changed.length, 0);
});

test("editing prod token details leaves all generated artifacts unchanged", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  await buildProdThemes({ root });

  await writeFile(
    join(root, "src/themes/prod/default/details/base.jsonc"),
    JSON.stringify({ "surface.editor": { for: "Editor background." } }),
  );
  assert.deepEqual((await buildProdThemes({ root, check: true })).changed, []);
  assert.deepEqual((await buildProdThemes({ root })).changed, []);
});

for (const section of ["ui", "semantic", "syntax"]) {
  test(`independent ${section} token/details fallback enforces global replacement assertions`, async (t) => {
    /** Complete default fixture and a dev target inheriting every authored input. */
    const root = await createBuildProject(t);

    /** Effective documentation key for this section. */
    const key = section === "ui" ? "editor.background" : section === "semantic" ? "variable" : "string";

    /** Default definitions copied as a complete file into the dev target. */
    const tokens = createTokens()[section];

    /** Definition corresponding to the reviewed assertion. */
    const definition = section === "syntax" ? tokens[0] : tokens[key];

    /** Dev source path for independent file replacements. */
    const directory = join(root, "src/themes/dev/sample");

    await mkdir(join(directory, "tokens"), { recursive: true });
    await mkdir(join(directory, "details"));
    await writeFile(
      join(root, `src/themes/prod/default/details/${section}.jsonc`),
      JSON.stringify({ [key]: { globallyOverriddenBy: ["reviewed.replacement"] } }),
    );
    await writeFile(join(directory, `tokens/${section}.jsonc`), JSON.stringify(tokens));

    /** Valid disabled default definition makes the inherited assertion internally consistent. */
    const defaultTokens = structuredClone(tokens);

    Object.assign(section === "syntax" ? defaultTokens[0] : defaultTokens[key], {
      disabled: true,
      disabledReason: "Reviewed default replacement.",
    });
    await writeFile(join(root, `src/themes/prod/default/tokens/${section}.jsonc`), JSON.stringify(defaultTokens));
    await assert.rejects(buildDevThemes({ root }), /default fallback.*globallyOverriddenBy requires disabled/s);

    definition.disabled = true;
    definition.disabledReason = "Reviewed replacement everywhere.";
    await writeFile(join(directory, `tokens/${section}.jsonc`), JSON.stringify(tokens));
    await buildDevThemes({ root });

    /** Successful artifacts must survive a later invalid details/token combination. */
    const before = await readBuildOutputs(root);

    await writeFile(
      join(directory, `details/${section}.jsonc`),
      JSON.stringify({ [key]: { globallyOverriddenBy: ["different.replacement"] } }),
    );
    await rm(join(directory, `tokens/${section}.jsonc`));
    await writeFile(join(root, `src/themes/prod/default/details/${section}.jsonc`), "{}");
    await writeFile(
      join(root, `src/themes/prod/default/tokens/${section}.jsonc`),
      JSON.stringify(createTokens()[section]),
    );
    await assert.rejects(buildDevThemes({ root }), /globallyOverriddenBy requires disabled/);
    assert.deepEqual(await readBuildOutputs(root), before);

    await writeFile(join(directory, `details/${section}.jsonc`), "{}");
    await buildDevThemes({ root });
    await buildDevThemes({ root, check: true });
  });
}

test("empty details suppress fallback and supplied details must match whole-file token replacements", async (t) => {
  /** Temporary fixture with default details for a token absent from the dev replacement. */
  const root = await createBuildProject(t);

  /** Independently replaced UI token section. */
  const directory = join(root, "src/themes/dev/sample");

  await mkdir(join(directory, "tokens"), { recursive: true });
  await mkdir(join(directory, "details"));
  await writeFile(
    join(root, "src/themes/prod/default/details/ui.jsonc"),
    '{"editor.background":{"for":"Default background."}}',
  );
  await writeFile(join(directory, "tokens/ui.jsonc"), "{}");
  await assert.rejects(buildDevThemes({ root }), /unknown authored entry/);
  await writeFile(join(directory, "details/ui.jsonc"), "{}");
  await buildDevThemes({ root });

  /** Default details edits must not affect the dev documentation replacement. */
  const before = await readBuildOutputs(root);

  await writeFile(
    join(root, "src/themes/prod/default/details/ui.jsonc"),
    '{"editor.background":{"for":"Changed default documentation."}}',
  );
  await buildDevThemes({ root, check: true });
  assert.deepEqual(await readBuildOutputs(root), before);
});

test("ordinary source comments are omitted and documentation-only edits preserve generated files", async (t) => {
  /** Complete fixture whose original artifacts are checked after comment-only edits. */
  const root = await createBuildProject(t);

  await buildProdThemes({ root });

  for (const relative of ["palette/palette-config.jsonc", ...themePartNames.map((name) => `${name}.jsonc`)]) {
    /** Authored input receiving an ordinary comment that must never enter the output. */
    const path = join(root, "src/themes/prod/default", relative);
    await writeFile(path, `// ordinary source comment\n${await readFile(path, "utf8")}`);
  }

  assert.deepEqual((await buildProdThemes({ root, check: true })).changed, []);
});

test("prod palette reports include 600 contrast from final hex and flag translucent overrides", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);
  await buildProdThemes({ root, paletteOnly: true });

  /** Generated palette Markdown report path. */
  const path = join(root, "src/themes/prod/default/palette/generated/palette.md");

  /** Generated palette report text used to inspect its contrast section. */
  const markdown = await readFile(path, "utf8");

  /** Tone 600 contrast subsection isolated from the full Markdown report. */
  const section = markdown.split("## Tone 600 contrast")[1].split("## Full palette")[0];
  assert.match(section, /Foreground: `#f8f8f8`/);
  assert.match(section, /`palette.blue.600`\s*\|\s*`#1e70ce`\s*\|\s*4\.64:1/);
  assert.match(section, /`palette.yellow.600`\s*\|\s*`#bd9a2c`\s*\|\s*2\.53:1/);
  assert.doesNotMatch(section, /palette\.gray|palette\.blue\.500/);

  /** Authored fixture configuration mutated for the current validation scenario. */
  const input = createPaletteConfig();
  input.overrides["palette.blue.600"] = { hex: "#000000", colorReason: "Check exported override contrast" };
  await writeFile(join(root, "src/themes/prod/default/palette/palette-config.jsonc"), JSON.stringify(input));
  await buildProdThemes({ root, paletteOnly: true });
  assert.match(await readFile(path, "utf8"), /`palette.blue.600`\s*\|\s*`#000000`\s*\|\s*19\.77:1/);
  input.overrides["palette.blue.600"].hex = "#00000080";
  await writeFile(join(root, "src/themes/prod/default/palette/palette-config.jsonc"), JSON.stringify(input));
  await buildProdThemes({ root, paletteOnly: true });
  assert.match(await readFile(path, "utf8"), /`palette.blue.600`\s*\|\s*`#00000080`\s*\|\s*Needs backdrop/);
});

test("the authored palette keeps base syntax and colored control text readable", async () => {
  /** Palette configuration parsed from authored inputs or created for this scenario. */
  const config = parseJsonc(
    await readFile(new URL("../src/themes/prod/default/palette/palette-config.jsonc", import.meta.url), "utf8"),
    "palette",
  ).value;

  /** Effective consolidated source inputs used for readability assertions. */
  const parts = await readThemeParts(new URL("../src/themes/prod/default", import.meta.url));

  /** Generated palette measured against the final authored colors. */
  const palette = generatePalette(config);

  /** Compiled default theme used for readability checks. */
  const theme = parse(renderTheme(parts.metadata, compileTokens(parts.tokens, parts.details, palette)));

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

test("dev targets use independent complete palettes and token sections and isolate outputs", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  /** Development target source directory prepared by this test. */
  const devThemeDirectory = join(root, "src/themes/dev/sample");

  /** Default production source directory supplying inherited inputs. */
  const prodThemeDirectory = join(root, "src/themes/prod/default");

  /** Authored fixture configuration mutated for the current validation scenario. */
  const input = createPaletteConfig();

  /** Named color variable definitions adjusted for the development target. */
  const tokens = createTokens();

  input.families.yellow.hue = 95;
  tokens.syntax[0].color = "#abcdef";
  tokens.syntax[0].colorReason = "Test exception";
  await mkdir(join(devThemeDirectory, "palette"), { recursive: true });
  await mkdir(join(devThemeDirectory, "tokens"));
  await writeFile(join(devThemeDirectory, "palette/palette-config.jsonc"), JSON.stringify(input));
  await writeFile(join(devThemeDirectory, "tokens/base.jsonc"), JSON.stringify(tokens.base));
  await writeFile(
    join(devThemeDirectory, "tokens/ui.jsonc"),
    '{"editor.background":{"color":"#010203","colorReason":"Preview background."}}',
  );
  await writeFile(join(devThemeDirectory, "metadata.jsonc"), '{"name":"Sample","type":"dark","author":"Sample"}');
  await writeFile(
    join(devThemeDirectory, "tokens/syntax.jsonc"),
    JSON.stringify([{ ...tokens.syntax[0], scope: "test.syntax" }]),
  );

  /** Build summary inspected for target palettes and changed artifact paths. */
  const result = await buildDevThemes({ root });

  assert.equal(result[0].name, "sample");
  assert.equal(result[0].palette.get("palette.yellow.400").target.h, 95);
  assert.equal(result[0].changed.length, 4);

  /** Generated development theme source inspected for independent overrides. */
  const devTheme = await readFile(join(root, "dev-extension/themes/cassidy-dark-color-theme-sample.json"), "utf8");

  assert.match(devTheme, /#abcdef/);
  assert.equal(parse(devTheme).colors["editor.background"], "#010203");
  assert.equal(parse(devTheme).author, "Sample");
  assert.deepEqual(parse(devTheme).semanticTokenColors.variable, { foreground: "#abcdef" });
  assert.deepEqual(parse(devTheme).tokenColors[0].scope, "test.syntax");
  await assert.rejects(readFile(join(root, "themes/cassidy-dark-color-theme.json")), { code: "ENOENT" });
  assert.deepEqual((await readThemeParts(prodThemeDirectory)).tokens, createTokens());
  assert.deepEqual(
    (await buildDevThemes({ root, check: true })).map(({ changed }) => changed),
    [[]],
  );
});

for (const relative of [
  "palette/palette-config.jsonc",
  ...themePartNames.map((name) => `${name}.jsonc`),
]) {
  test(`missing default ${relative} fails even when a dev theme supplies that file`, async (t) => {
    /** Temporary source project root for this test scenario. */
    const root = await createBuildProject(t);

    await mkdir(join(root, "src/themes/dev/inherited", relative, ".."), { recursive: true });
    await writeFile(
      join(root, "src/themes/dev/inherited", relative),
      await readFile(join(root, "src/themes/prod/default", relative)),
    );
    await rm(join(root, "src/themes/prod/default", relative));
    await assert.rejects(buildDevThemes({ root }), /missing required theme input/);
    assert.deepEqual(await readdir(root), ["package.json", "src"]);
  });
}

test("fully inherited dev targets produce their own reports and follow changed default palettes", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  /** Development target source directory prepared by this test. */
  const devThemeDirectory = join(root, "src/themes/dev/inherited");

  await mkdir(devThemeDirectory, { recursive: true });
  await buildProdThemes({ root });

  /** Production artifact snapshot retained before a development build. */
  const prodOutputs = await readBuildOutputs(root);

  /** Build summary inspected for target palettes and changed artifact paths. */
  const result = await buildDevThemes({ root });

  /** Generated palette JSON report path used by the assertion. */
  const reportPath = join(root, "src/themes/dev/inherited/palette/generated/palette.json");

  /** Parsed palette measurements and source provenance. */
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert.equal(result.length, 1);
  assert.equal(report.generated.target, "dev/inherited");
  assert.equal(report.generated.source, "src/themes/prod/default/palette/palette-config.jsonc");
  assert.equal(report.generated.fallback, true);
  assert.equal(
    parse(await readFile(join(root, "dev-extension/themes/cassidy-dark-color-theme-inherited.json"), "utf8")).name,
    "Fixture",
  );

  for (const [path, text] of prodOutputs) assert.equal(await readFile(join(root, path), "utf8"), text);

  /** Authored fixture configuration mutated for the current validation scenario. */
  const input = createPaletteConfig();

  input.families.yellow.hue = 95;
  await writeFile(join(root, "src/themes/prod/default/palette/palette-config.jsonc"), JSON.stringify(input));
  await assert.rejects(buildDevThemes({ root, check: true }), /missing or stale/);
  assert.equal(await readFile(reportPath, "utf8"), JSON.stringify(report, null, 2) + "\n");
  await buildDevThemes({ root });
  assert.equal(JSON.parse(await readFile(reportPath, "utf8")).primitives["palette.yellow.400"].target.h, 95);
  await assert.rejects(buildProdThemes({ root, check: true }), /missing or stale/);
});

for (const [path, contents, pattern] of [
  ["palette/palette-config.jsonc", '{"families":{"yellow":{"hue":95}}}', /palette.chroma/],
  [
    "tokens/base.jsonc",
    "{}",
    /Unknown reference:.*base.surface.editor/,
  ],
  ["metadata.jsonc", "{}", /theme name must be/],
  ["tokens/ui.jsonc", '{"bad":{}}', /requires styling/],
  ["tokens/semantic.jsonc", '{"variable":{"italic":"yes"}}', /italic must be a boolean/],
  ["tokens/syntax.jsonc", "{}", /token color array/],
  ["palette/palette-config.jsonc", "", /ValueExpected/],
  ["palette/palette-config.jsonc", '{"chroma":', /ValueExpected/],
  [
    "tokens/base.jsonc",
    '{"surface":{"one":{"color":"base.surface.two"},"two":{"color":"base.surface.one"}}}',
    /Token cycle/,
  ],
]) {
  test(`supplied ${path} validates in full without merging or falling back: ${contents}`, async (t) => {
    /** Temporary source project root for this test scenario. */
    const root = await createBuildProject(t);

    /** Development target source directory prepared by this test. */
    const devThemeDirectory = join(root, "src/themes/dev/sample");

    await mkdir(join(devThemeDirectory, path, ".."), { recursive: true });
    await writeFile(join(devThemeDirectory, path), contents);
    await assert.rejects(buildDevThemes({ root }), pattern);
    await assert.rejects(readFile(join(root, "dev-extension/themes/cassidy-dark-color-theme-sample.json")), {
      code: "ENOENT",
    });
  });
}

test("a supplied dev UI mapping replaces the whole file while omitted files inherit", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  await mkdir(join(root, "src/themes/dev/sample/tokens"), { recursive: true });
  await writeFile(
    join(root, "src/themes/dev/sample/tokens/ui.jsonc"),
    '{"editor.background":{"color":"#010203","colorReason":"Preview background."}}',
  );
  await buildDevThemes({ root });

  /** Parsed generated theme inspected by this test. */
  const theme = parse(await readFile(join(root, "dev-extension/themes/cassidy-dark-color-theme-sample.json"), "utf8"));

  assert.deepEqual(theme.colors, { "editor.background": "#010203" });
  assert.equal(theme.type, "dark");
  assert.equal(theme.tokenColors[0].settings.foreground, "#f1dda5");
});

for (const group of ["prod", "dev"]) {
  test(`an invalid later ${group} target leaves every previous output and manifest intact`, async (t) => {
    /** Temporary source project root for this test scenario. */
    const root = await createBuildProject(t);

    /** Build function selected for the current prod or dev validation scenario. */
    const build = group === "prod" ? buildProdThemes : buildDevThemes;

    /** Destination manifest or source target path used by this scenario. */
    const target = join(root, `src/themes/${group}/z-invalid`);
    await mkdir(join(target, "tokens"), { recursive: true });
    await build({ root });

    /** Output snapshot or file metadata retained before the operation under test. */
    const before = await readBuildOutputs(root);

    /** Palette configuration parsed from authored inputs or created for this scenario. */
    const config = createPaletteConfig();
    config.families.yellow.hue = 95;
    await writeFile(join(root, "src/themes/prod/default/palette/palette-config.jsonc"), JSON.stringify(config));
    await writeFile(join(target, "tokens/base.jsonc"), '{"surface":{"unused":{"color":"unknown.color"}}}');
    await assert.rejects(build({ root }), /Unknown reference/);
    assert.deepEqual(await readBuildOutputs(root), before);
  });
}

test("prod targets register matching theme types and preserve unrelated manifest fields", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  /** Production manifest path used to inspect generated registrations. */
  const manifestPath = join(root, "package.json");

  /** Manifest fixture parsed before mutation or synchronization. */
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  manifest.contributes.commands = [{ command: "fixture.command", title: "Keep" }];
  await writeFile(manifestPath, JSON.stringify(manifest));
  await mkdir(join(root, "src/themes/prod/high-contrast"));
  await writeFile(join(root, "src/themes/prod/high-contrast/metadata.jsonc"), '{"name":"Fixture","type":"hc"}');
  await buildProdThemes({ root });

  /** Manifest reloaded after production theme registration updates. */
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

  /** Output snapshot or file metadata retained before the operation under test. */
  const before = await readBuildOutputs(root);

  await assert.rejects(buildProdThemes({ root, check: true }), /package.json/);
  assert.deepEqual(await readBuildOutputs(root), before);
});

for (const name of ["default", "bad..name", "Uppercase", ".hidden"]) {
  test(`target discovery rejects duplicate or unsafe dev name ${name} before writing`, async (t) => {
    /** Temporary source project root for this test scenario. */
    const root = await createBuildProject(t);
    await mkdir(join(root, "src/themes/dev", name), { recursive: true });
    await assert.rejects(buildProdThemes({ root }), /Duplicate theme name|Invalid theme name/);
    assert.deepEqual(await readdir(root), ["package.json", "src"]);
  });
}

test("stale report and theme detection is read-only and archives are never regenerated", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);
  await mkdir(join(root, "docs/references/palettes"), { recursive: true });
  await writeFile(join(root, "docs/references/palettes/old.md"), "Historical palette\n");
  await buildProdThemes({ root });

  /** Output snapshot or file metadata retained before the operation under test. */
  const before = await readBuildOutputs(root);
  assert.deepEqual(await readBuildOutputs(root), before);
  await writeFile(join(root, "themes/cassidy-dark-color-theme-removed.json"), "stale");
  await assert.rejects(buildProdThemes({ root }), /Stale generated outputs.*theme-removed.json/);
  assert.equal(await readFile(join(root, "docs/references/palettes/old.md"), "utf8"), "Historical palette\n");
});

test("palette-only builds all prod reports without metadata, tokens, details, or a manifest", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);
  await mkdir(join(root, "src/themes/prod/inherited"));
  await rm(join(root, "package.json"));
  await rm(join(root, "src/themes/prod/default/metadata.jsonc"));
  await rm(join(root, "src/themes/prod/default/tokens"), { recursive: true });
  await rm(join(root, "src/themes/prod/default/details"), { recursive: true });

  /** Build summary inspected for target palettes and changed artifact paths. */
  const result = await buildProdThemes({ root, paletteOnly: true });
  assert.equal(result.targets.length, 2);
  assert.equal(result.changed.length, 6);
  assert.equal((await buildProdThemes({ root, paletteOnly: true, check: true })).changed.length, 0);
  await assert.rejects(readFile(join(root, "themes/cassidy-dark-color-theme.json")), { code: "ENOENT" });
});

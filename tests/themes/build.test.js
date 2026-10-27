/**
 * Theme build tests.
 * @file Verify template resolution, deterministic generation, inheritance, reports, and failed-build protections.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { parse } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { buildDevThemeSummary, buildDevThemes, buildProdThemes } from "../../tooling/themes/build.js";
import { contrastRatio } from "../../tooling/shared/color-math.js";
import { parseJsonc } from "../../tooling/shared/jsonc.js";
import { generatePalette } from "../../tooling/palette/generation.js";
import { compileTokens, renderTheme } from "../../tooling/tokens/compilation.js";
import {
  createBuildProject,
  createPaletteConfig,
  createTokens,
  readBuildOutputs,
  readThemeParts,
  themePartNames,
  writeDefaultPaletteConfig,
} from "../helpers/projects.js";

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
    compileTokens(createTokens(), { variables: {}, ui: {}, semantic: {}, syntax: {} }, palette),
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
        compileTokens(createTokens(), { variables: {}, ui: {}, semantic: {}, syntax: {} }, palette),
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

test("preview names survive generation and whole-file metadata fallback without changing prod labels", async (t) => {
  /** Temporary project used to build default, named production, and development themes. */
  const root = await createBuildProject(t);

  await writeFile(
    join(root, "src/themes/prod/default/metadata.jsonc"),
    '{"name":"Fixture","type":"dark","previewName":"Default Preview"}',
  );
  await writeDefaultPaletteConfig(join(root, "src/themes/prod/named"));
  await writeDefaultPaletteConfig(join(root, "src/themes/dev/sample"));
  await buildProdThemes({ root });
  await buildDevThemes({ root });

  for (const path of [
    "themes/cassidy-dark-color-theme.json",
    "themes/cassidy-dark-color-theme-named.json",
    "dev-extension/themes/cassidy-dark-color-theme-sample.json",
  ]) {
    assert.equal(parse(await readFile(join(root, path), "utf8")).previewName, "Default Preview");
  }

  /** Production registrations retain target-derived labels despite preview overrides. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  assert.deepEqual(
    manifest.contributes.themes.map(({ label }) => label),
    ["Fixture", "Fixture (Named)"],
  );
  await writeFile(join(root, "src/themes/dev/sample/metadata.jsonc"), '{"name":"Custom","type":"light"}');
  await buildDevThemes({ root });
  assert.equal(
    parse(await readFile(join(root, "dev-extension/themes/cassidy-dark-color-theme-sample.json"), "utf8")).previewName,
    undefined,
  );

  for (const previewName of [null, false, 42, {}, [], "", " \t\n "]) {
    await writeFile(
      join(root, "src/themes/dev/sample/metadata.jsonc"),
      JSON.stringify({
        name: "Custom",
        type: "light",
        previewName,
      }),
    );
    await assert.rejects(buildDevThemes({ root }), /metadata.jsonc.*previewName must be a nonempty string/);
  }
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
    join(root, "src/themes/prod/default/tokens/variables.jsonc"),
    '{"surface":{"editor":{"color":"missing.color"}}}',
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
    join(root, "src/themes/prod/default/details/variables.jsonc"),
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

    /** Complete default documentation retained when testing a relationship change. */
    const defaultDetails = (await readThemeParts(join(root, "src/themes/prod/default"))).details[section];

    /** Definition corresponding to the reviewed assertion. */
    const definition = section === "syntax" ? tokens[0] : tokens[key];

    /** Dev source path for independent file replacements. */
    const directory = join(root, "src/themes/dev/sample");

    await writeDefaultPaletteConfig(directory);
    await mkdir(join(directory, "tokens"), { recursive: true });
    await mkdir(join(directory, "details"));
    await writeFile(
      join(root, `src/themes/prod/default/details/${section}.jsonc`),
      JSON.stringify({
        ...defaultDetails,
        [key]: { ...defaultDetails[key], globallyOverriddenBy: ["reviewed.replacement"] },
      }),
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
    await writeFile(join(root, `src/themes/prod/default/details/${section}.jsonc`), JSON.stringify(defaultDetails));
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

  await writeDefaultPaletteConfig(directory);
  await mkdir(join(directory, "tokens"), { recursive: true });
  await mkdir(join(directory, "details"));
  await writeFile(
    join(root, "src/themes/prod/default/details/ui.jsonc"),
    '{"editor.background":{"for":"Default background."},"editor.foreground":{"for":"Default foreground."}}',
  );
  await writeFile(join(directory, "tokens/ui.jsonc"), "{}");
  await assert.rejects(buildDevThemes({ root }), /unknown authored entry/);
  await writeFile(join(directory, "details/ui.jsonc"), "{}");
  await buildDevThemes({ root });

  /** Default details edits must not affect the dev documentation replacement. */
  const before = await readBuildOutputs(root);

  await writeFile(
    join(root, "src/themes/prod/default/details/ui.jsonc"),
    '{"editor.background":{"for":"Changed default documentation."},"editor.foreground":{"for":"Default foreground."}}',
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
    await readFile(new URL("../../src/themes/prod/default/palette/palette-config.jsonc", import.meta.url), "utf8"),
    "palette",
  ).value;

  /** Effective consolidated source inputs used for readability assertions. */
  const parts = await readThemeParts(new URL("../../src/themes/prod/default", import.meta.url));

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
  await mkdir(join(devThemeDirectory, "details"));
  await writeFile(join(devThemeDirectory, "details/ui.jsonc"), "{}");
  await writeFile(join(devThemeDirectory, "palette/palette-config.jsonc"), JSON.stringify(input));
  await writeFile(join(devThemeDirectory, "tokens/variables.jsonc"), JSON.stringify(tokens.variables));
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

test("explicit default palettes produce only a note and follow changes without rewriting prod output", async (t) => {
  /** Temporary project whose dev target explicitly uses the default palette. */
  const root = await createBuildProject(t);

  /** Dev source directory and generated palette-note location. */
  const directory = join(root, "src/themes/dev/inherited");

  await writeDefaultPaletteConfig(directory);
  await buildProdThemes({ root });

  /** Production artifacts retained before the independent dev build. */
  const prodOutputs = await readBuildOutputs(root);

  /** Dev palette and artifact changes returned by the build. */
  const result = await buildDevThemes({ root });

  /** Note explaining why per-theme palette measurements and swatches are omitted. */
  const notePath = join(directory, "palette/default-palette.txt");

  /** Original note must remain unchanged when default palette values change. */
  const note = await readFile(notePath, "utf8");

  assert.equal(result.length, 1);
  assert.equal(result[0].changed.length, 2);
  assert.match(note, /No palette is generated.*default palette is being used/);
  assert.match(note, /src\/themes\/prod\/default\/palette\/palette-config.jsonc/);
  await assert.rejects(readdir(join(directory, "palette/generated")), { code: "ENOENT" });

  for (const [path, text] of prodOutputs) assert.equal(await readFile(join(root, path), "utf8"), text);

  /** New default color propagates through the inherited token definitions. */
  const input = createPaletteConfig();

  input.families.yellow.hue = 95;
  await writeFile(join(root, "src/themes/prod/default/palette/palette-config.jsonc"), JSON.stringify(input));
  await assert.rejects(buildDevThemes({ root, check: true }), /missing or stale/);
  assert.equal(await readFile(notePath, "utf8"), note);

  /** Dev build uses the updated palette while leaving production artifacts intact. */
  const changed = await buildDevThemes({ root });

  assert.equal(changed[0].palette.get("palette.yellow.400").target.h, 95);
  assert.deepEqual(changed[0].changed, ["dev-extension/themes/cassidy-dark-color-theme-inherited.json"]);
  assert.equal(await readFile(notePath, "utf8"), note);
  await buildDevThemes({ root, check: true });
  await assert.rejects(buildProdThemes({ root, check: true }), /missing or stale/);
});

for (const group of ["prod", "dev"]) {
  test(`${group} themes require their own palette config even when the default palette exists`, async (t) => {
    /** Project with an explicit default-palette selection and existing generated artifacts. */
    const root = await createBuildProject(t);

    /** Theme and build operation selected for this source group. */
    const directory = join(root, `src/themes/${group}/sample`);

    /** Public build entry point for the selected group. */
    const build = group === "prod" ? buildProdThemes : buildDevThemes;

    await writeDefaultPaletteConfig(directory);
    await build({ root });

    /** Existing artifacts must survive a missing required configuration. */
    const before = await readBuildOutputs(root);

    await rm(join(directory, "palette/palette-config.jsonc"));
    await assert.rejects(build({ root }), /sample\/palette\/palette-config.jsonc: missing required theme input/);
    assert.deepEqual(await readBuildOutputs(root), before);
  });
}

for (const [group, paletteOnly, useDefaultPalette] of [
  ["prod", false, false],
  ["dev", false, undefined],
  ["prod", true, false],
  ["prod", true, undefined],
]) {
  test(`${group} palette modes replace directories and notes with paletteOnly=${paletteOnly}, useDefaultPalette=${useDefaultPalette}`, async (t) => {
    /** Project and theme that initially select the default palette explicitly. */
    const root = await createBuildProject(t);

    /** Named theme source directory used for both palette modes. */
    const directory = join(root, `src/themes/${group}/sample`);

    /** Generated directory whose contents must match the current mode exactly. */
    const generated = join(directory, "palette/generated");

    /** Public build operation with the requested palette-only mode. */
    const build = group === "prod" ? buildProdThemes : buildDevThemes;

    await writeDefaultPaletteConfig(directory);
    await build({ root, paletteOnly });
    await assert.rejects(readdir(generated), { code: "ENOENT" });

    // Also exercise upgrading the previous layout while switching to a custom palette.
    await mkdir(generated);
    await writeFile(join(generated, "default.txt"), "Legacy default-palette note\n");

    /** Read-only checks must leave both notes in place until the build succeeds. */
    const beforeCustom = await readBuildOutputs(root);

    /** Full settings exercise both an explicit false flag and an omitted flag. */
    const config = createPaletteConfig();

    if (useDefaultPalette !== undefined) config.useDefaultPalette = useDefaultPalette;

    await writeFile(join(directory, "palette/palette-config.jsonc"), JSON.stringify(config));
    await assert.rejects(build({ root, paletteOnly, check: true }), /missing or stale/);
    assert.deepEqual(await readBuildOutputs(root), beforeCustom);
    await build({ root, paletteOnly });
    assert.deepEqual(await readdir(generated), ["palette.json", "palette.md", "palette.svg"]);
    await assert.rejects(readFile(join(directory, "palette/default-palette.txt")), { code: "ENOENT" });
    await build({ root, paletteOnly, check: true });

    /** Custom reports must survive validation failure in a later target before any cleanup runs. */
    const beforeDefault = await readBuildOutputs(root);

    /** Later target used to fail validation after the valid palette-mode switch is prepared. */
    const invalid = join(root, `src/themes/${group}/z-invalid`);

    await writeDefaultPaletteConfig(directory);
    await writeDefaultPaletteConfig(invalid);
    await writeFile(join(invalid, "palette/palette-config.jsonc"), '{"useDefaultPalette":"yes"}');
    await assert.rejects(build({ root, paletteOnly }), /useDefaultPalette must be a boolean/);
    assert.deepEqual(await readBuildOutputs(root), beforeDefault);
    await rm(invalid, { recursive: true });
    await assert.rejects(build({ root, paletteOnly, check: true }), /missing or stale/);
    assert.deepEqual(await readBuildOutputs(root), beforeDefault);
    await build({ root, paletteOnly });
    await assert.rejects(readdir(generated), { code: "ENOENT" });
    await build({ root, paletteOnly, check: true });

    await writeFile(join(directory, "palette/default-palette.txt"), "Outdated note\n");
    await assert.rejects(build({ root, paletteOnly, check: true }), /default-palette\.txt/);
    assert.equal(await readFile(join(directory, "palette/default-palette.txt"), "utf8"), "Outdated note\n");
    await build({ root, paletteOnly });
    assert.match(
      await readFile(join(directory, "palette/default-palette.txt"), "utf8"),
      /default palette is being used/,
    );
  });
}

for (const contents of ["empty", "nested legacy artifacts"]) {
  test(`default palettes remove a generated directory containing ${contents}`, async (t) => {
    /** Fixture with the current default-palette note already generated. */
    const root = await createBuildProject(t);

    /** Dev source directory selecting the default palette. */
    const directory = join(root, "src/themes/dev/sample");

    /** Obsolete directory must be removed in full, even when it is empty. */
    const generated = join(directory, "palette/generated");

    await writeDefaultPaletteConfig(directory);
    await buildDevThemes({ root });
    await mkdir(generated);

    if (contents !== "empty") {
      await mkdir(join(generated, "nested"));
      await writeFile(join(generated, "nested/old.txt"), "Old generated artifact\n");
      await writeFile(join(generated, "default.txt"), "Old default-palette note\n");
    }

    /** Read-only checks must retain the directory and every obsolete file. */
    const before = await readBuildOutputs(root);

    await assert.rejects(buildDevThemes({ root, check: true }), /sample\/palette\/generated/);
    assert.deepEqual(await readBuildOutputs(root), before);
    assert.ok(Array.isArray(await readdir(generated)));
    await buildDevThemes({ root });
    await assert.rejects(readdir(generated), { code: "ENOENT" });
    assert.match(
      await readFile(join(directory, "palette/default-palette.txt"), "utf8"),
      /default palette is being used/,
    );
    await buildDevThemes({ root, check: true });
  });
}

for (const [config, pattern] of [
  [null, /expected an object/],
  [[], /expected an object/],
  [{}, /palette.chroma/],
  [{ useDefaultPalette: "true" }, /useDefaultPalette must be a boolean/],
  [{ useDefaultPalette: 1 }, /useDefaultPalette must be a boolean/],
  [{ useDefaultPalette: null }, /useDefaultPalette must be a boolean/],
  [{ useDefaultPalette: false }, /palette.chroma/],
  [{ useDefaultPalette: true, typo: true }, /unknown field typo/],
]) {
  test(`palette selection rejects invalid configuration ${JSON.stringify(config)}`, async (t) => {
    /** Valid default project with a malformed target-local palette selection. */
    const root = await createBuildProject(t);

    /** Target directory whose local configuration must never silently fall back. */
    const directory = join(root, "src/themes/dev/sample");

    await writeDefaultPaletteConfig(directory);
    await writeFile(join(directory, "palette/palette-config.jsonc"), JSON.stringify(config));
    await assert.rejects(buildDevThemes({ root }), pattern);
    await assert.rejects(readFile(join(directory, "palette/default-palette.txt")), { code: "ENOENT" });
  });
}

test("default palette selection retains dormant settings until custom generation is enabled", async (t) => {
  /** Valid default project with a target storing settings for a later custom palette. */
  const root = await createBuildProject(t);

  /** Target-local palette configuration that can switch between both modes. */
  const path = join(root, "src/themes/dev/sample/palette/palette-config.jsonc");

  /** Complete saved settings intentionally differ from the current default palette. */
  const config = { useDefaultPalette: true, ...createPaletteConfig() };

  config.families.yellow.hue = 95;
  await writeDefaultPaletteConfig(join(root, "src/themes/dev/sample"));
  await writeFile(path, JSON.stringify(config));

  /** Default selection must resolve to the default palette rather than the saved settings. */
  const selected = await buildDevThemes({ root });

  assert.equal(selected[0].palette.get("palette.yellow.400").target.h, 90);
  await assert.rejects(stat(join(root, "src/themes/dev/sample/palette/generated")), { code: "ENOENT" });

  config.useDefaultPalette = false;
  await writeFile(path, JSON.stringify(config));

  /** Clearing the flag activates and validates the retained custom settings. */
  const custom = await buildDevThemes({ root });

  assert.equal(custom[0].palette.get("palette.yellow.400").target.h, 95);
  await stat(join(root, "src/themes/dev/sample/palette/generated/palette.json"));

  config.useDefaultPalette = true;
  config.families = null;
  await writeFile(path, JSON.stringify(config));
  await buildDevThemes({ root });
  config.useDefaultPalette = false;
  await writeFile(path, JSON.stringify(config));
  await assert.rejects(buildDevThemes({ root }), /families: expected an object/);
});

test("the default theme cannot select its own palette as a fallback", async (t) => {
  /** Existing default outputs must survive an invalid self-reference. */
  const root = await createBuildProject(t);

  await buildProdThemes({ root });

  /** Snapshot captured before replacing the required concrete default palette. */
  const before = await readBuildOutputs(root);

  await writeDefaultPaletteConfig(join(root, "src/themes/prod/default"));
  await assert.rejects(buildProdThemes({ root }), /default theme must define its own palette/);
  await assert.rejects(buildProdThemes({ root, paletteOnly: true }), /default theme must define its own palette/);
  assert.deepEqual(await readBuildOutputs(root), before);
});

for (const [path, contents, pattern] of [
  ["palette/palette-config.jsonc", '{"families":{"yellow":{"hue":95}}}', /palette.chroma/],
  [
    "tokens/variables.jsonc",
    "{}",
    /Unknown reference:.*variables.surface.editor/,
  ],
  ["metadata.jsonc", "{}", /theme name must be/],
  ["tokens/ui.jsonc", '{"bad":{}}', /requires styling/],
  ["tokens/semantic.jsonc", '{"variable":{"italic":"yes"}}', /italic must be a boolean/],
  ["tokens/syntax.jsonc", "{}", /token color array/],
  ["palette/palette-config.jsonc", "", /ValueExpected/],
  ["palette/palette-config.jsonc", '{"chroma":', /ValueExpected/],
  [
    "tokens/variables.jsonc",
    '{"surface":{"one":{"color":"variables.surface.two"},"two":{"color":"variables.surface.one"}}}',
    /Token cycle/,
  ],
]) {
  test(`supplied ${path} validates in full without merging or falling back: ${contents}`, async (t) => {
    /** Temporary source project root for this test scenario. */
    const root = await createBuildProject(t);

    /** Development target source directory prepared by this test. */
    const devThemeDirectory = join(root, "src/themes/dev/sample");

    await writeDefaultPaletteConfig(devThemeDirectory);
    await mkdir(join(devThemeDirectory, path, ".."), { recursive: true });
    await writeFile(join(devThemeDirectory, path), contents);

    if (path === "tokens/variables.jsonc") {
      await mkdir(join(devThemeDirectory, "details"), { recursive: true });
      await writeFile(join(devThemeDirectory, "details/variables.jsonc"), "{}");
    }

    await assert.rejects(buildDevThemes({ root }), pattern);
    await assert.rejects(readFile(join(root, "dev-extension/themes/cassidy-dark-color-theme-sample.json")), {
      code: "ENOENT",
    });
  });
}

test("a supplied dev UI mapping replaces the whole file while omitted files inherit", async (t) => {
  /** Temporary source project root for this test scenario. */
  const root = await createBuildProject(t);

  await writeDefaultPaletteConfig(join(root, "src/themes/dev/sample"));
  await mkdir(join(root, "src/themes/dev/sample/tokens"), { recursive: true });
  await mkdir(join(root, "src/themes/dev/sample/details"), { recursive: true });
  await writeFile(join(root, "src/themes/dev/sample/details/ui.jsonc"), "{}");
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

    await writeDefaultPaletteConfig(target);
    await mkdir(join(target, "tokens"), { recursive: true });
    await mkdir(join(target, "details"), { recursive: true });
    await writeFile(join(target, "details/variables.jsonc"), "{}");
    await build({ root });

    /** Output snapshot or file metadata retained before the operation under test. */
    const before = await readBuildOutputs(root);

    /** Palette configuration parsed from authored inputs or created for this scenario. */
    const config = createPaletteConfig();
    config.families.yellow.hue = 95;
    await writeFile(join(root, "src/themes/prod/default/palette/palette-config.jsonc"), JSON.stringify(config));
    await writeFile(join(target, "tokens/variables.jsonc"), '{"surface":{"unused":{"color":"unknown.color"}}}');
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
  await writeDefaultPaletteConfig(join(root, "src/themes/prod/high-contrast"));
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
  await writeDefaultPaletteConfig(join(root, "src/themes/prod/inherited"));
  await rm(join(root, "package.json"));
  await rm(join(root, "src/themes/prod/default/metadata.jsonc"));
  await rm(join(root, "src/themes/prod/default/tokens"), { recursive: true });
  await rm(join(root, "src/themes/prod/default/details"), { recursive: true });

  /** Build summary inspected for target palettes and changed artifact paths. */
  const result = await buildProdThemes({ root, paletteOnly: true });
  assert.equal(result.targets.length, 2);
  assert.equal(result.changed.length, 4);
  assert.equal((await buildProdThemes({ root, paletteOnly: true, check: true })).changed.length, 0);
  await assert.rejects(readFile(join(root, "themes/cassidy-dark-color-theme.json")), { code: "ENOENT" });
});

for (const group of ["prod", "dev"]) {
  for (const action of ["remove", "rename"]) {
    test(`${group} builds clean up generated themes after source ${action} and keep checks read-only`, async (t) => {
      /** Isolated source project containing a named theme that becomes obsolete. */
      const root = await createBuildProject(t);

      /** Group-level builder exposes orphan removals even without remaining dev targets. */
      const build = group === "prod" ? buildProdThemes : buildDevThemeSummary;

      /** Original source theme directory deleted or renamed during this scenario. */
      const source = join(root, `src/themes/${group}/sample`);

      /** Old generated theme path whose header establishes ownership. */
      const path = `${group === "prod" ? "themes" : "dev-extension/themes"}/cassidy-dark-color-theme-sample.json`;

      await writeDefaultPaletteConfig(source);
      await build({ root });

      if (action === "remove") {
        await rm(source, { recursive: true });
      } else {
        await rename(source, join(root, `src/themes/${group}/renamed`));
      }

      /** Files retained intact while check mode describes pending removals. */
      const before = await readBuildOutputs(root);

      await assert.rejects(build({ root, check: true }), (error) => {
        assert.ok(error.message.includes(`Pending removals: ${path}`));

        return true;
      });
      assert.deepEqual(await readBuildOutputs(root), before);

      /** Completed group summary containing both rewritten and removed paths. */
      const result = await build({ root });

      assert.deepEqual(result.removed, [path]);
      assert.ok(result.changed.includes(path));
      assert.equal(result.targets.length, (group === "prod" ? 1 : 0) + (action === "rename" ? 1 : 0));
      await assert.rejects(readFile(join(root, path)), { code: "ENOENT" });
      assert.deepEqual((await build({ root, check: true })).removed, []);

      if (group === "prod") {
        /** Updated production registrations must no longer reference the old output. */
        const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

        assert.ok(!manifest.contributes.themes.some((theme) => theme.path.endsWith("-sample.json")));
      }
    });
  }

  test(`${group} cleanup accepts generated headers with BOM or CRLF and ignores edited bodies`, async (t) => {
    /** Isolated source project used to verify the ownership marker's supported encodings. */
    const root = await createBuildProject(t);

    /** Group-level builder selected for this ownership test. */
    const build = group === "prod" ? buildProdThemes : buildDevThemeSummary;

    /** Immediate output folder scanned only for the selected group. */
    const directory = group === "prod" ? "themes" : "dev-extension/themes";

    /** Exact first-line notice produced by the real theme renderer. */
    const header = `// Generated by npm run build:${group}. Edit the corresponding inputs and rebuild.`;

    /** Stale output paths tested with regular, CRLF, and BOM-prefixed notices. */
    const paths = ["a-lf.json", "b-crlf.json", "c-bom.json", "d-bom-crlf.json"].map((name) => `${directory}/${name}`);

    await build({ root });
    await mkdir(join(root, directory), { recursive: true });

    for (const [index, path] of paths.entries()) {
      await writeFile(
        join(root, path),
        `${index >= 2 ? "\uFEFF" : ""}${header}${index % 2 ? "\r\n" : "\n"}Body deliberately edited and no longer valid JSON.`,
      );
    }

    assert.deepEqual((await build({ root })).removed, paths);

    for (const path of paths) await assert.rejects(readFile(join(root, path)), { code: "ENOENT" });
  });

  test(`${group} cleanup protects unmatched headers and blocks all group writes`, async (t) => {
    /** Isolated project containing both removable and protected stale files. */
    const root = await createBuildProject(t);

    /** Group-level operation used to exercise complete stale-file classification. */
    const build = group === "prod" ? buildProdThemes : buildDevThemeSummary;

    /** Output folder containing immediate stale files. */
    const directory = group === "prod" ? "themes" : "dev-extension/themes";

    /** Ownership marker expected for the current output folder. */
    const header = `// Generated by npm run build:${group}. Edit the corresponding inputs and rebuild.`;

    /** Header-verified stale file that must survive whenever a protected file blocks cleanup. */
    const removable = `${directory}/a-generated.json`;

    /** Unrecognized stale file whose contents must never be removed automatically. */
    const protectedPath = `${directory}/z-protected.json`;

    await build({ root });
    await mkdir(join(root, directory), { recursive: true });
    await writeFile(join(root, removable), `${header}\n{}`);

    for (const text of [
      "{}",
      `// Generated by npm run build:${group === "prod" ? "dev" : "prod"}. Edit the corresponding inputs and rebuild.\n{}`,
      `\n${header}\n{}`,
      `${header} Extra text\n{}`,
    ]) {
      await writeFile(join(root, protectedPath), text);

      /** Full output snapshot retained before each rejected cleanup attempt. */
      const before = await readBuildOutputs(root);

      await assert.rejects(build({ root }), /Stale generated outputs.*z-protected.json/);
      assert.deepEqual(await readBuildOutputs(root), before);
    }

    await rm(join(root, protectedPath));
    assert.deepEqual((await build({ root })).removed, [removable]);
  });
}

test("failed validation or formatting preserves header-verified stale files and existing outputs", async (t) => {
  /** Source project containing a removable stale production output. */
  const root = await createBuildProject(t);

  /** Stale path remains intact until every new output has passed staging. */
  const path = "themes/obsolete.json";

  await buildProdThemes({ root });
  await writeFile(
    join(root, path),
    "// Generated by npm run build:prod. Edit the corresponding inputs and rebuild.\n{}",
  );

  /** Existing outputs used to verify no cleanup occurs during either failure. */
  const before = await readBuildOutputs(root);

  await writeDefaultPaletteConfig(join(root, "src/themes/prod/invalid"));
  await writeFile(join(root, "src/themes/prod/invalid/metadata.jsonc"), "{");
  await assert.rejects(buildProdThemes({ root }), /metadata/);
  assert.deepEqual(await readBuildOutputs(root), before);
  await rm(join(root, "src/themes/prod/invalid"), { recursive: true });
  await writeFile(join(root, ".prettierrc.json"), '{"parser":"missing-cleanup-parser"}');
  prettier.clearConfigCache();
  await assert.rejects(buildProdThemes({ root }), /missing-cleanup-parser/);
  assert.deepEqual(await readBuildOutputs(root), before);
});

test("cleanup stays inside the selected group's immediate theme files and leaves palettes and snapshots protected", async (t) => {
  /** Isolated source project with stale files across several distinct output areas. */
  const root = await createBuildProject(t);

  /** Stale dev theme must survive production and palette-only builds. */
  const devPath = join(root, "dev-extension/themes/obsolete.json");

  /** Stale production file must survive palette-only builds. */
  const prodPath = join(root, "themes/obsolete.json");

  /** Generated-looking snapshot remains outside automatic cleanup. */
  const snapshot = join(root, "dev-extension/static-snapshots/baseline.json");

  /** Symlinked output must not be deleted or followed for ownership detection. */
  const link = join(root, "themes/linked.json");

  /** Directory with a JSON suffix must not be removed recursively. */
  const folder = join(root, "themes/folder.json");

  /** Nested generated-looking file remains outside the immediate-file scan. */
  const nested = join(root, "themes/nested/obsolete.json");

  await buildProdThemes({ root });

  for (const directory of ["dev-extension/themes", "dev-extension/static-snapshots", "themes/nested"]) {
    await mkdir(join(root, directory), { recursive: true });
  }

  await writeFile(devPath, "// Generated by npm run build:dev. Edit the corresponding inputs and rebuild.\n{}");

  for (const path of [prodPath, snapshot, nested]) {
    await writeFile(path, "// Generated by npm run build:prod. Edit the corresponding inputs and rebuild.\n{}");
  }

  await symlink(snapshot, link);
  await mkdir(folder);
  await buildProdThemes({ root, paletteOnly: true });
  assert.ok(await readFile(prodPath, "utf8"));
  await buildProdThemes({ root });
  assert.ok(await readFile(devPath, "utf8"));
  await buildDevThemeSummary({ root });
  assert.ok(await readFile(snapshot, "utf8"));
  assert.ok(await readFile(nested, "utf8"));
  assert.ok(await readFile(link, "utf8"));
  assert.deepEqual(await readdir(folder), []);
  await writeFile(
    join(root, "src/themes/prod/default/palette/generated/extra.json"),
    "// Generated by npm run build:prod. Edit the corresponding inputs and rebuild.\n{}",
  );
  await assert.rejects(buildProdThemes({ root }), /Stale generated outputs.*extra.json/);
});

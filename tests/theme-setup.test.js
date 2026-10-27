/**
 * Minimal theme setup tests.
 * @file Verify buildable scaffolds, source isolation, command-line targeting, and cleanup after setup failures.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { addTheme } from "../scripts/themes/add-theme.js";
import { addThemeProperties } from "../scripts/themes/add-properties.js";
import { buildDevThemes, buildProdThemes } from "../scripts/themes/build.js";
import { parseJsonc } from "../scripts/lib/jsonc-validation.js";
import { createBuildProject, readBuildOutputs } from "./test-projects.js";

/** Asynchronous child-process runner used to exercise the actual CLI entry points. */
const run = promisify(execFile);

/**
 * Create valid default inputs and a small reference that differs from the default token keys.
 * @param t - Test context responsible for temporary fixture cleanup.
 * @returns Isolated repository root.
 */
async function createSetupProject(t) {
  /** Complete default theme and source root. */
  const root = await createBuildProject(t);

  await mkdir(join(root, "docs/references"), { recursive: true });
  await writeFile(
    join(root, "docs/references/all-theme-properties.json"),
    '// Reference colors are intentionally irrelevant.\n{"colors":{"z.background":"#f00","a.foreground":"#f00"},"semanticTokenColors":{"enum":"#f00","*.readonly":"#f00"}}',
  );
  await writeFile(join(root, ".prettierrc.json"), '{"printWidth":1,"trailingComma":"none"}');

  return root;
}

/**
 * Snapshot source file paths and contents to detect unintended edits or leftover files.
 * @param root - Fixture repository root.
 * @returns Sorted relative file paths paired with their original contents.
 */
async function snapshot(root) {
  /** Recursive file listing, including sources and any generated outputs. */
  const files = await readdir(root, { recursive: true, withFileTypes: true });

  return Promise.all(
    files
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .sort()
      .map(async (path) => [path.slice(root.length + 1), await readFile(path, "utf8")]),
  );
}

for (const group of ["dev", "prod"]) {
  test(`new ${group} themes contain exactly five inputs and build with complete reference properties`, async (t) => {
    /** Complete fixture with a deliberately different reference and default token set. */
    const root = await createSetupProject(t);

    /** All existing sources must remain byte-for-byte identical during setup. */
    const before = await snapshot(root);

    /** Setup summary containing only the requested target and its created sources. */
    const result = await addTheme({ root, theme: `${group}/sample` });

    /** Source prefix used to distinguish the new files from existing defaults. */
    const prefix = `src/themes/${group}/sample/`;

    assert.deepEqual(result.files.map((path) => path.slice(prefix.length)).sort(), [
      "details/semantic.jsonc",
      "details/ui.jsonc",
      "palette/palette-config.jsonc",
      "tokens/semantic.jsonc",
      "tokens/ui.jsonc",
    ]);
    assert.deepEqual(
      (await snapshot(root)).filter(([path]) => !path.startsWith(prefix)),
      before,
    );
    assert.equal((await snapshot(root)).length, before.length + 5);
    assert.equal(result.command, `npm run build:${group}`);
    assert.ok(result.updates.every((update) => update.theme === `${group}/sample` && update.added.length === 2));

    for (const [path, keys] of [
      ["tokens/ui.jsonc", ["a.foreground", "z.background"]],
      ["tokens/semantic.jsonc", ["*.readonly", "enum"]],
      ["details/ui.jsonc", []],
      ["details/semantic.jsonc", []],
      ["palette/palette-config.jsonc", ["useDefaultPalette"]],
    ]) {
      /** Parsed scaffold source checked for exact keys and placeholder behavior. */
      const value = parseJsonc(await readFile(join(root, prefix, path), "utf8"), path).value;

      assert.deepEqual(Object.keys(value), keys);

      if (path.startsWith("tokens/")) {
        for (const definition of Object.values(value)) {
          assert.equal(definition.color, "#0ff");
          assert.match(definition.colorReason, /^UNREVIEWED:/);
        }
      }

      if (path.startsWith("palette/")) assert.equal(value.useDefaultPalette, true);
    }

    /** A populated theme must not change when properties are added again. */
    const complete = await snapshot(root);

    assert.ok(
      (await addThemeProperties({ root, themes: [`${group}/sample`] })).every((update) => !update.added.length),
    );
    assert.deepEqual(await snapshot(root), complete);

    if (group === "prod") {
      await buildProdThemes({ root });
      await buildProdThemes({ root, check: true });
    } else {
      await buildDevThemes({ root });
      await buildDevThemes({ root, check: true });
    }

    /** Built theme confirms placeholder styling and inherited metadata and syntax. */
    const outputPath = `${group === "prod" ? "themes" : "dev-extension/themes"}/cassidy-dark-color-theme-sample.json`;

    /** Generated JSONC with base and syntax aliases resolved against the default palette. */
    const output = parseJsonc(await readFile(join(root, outputPath), "utf8"), outputPath).value;

    assert.equal(output.name, "Fixture");
    assert.equal(output.colors["a.foreground"], "#0ff");
    assert.equal(output.semanticTokenColors.enum.foreground, "#0ff");
    assert.equal(output.tokenColors.length, 1);
  });
}

test("invalid identifiers and existing destinations leave all source files unchanged", async (t) => {
  /** Fixture containing both a directory collision and a destination that is a regular file. */
  const root = await createSetupProject(t);

  await addTheme({ root, theme: "prod/existing" });
  await mkdir(join(root, "src/themes/dev"));
  await writeFile(join(root, "src/themes/dev/occupied"), "Keep this file.\n");

  /** Original files retained across every rejected setup attempt. */
  const before = await snapshot(root);

  for (const theme of [
    undefined,
    "sample",
    "other/sample",
    "dev/../outside",
    "dev/Uppercase",
    "dev/bad..name",
    "dev/bad.",
    "prod/default",
    "prod/existing",
    "dev/existing",
    "dev/occupied",
  ]) {
    await assert.rejects(addTheme({ root, theme }), /Usage:|Invalid theme name|already exists/);
    assert.deepEqual(await snapshot(root), before);
  }
});

test("malformed reference input is rejected before a theme directory is created", async (t) => {
  /** Fixture with a reference that cannot be used to populate token properties. */
  const root = await createSetupProject(t);

  await writeFile(join(root, "docs/references/all-theme-properties.json"), '{"colors":[],"semanticTokenColors":{}}');

  /** Snapshot captured after intentionally invalidating the reference. */
  const before = await snapshot(root);

  await assert.rejects(addTheme({ root, theme: "dev/sample" }), /colors: expected an object/);
  await assert.rejects(stat(join(root, "src/themes/dev/sample")), { code: "ENOENT" });
  assert.deepEqual(await snapshot(root), before);
});

test("a failure during property population removes only the newly created theme", async (t) => {
  /** Fixture whose existing sources and built outputs must survive a failed setup. */
  const root = await createSetupProject(t);

  /** Test-only formatter plugin that rejects populated token sources after scaffolding succeeds. */
  const plugin = join(root, "reject-properties.mjs");

  await writeFile(
    plugin,
    `import { parsers as babelParsers } from ${JSON.stringify(new URL("../node_modules/prettier/plugins/babel.mjs", import.meta.url).href)};
export const parsers = {
  jsonc: {
    ...babelParsers.jsonc,
    parse(source, options) {
      if (source.includes("UNREVIEWED:")) throw new Error("Simulated property formatting failure");
      return babelParsers.jsonc.parse(source, options);
    }
  }
};`,
  );
  await writeFile(join(root, ".prettierrc.json"), JSON.stringify({ plugins: [plugin] }));
  await buildProdThemes({ root });

  /** Existing files and generated artifacts that must survive rollback. */
  const before = await snapshot(root);

  /** Existing generated outputs checked independently from source files. */
  const outputs = await readBuildOutputs(root);

  await assert.rejects(addTheme({ root, theme: "dev/sample" }), /Simulated property formatting failure/);
  await assert.rejects(stat(join(root, "src/themes/dev/sample")), { code: "ENOENT" });
  assert.deepEqual(await snapshot(root), before);
  assert.deepEqual(await readBuildOutputs(root), outputs);
});

test("CLI setup and explicit property targets work without changing the configured allowlist", async (t) => {
  /** Isolated executable copy of the scripts using fixture inputs and installed dependencies. */
  const root = await createSetupProject(t);

  await cp(new URL("../scripts/", import.meta.url), join(root, "scripts"), { recursive: true });
  await symlink(fileURLToPath(new URL("../node_modules/", import.meta.url)), join(root, "node_modules"), "dir");

  /** CLI entry points resolve their source root relative to the copied script location. */
  const setupScript = join(root, "scripts/themes/add-theme.js");

  /** Command output should explain the created files and the next build command. */
  const result = await run(process.execPath, [setupScript, "dev/cli"]);

  assert.match(result.stdout, /Created dev\/cli:/);
  assert.match(result.stdout, /ui: added 2 properties/);
  assert.match(result.stdout, /Build with npm run build:dev/);
  await assert.rejects(run(process.execPath, [setupScript]), /Usage:/);
  await assert.rejects(run(process.execPath, [setupScript, "dev/extra", "dev/another"]), /Usage:/);

  await addTheme({ root, theme: "prod/second" });
  await writeFile(
    join(root, "docs/references/all-theme-properties.json"),
    '{"colors":{"new.background":"#f00"},"semanticTokenColors":{"newType":"#f00"}}',
  );

  /** Existing default files must remain untouched by explicit CLI selections. */
  const before = await snapshot(join(root, "src/themes/prod/default"));

  /** Explicit targets can include multiple groups without editing the script allowlist. */
  const additions = await run(process.execPath, [
    join(root, "scripts/themes/add-properties.js"),
    "dev/cli",
    "prod/second",
  ]);

  assert.match(additions.stdout, /dev\/cli ui: added 1 properties/);
  assert.match(additions.stdout, /prod\/second semantic: added 1 properties/);
  assert.deepEqual(await snapshot(join(root, "src/themes/prod/default")), before);

  /** Repeated CLI calls retain complete source files byte-for-byte. */
  const complete = await snapshot(join(root, "src/themes"));

  await run(process.execPath, [join(root, "scripts/themes/add-properties.js"), "dev/cli", "prod/second"]);
  assert.deepEqual(await snapshot(join(root, "src/themes")), complete);
});

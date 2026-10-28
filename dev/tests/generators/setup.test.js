/**
 * Theme scaffolding behavior.
 * @file Verify minimal categorized scaffolds, source isolation, CLI dependencies, and safe reservation failures.
 */

import { buildFixture as buildThemes } from "../helpers/builds.js";
import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, readFile, readdir, symlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createBuildProject, writeFixture } from "../helpers/projects.js";
import { addTheme } from "../../tooling/generators/add-theme.js";

import { parseFormat } from "../../tooling/tokens/formats.js";

/** Child-process runner for supported command wrappers. */
const run = promisify(execFile);

for (const group of ["prod", "dev"]) {
  test(`${group} scaffolds create six paired inputs and retain independent syntax/variable fallback`, async (t) => {
    /** Independent fixture authorities deliberately differ from default styling. */
    const root = await createBuildProject(t);

    await writeFixture(
      join(root, "src/data/tokens/ui/definitions.jsonc"),
      '{"standard":[],"sourceCode":[],"nonStandard":{"a":["foreground"],"z":["background"]},"deprecated":[]}',
    );

    await writeFixture(
      join(root, "src/data/tokens/semantic/definitions.jsonc"),
      '{"standard":[],"sourceCode":[],"nonStandard":["*.readonly","enum"],"deprecated":[]}',
    );

    /** Production files must stay unchanged during creation. */
    const before = await readFile(join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"), "utf8");

    /** Completed operation result retained for subsequent validation. */
    const result = await addTheme({ root, theme: `${group}/my-theme` });

    /** Final source directory for the requested isolated theme. */
    const directory = join(root, `src/themes/${group}/my-theme`);

    assert.equal(result.files.length, 6);
    assert.equal(result.command, `npm run build:${group}`);
    assert.equal(await readFile(join(root, "src/themes/prod/default/tokens/ui/definitions.jsonc"), "utf8"), before);
    assert.deepEqual((await readdir(join(directory, "tokens"))).sort(), ["semantic", "ui"]);

    for (const family of ["ui", "semantic"]) {
      /** Final file shape must decode and provide complete copied/generated documentation. */
      const path = join(directory, `tokens/${family}/definitions.jsonc`);

      /** Normalized definitions retained independently from matching documentation. */
      const definitions = parseFormat(await readFile(path, "utf8"), path, family, "definitions");

      /** Final paired documentation filename for the selected family. */
      const detailsPath = join(directory, `tokens/${family}/details.jsonc`);

      /** Normalized documentation records retained separately from styling. */
      const details = parseFormat(await readFile(detailsPath, "utf8"), detailsPath, family, "details");
      assert.equal(definitions.records.size, 2);
      assert.equal(details.records.size, 2);
      for (const record of definitions.records.values()) assert.equal(record.value.color, "#0ff");
    }

    await buildThemes({ root });
  });
}

for (const theme of [undefined, "other/name", "dev/Uppercase", "dev/bad..name", "dev/name/extra", "prod/default"]) {
  test(`invalid or duplicate scaffold ${theme} does not create a target`, async (t) => {
    /** Complete project with a known target inventory. */
    const root = await createBuildProject(t);

    /** Original filesystem state retained for mutation or restoration assertions. */
    const before = await readdir(join(root, "src/themes"), { recursive: true });
    await assert.rejects(addTheme({ root, theme }));
    assert.deepEqual(await readdir(join(root, "src/themes"), { recursive: true }), before);
  });
}

test("existing real or linked target paths are protected", async (t) => {
  /** Empty pre-existing destination is still owned by its creator. */
  const root = await createBuildProject(t);
  await mkdir(join(root, "src/themes/dev/existing"), { recursive: true });
  await symlink(join(root, "absent"), join(root, "src/themes/dev/linked"), "dir");
  await assert.rejects(addTheme({ root, theme: "dev/existing" }), /already exists/);
  await assert.rejects(addTheme({ root, theme: "dev/linked" }), /already exists/);
});

test("invalid defaults or formatting fail before creating a theme directory", async (t) => {
  /** Formatter configuration failure occurs during candidate preparation. */
  const root = await createBuildProject(t);
  await writeFixture(join(root, ".prettierrc.json"), '{"plugins":["missing-fixture-formatter"]}');
  await assert.rejects(addTheme({ root, theme: "dev/failure" }), /missing-fixture-formatter/);
  await assert.rejects(readFile(join(root, "src/themes/dev/failure/metadata.jsonc")), { code: "ENOENT" });
});

test("CLI fixtures include tooling and shared data, and supported wrappers preserve error status", async (t) => {
  /** Standalone executable fixture has final dependencies, never just the scripts directory. */
  const root = await createBuildProject(t);

  await cp(new URL("../../scripts/", import.meta.url), join(root, "dev/scripts"), { recursive: true });
  await cp(new URL("../../tooling/", import.meta.url), join(root, "dev/tooling"), { recursive: true });
  await symlink(fileURLToPath(new URL("../../../node_modules/", import.meta.url)), join(root, "node_modules"), "dir");
  await writeFixture(join(root, "package.json"), '{"name":"fixture","type":"module","contributes":{"themes":[]}}');

  /** Creation and explicit property completion run through the actual command wrappers. */
  const result = await run(process.execPath, [join(root, "dev/scripts/themes/add-theme.js"), "dev/cli"]);

  assert.match(result.stdout, /Created new dev\/cli theme/);
  await run(process.execPath, [join(root, "dev/scripts/themes/add-properties.js"), "dev/cli"]);
  await assert.rejects(
    run(process.execPath, [join(root, "dev/scripts/themes/add-theme.js"), "invalid"]),
    (error) => error.code === 1 && /prod\/name or dev\/name/.test(error.stderr),
  );
});

test("partial scaffold application rolls back newly created directories and permits a clean retry", async (t) => {
  /** Controlled failure happens after the new target has received its first real file. */
  const root = await createBuildProject(t);

  /** Actual replacement count supplies a deterministic failure boundary. */
  let replacements = 0;

  await assert.rejects(
    addTheme({
      root,
      theme: "dev/retry",
      operations: {
        /**
         * Write the first candidate and reject the next replacement.
         * @param path - Final source filename.
         * @param source - Complete prepared bytes.
         */
        replace: async (path, source) => {
          replacements++;
          if (replacements === 2) throw new Error("injected scaffold application failure");
          await writeFixture(path, source);
        },
      },
    }),
    /injected scaffold application failure.*prior artifacts restored/,
  );

  await assert.rejects(readdir(join(root, "src/themes/dev/retry")), { code: "ENOENT" });
  assert.equal((await addTheme({ root, theme: "dev/retry" })).theme, "dev/retry");
});

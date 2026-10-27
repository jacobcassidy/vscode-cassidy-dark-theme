/**
 * Preview build workflow tests.
 * @file Verify command-level builds synchronize previews and report reloads without changing validation behavior.
 */

import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildDevThemes, buildProdThemes, runBuild } from "../scripts/themes/build.js";
import { createBuildProject, writeDefaultPaletteConfig } from "./test-projects.js";

/** Exact terminal instruction, including the requested yellow color and reset. */
const reminder =
  "\u001b[33mRun Developer: Reload Window in VS Code, then select a Cassidy Dark Preview theme.\u001b[0m";

/**
 * Create an isolated command workflow with source inputs and a captured logger.
 * @param t - Test context used to clean up the source and preview directories.
 * @returns Build options and captured terminal messages.
 */
async function createWorkflow(t) {
  /** Complete source fixture with temporary outputs. */
  const root = await createBuildProject(t);

  /** Preview installation isolated from the user's VS Code extensions. */
  const extensionDirectory = join(root, "extension");

  /** Captured build output, including ANSI sequences. */
  const logs = [];

  await mkdir(join(root, "images"));
  await writeDefaultPaletteConfig(join(root, "src/themes/dev/sample"));

  return {
    root,
    extensionDirectory,
    logs,
    logger: {
      /**
       * Record one command output message.
       * @param [message] - Message emitted by the workflow.
       */
      log: (message = "") => logs.push(message),
    },
  };
}

for (const mode of ["all", "prod", "dev"]) {
  test(`${mode} builds sync previews and only request reload for registration changes`, async (t) => {
    /** Isolated source inputs and preview destination for this build mode. */
    const project = await createWorkflow(t);

    if (mode === "dev") await buildProdThemes(project);

    /** First successful command result reports initial preview installation. */
    const first = await runBuild({ ...project, mode });

    assert.equal(first.reloadRequired, true);
    assert.equal(project.logs.filter((line) => line === reminder).length, 1);
    assert.equal(project.logs.filter((line) => line.startsWith("\u001b[32mSynced dev manifest:")).length, 1);
    assert.equal(
      JSON.parse(await readFile(first.manifestPath, "utf8")).contributes.themes.length,
      mode === "prod" ? 1 : 2,
    );
    project.logs.length = 0;
    assert.equal((await runBuild({ ...project, mode })).reloadRequired, false);
    assert.ok(!project.logs.includes(reminder));

    /** Source metadata changed to force a preview registration update. */
    const metadata = join(
      project.root,
      mode === "dev" ? "src/themes/dev/sample/metadata.jsonc" : "src/themes/prod/default/metadata.jsonc",
    );

    await writeFile(metadata, '{"name":"Renamed","type":"dark"}');
    project.logs.length = 0;
    assert.equal((await runBuild({ ...project, mode })).reloadRequired, true);
    assert.equal(project.logs.filter((line) => line === reminder).length, 1);

    /** Ordinary color edit that the preview theme file watcher can load live. */
    const input = join(project.root, "src/themes/prod/default/tokens/ui.jsonc");

    /** Existing documented properties retained while updating one color. */
    const tokens = JSON.parse(await readFile(input, "utf8"));

    tokens["editor.background"] = { color: "#123456", colorReason: "Test live color preview." };
    await writeFile(input, JSON.stringify(tokens));
    project.logs.length = 0;
    assert.equal((await runBuild({ ...project, mode })).reloadRequired, false);
    assert.ok(!project.logs.includes(reminder));
  });
}

test("checks, palette-only builds, and low-level builds do not install the preview extension", async (t) => {
  /** Isolated workflow whose extension directory must remain absent. */
  const project = await createWorkflow(t);

  await buildProdThemes(project);
  await buildDevThemes(project);

  for (const mode of ["all", "prod", "dev", "palette"]) {
    assert.equal(await runBuild({ ...project, mode, check: true }), undefined);
  }

  assert.equal(await runBuild({ ...project, mode: "palette" }), undefined);
  await assert.rejects(access(project.extensionDirectory), { code: "ENOENT" });
  assert.ok(!project.logs.includes(reminder));
});

test("combined builds skip sync and reminders when the development build fails", async (t) => {
  /** Isolated workflow with an invalid development metadata input. */
  const project = await createWorkflow(t);

  await writeFile(join(project.root, "src/themes/dev/sample/metadata.jsonc"), "{");
  await assert.rejects(runBuild(project), /metadata/);
  await assert.rejects(access(project.extensionDirectory), { code: "ENOENT" });
  assert.ok(!project.logs.includes(reminder));
});

test("build reports missing production outputs and sync failures without a reload reminder", async (t) => {
  /** Isolated workflow used to verify command error propagation. */
  const project = await createWorkflow(t);

  await assert.rejects(runBuild({ ...project, mode: "dev" }), /Missing generated themes directory.*Run npm run build/);
  assert.ok(!project.logs.includes(reminder));
  await buildProdThemes(project);
  await rm(join(project.root, "themes/cassidy-dark-color-theme.json"));
  await assert.rejects(runBuild({ ...project, mode: "dev" }), /Missing generated theme.*Run npm run build/);
  assert.ok(!project.logs.includes(reminder));
  await rm(project.extensionDirectory, { recursive: true, force: true });
  await symlink(project.root, project.extensionDirectory, "dir");
  await assert.rejects(runBuild(project), /folder must be a regular directory/);
  assert.ok(!project.logs.includes(reminder));
});

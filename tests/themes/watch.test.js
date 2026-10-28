/**
 * Theme watcher tests.
 * @file Verify native source watching, debouncing, queued builds, recovery, and graceful shutdown.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, realpath, rename, rm } from "node:fs/promises";
import { writeFixture as writeFile, createBuildProject, writeDefaultPaletteConfig } from "../helpers/projects.js";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { parse } from "jsonc-parser";
import { watchThemes } from "../../tooling/themes/watch.js";

/**
 * Poll an asynchronous condition until it succeeds or the watcher test deadline expires.
 *
 * @param predicate - Asynchronous condition that must become true before the deadline.
 */
async function waitFor(predicate) {
  /** Latest allowed time for the asynchronous watcher condition to succeed. */
  const deadline = Date.now() + 5000;

  while (!(await predicate())) {
    assert.ok(Date.now() < deadline, "Timed out waiting for the watcher");
    await delay(10);
  }
}

/** Capture watcher messages and expose build and reload-reminder counters. */
function captureLogs() {
  /** Captured normal watcher messages. */
  const logs = [];

  /** Unmodified terminal output retained for ANSI color assertions. */
  const rawLogs = [];

  /** Captured watcher error messages. */
  const errors = [];

  return {
    logs,
    rawLogs,
    errors,
    logger: {
      /**
       * Capture a normal watcher message for later assertions.
       *
       * @param message - Diagnostic or log message to record.
       */
      log: (message = "") => {
        rawLogs.push(message);
        logs.push(stripVTControlCharacters(message));
      },

      /**
       * Capture a watcher error message for later assertions.
       *
       * @param message - Diagnostic or log message to record.
       */
      error: (message) => errors.push(message),
    },

    /** Count completed-build messages in the captured watcher log. */
    builds: () => logs.filter((message) => message.startsWith("[watch] Built ")).length,

    /** Count shared reminders that request a VS Code reload. */
    reminders: () => logs.filter((message) => message.includes("Run Developer: Reload Window in VS Code")).length,
  };
}

/**
 * Create a source fixture with a native watcher and register its shutdown with the test.
 *
 * @param t - Node.js test context used to register fixture cleanup.
 * @param [options] - Options passed to this operation.
 * @param [options.dev] - Whether to include a development source target in the test fixture.
 */
async function createWatchProject(t, { dev = true } = {}) {
  /** Temporary theme-source project root. */
  const root = await createBuildProject(t);

  /** Isolated preview extension destination for native watcher tests. */
  const extensionDirectory = join(root, "extension");

  for (const directory of ["images", "preview/snapshots"]) await mkdir(join(root, directory), { recursive: true });

  if (dev) {
    await writeDefaultPaletteConfig(join(root, "src/themes/dev/sample"));
    await writeFile(join(root, "src/themes/dev/sample/metadata.jsonc"), '{"name":"Dev Fixture","type":"dark"}');
  }

  /** Captured messages and counters for the current watcher. */
  const output = captureLogs();

  /** Watcher lifecycle handle registered for test cleanup. */
  const controller = watchThemes({ root, extensionDirectory, debounceMs: 25, logger: output.logger });

  t.after(() => controller.close());
  await controller.ready;
  assert.deepEqual(output.errors, []);

  return { root, extensionDirectory, controller, ...output };
}

test("watch builds both groups on startup and syncs linked dev theme registrations", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Preview manifest contents used for registration or preservation assertions. */
  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.ok(project.builds() >= 1);
  assert.equal(project.reminders(), 1);
  assert.ok(
    project.rawLogs.includes(
      "\u001b[35mRun Developer: Reload Window in VS Code, then select a Cassidy Dark Preview theme.\u001b[0m",
    ),
  );

  assert.equal(manifest.name, "cassidy-dark-dev");
  assert.deepEqual(
    manifest.contributes.themes.map(({ label, _watch }) => [label, _watch]),
    [
      ["Fixture Preview", true],
      ["Dev Fixture Preview (Sample)", true],
    ],
  );

  assert.equal(
    await realpath(join(project.extensionDirectory, "preview")),
    await realpath(join(project.root, "preview")),
  );

  await project.controller.close();
});

test("watch rebuilds prod and inherited dev colors and follows repeated replacement saves", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Production UI input rewritten to simulate replacement saves. */
  const input = join(project.root, "src/themes/prod/default/tokens/ui/definitions.jsonc");

  /** Other documented UI properties retained during each replacement save. */
  const tokens = parse(await readFile(input, "utf8"));

  for (const [color, replacement] of [
    ["#123456", true],
    ["#abcdef", true],
    ["#334455", false],
  ]) {
    /** Build count recorded before or during a simulated source change. */
    const count = project.builds();

    tokens.nonStandard.editor.background = { color, colorReason: "Replacement save preview." };

    if (replacement) {
      await writeFile(`${input}.tmp`, JSON.stringify(tokens));
      await rename(`${input}.tmp`, input);
    } else await writeFile(input, JSON.stringify(tokens));

    await waitFor(() => project.builds() > count);

    for (const path of [
      "themes/cassidy-dark-color-theme.json",
      "preview/themes/cassidy-dark-color-theme-sample.json",
    ]) {
      assert.equal(parse(await readFile(join(project.root, path), "utf8")).colors["editor.background"], color);
    }
  }

  assert.equal(project.reminders(), 1, "Color-only edits must not request a window reload");
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch rebuilds dev overrides, refreshes metadata registrations, and preserves prod output", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Production theme source retained for comparison after dev-only edits. */
  const prod = await readFile(join(project.root, "themes/cassidy-dark-color-theme.json"), "utf8");

  /** Build count recorded before or during a simulated source change. */
  const count = project.builds();

  await mkdir(join(project.root, "src/themes/dev/sample/tokens"));

  await writeFile(
    join(project.root, "src/themes/dev/sample/tokens/ui/details.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{},"deprecated":{}}',
  );
  await writeFile(
    join(project.root, "src/themes/dev/sample/tokens/ui/definitions.jsonc"),
    '{"standard":{},"sourceCode":{},"nonStandard":{"editor": {"background": {"color":"#010203","colorReason":"Dev preview background."}}},"deprecated":{}}',
  );

  await writeFile(join(project.root, "src/themes/dev/sample/metadata.jsonc"), '{"name":"Renamed","type":"light"}');
  await waitFor(() => project.builds() > count);

  /** Parsed development output inspected after a source change. */
  const dev = parse(await readFile(join(project.root, "preview/themes/cassidy-dark-color-theme-sample.json"), "utf8"));

  /** Preview manifest contents used for registration or preservation assertions. */
  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.equal(dev.colors["editor.background"], "#010203");
  assert.equal(dev.type, "light");
  assert.equal(manifest.contributes.themes[1].label, "Renamed Preview (Sample)");
  assert.equal(manifest.contributes.themes[1].uiTheme, "vs");
  assert.equal(await readFile(join(project.root, "themes/cassidy-dark-color-theme.json"), "utf8"), prod);
  assert.equal(project.reminders(), 2);

  /** Build count before changing only the preview suffix metadata. */
  const beforePreviewRename = project.builds();

  await writeFile(
    join(project.root, "src/themes/dev/sample/metadata.jsonc"),
    '{"name":"Renamed","type":"light","previewName":"Live Experiment"}',
  );

  await waitFor(() => project.builds() > beforePreviewRename);

  /** Refreshed manifest confirming a preview-name-only edit changes registration. */
  const renamed = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.equal(renamed.contributes.themes[1].label, "Renamed Preview (Live Experiment)");
  assert.equal(renamed.contributes.themes[1].uiTheme, "vs");
  assert.equal(project.reminders(), 3);
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch discovers a dev source tree created after startup", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t, { dev: false });

  /** Build count recorded before or during a simulated source change. */
  const count = project.builds();
  await writeDefaultPaletteConfig(join(project.root, "src/themes/dev/new"));
  await waitFor(() => project.builds() > count);

  /** New target records its explicit default-palette choice instead of duplicating reports. */
  const note = await readFile(join(project.root, "src/themes/dev/new/palette/default-palette.txt"), "utf8");
  assert.match(note, /dev\/new.*default palette is being used/);
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch preserves outputs after invalid source and recovers on the next save", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Metadata input path changed to exercise watcher recovery or registration updates. */
  const source = join(project.root, "src/themes/prod/default/metadata.jsonc");

  /** Original valid metadata restored after the invalid-source scenario. */
  const valid = await readFile(source, "utf8");

  /** Generated production theme path used by the recovery assertion. */
  const themePath = join(project.root, "themes/cassidy-dark-color-theme.json");

  /** Generated production theme contents preserved during an invalid build. */
  const theme = await readFile(themePath, "utf8");

  /** Preview manifest path checked during failure and recovery. */
  const manifestPath = join(project.extensionDirectory, "package.json");

  /** Preview manifest contents used for registration or preservation assertions. */
  const manifest = await readFile(manifestPath, "utf8");

  /** Build count recorded before or during a simulated source change. */
  const count = project.builds();
  await writeFile(source, '{"name":');
  await waitFor(() => project.errors.length > 0);
  assert.equal(await readFile(themePath, "utf8"), theme);
  assert.equal(await readFile(manifestPath, "utf8"), manifest);
  await writeFile(source, valid);
  await waitFor(() => project.builds() > count);
  assert.match(project.errors[0], /Waiting for a corrected input/);
  await project.controller.close();
});

test("watch ignores generated output changes and unrelated source directories", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  // Native recursive watching can report existing directories during startup discovery.
  await delay(150);

  /** Build count recorded before or during a simulated source change. */
  const count = project.builds();
  await writeFile(join(project.root, "preview/themes/cassidy-dark-color-theme-sample.json"), "// Edited output\n");
  await writeFile(join(project.root, "src/themes/dev/sample/palette/default-palette.txt"), "Edited report\n");
  await mkdir(join(project.root, "src/unrelated"));
  await writeFile(join(project.root, "src/unrelated/input.jsonc"), "{}");
  await delay(150);
  assert.equal(project.builds(), count);
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch removes a deleted dev target's generated output and refreshes registrations", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Build count recorded before a source theme is removed. */
  const count = project.builds();

  /** Generated development theme that becomes stale when its source is removed. */
  const path = "preview/themes/cassidy-dark-color-theme-sample.json";

  await rm(join(project.root, "src/themes/dev/sample"), { recursive: true });
  await waitFor(() => project.builds() > count);
  await assert.rejects(readFile(join(project.root, path)), { code: "ENOENT" });

  /** Preview registrations after cleanup and synchronization. */
  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.equal(manifest.contributes.themes.length, 1);
  assert.equal(project.reminders(), 2);
  assert.ok(project.rawLogs.includes(`\u001b[34m  ${path} (removed)\u001b[0m`));
  assert.ok(
    project.logs.some(
      (line) => line.includes("Built 1 prod and 0 dev themes") && line.includes("1 generated output removed"),
    ),
  );

  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch detects snapshot registration changes and keeps content-only edits live", async (t) => {
  /** Native watcher fixture with an initially empty snapshot directory. */
  const project = await createWatchProject(t);

  /** Snapshot registered, renamed, edited, and removed during this watch session. */
  const path = join(project.root, "preview/snapshots/baseline.json");

  await writeFile(path, '{"name":"Snapshot","type":"dark","colors":{},"tokenColors":[]}');
  await waitFor(() => project.reminders() === 2);

  /** Successful-build count before a color-only snapshot replacement. */
  const count = project.logs.filter((line) => line.includes("Synced dev manifest")).length;

  await writeFile(
    `${path}.tmp`,
    '{"name":"Snapshot","type":"dark","colors":{"editor.background":"#123456"},"tokenColors":[]}',
  );

  await rename(`${path}.tmp`, path);
  await waitFor(() => project.logs.filter((line) => line.includes("Synced dev manifest")).length > count);
  assert.equal(project.reminders(), 2);
  await writeFile(path, '{"name":"Snapshot","type":"light","previewName":"Renamed","colors":{},"tokenColors":[]}');
  await waitFor(() => project.reminders() === 3);
  await rm(path);
  await waitFor(() => project.reminders() === 4);
  assert.deepEqual(project.errors, []);
});

test("watch detects manifest replacement saves without rebuilding indefinitely", async (t) => {
  /** Native watcher fixture used to verify root manifest inputs and write filtering. */
  const project = await createWatchProject(t);

  /** Root manifest path observed through its parent to support atomic replacements. */
  const path = join(project.root, "package.json");

  /** Source manifest whose registration identity changes independently of theme metadata. */
  const manifest = JSON.parse(await readFile(path, "utf8"));

  /** A preview-only event can notice new registrations before the root manifest event triggers its build. */
  const beforeManifestEdit = project.builds();

  manifest.contributes.themes[0].id = "updated-preview-id";
  await writeFile(`${path}.tmp`, JSON.stringify(manifest));
  await rename(`${path}.tmp`, path);
  await waitFor(() => project.reminders() === 2 && project.builds() > beforeManifestEdit);
  await project.controller.whenIdle();

  /** Completed build count used to ensure unchanged manifest events settle. */
  const count = project.builds();
  await writeFile(path, await readFile(path, "utf8"));
  await delay(150);
  assert.equal(project.builds(), count);
  manifest.description = "Unrelated package metadata";
  await writeFile(path, JSON.stringify(manifest));
  await waitFor(() => project.builds() > count);
  assert.equal(project.reminders(), 2);
  await delay(150);
  assert.equal(project.builds(), count + 1);
  assert.deepEqual(project.errors, []);
});

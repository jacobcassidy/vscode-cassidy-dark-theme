/**
 * Theme watcher tests.
 * @file Verify native source watching, debouncing, queued builds, recovery, and graceful shutdown.
 */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { parse } from "jsonc-parser";
import { syncDevExtension } from "../scripts/dev-extension/sync.js";
import { watchThemes } from "../scripts/themes/watch.js";
import { createBuildProject, createPreviewProject, writeDefaultPaletteConfig } from "./test-projects.js";

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

  for (const directory of ["images", "dev-extension/static-snapshots"])
    await mkdir(join(root, directory), { recursive: true });

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
      "\u001b[36mRun Developer: Reload Window in VS Code, then select a Cassidy Dark Preview theme.\u001b[0m",
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
    await realpath(join(project.extensionDirectory, "dev-extension")),
    await realpath(join(project.root, "dev-extension")),
  );
  await project.controller.close();
});

test("watch rebuilds prod and inherited dev colors and follows repeated replacement saves", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Production UI input rewritten to simulate replacement saves. */
  const input = join(project.root, "src/themes/prod/default/tokens/ui.jsonc");

  /** Other documented UI properties retained during each replacement save. */
  const tokens = parse(await readFile(input, "utf8"));

  for (const color of ["#123456", "#abcdef"]) {
    /** Build count recorded before or during a simulated source change. */
    const count = project.builds();

    await writeFile(
      `${input}.tmp`,
      JSON.stringify({ ...tokens, "editor.background": { color, colorReason: "Replacement save preview." } }),
    );
    await rename(`${input}.tmp`, input);
    await waitFor(() => project.builds() > count);

    for (const path of [
      "themes/cassidy-dark-color-theme.json",
      "dev-extension/themes/cassidy-dark-color-theme-sample.json",
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
  await mkdir(join(project.root, "src/themes/dev/sample/details"));
  await writeFile(join(project.root, "src/themes/dev/sample/details/ui.jsonc"), "{}");
  await writeFile(
    join(project.root, "src/themes/dev/sample/tokens/ui.jsonc"),
    '{"editor.background":{"color":"#010203","colorReason":"Dev preview background."}}',
  );
  await writeFile(join(project.root, "src/themes/dev/sample/metadata.jsonc"), '{"name":"Renamed","type":"light"}');
  await waitFor(() => project.builds() > count);

  /** Parsed development output inspected after a source change. */
  const dev = parse(
    await readFile(join(project.root, "dev-extension/themes/cassidy-dark-color-theme-sample.json"), "utf8"),
  );

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
  assert.match(project.errors[0], /Waiting for the next source change to retry/);
  await project.controller.close();
});

test("watch ignores generated output changes and unrelated source directories", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  // Native recursive watching can report existing directories during startup discovery.
  await delay(150);

  /** Build count recorded before or during a simulated source change. */
  const count = project.builds();

  await writeFile(
    join(project.root, "dev-extension/themes/cassidy-dark-color-theme-sample.json"),
    "// Edited output\n",
  );
  await writeFile(join(project.root, "src/themes/dev/sample/palette/default-palette.txt"), "Edited report\n");
  await mkdir(join(project.root, "src/unrelated"));
  await writeFile(join(project.root, "src/unrelated/input.jsonc"), "{}");
  await delay(150);
  assert.equal(project.builds(), count);
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch keeps stale-output safeguards when a dev target is removed", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createWatchProject(t);

  /** Build count recorded before or during a simulated source change. */
  const count = project.builds();

  /** Generated development theme path retained during target-removal checks. */
  const devThemePath = join(project.root, "dev-extension/themes/cassidy-dark-color-theme-sample.json");

  /** Development output contents expected to survive stale-target rejection. */
  const devTheme = await readFile(devThemePath, "utf8");
  await rm(join(project.root, "src/themes/dev/sample"), { recursive: true });
  await waitFor(() => project.errors.length > 0);
  assert.match(project.errors[0], /Stale generated outputs/);
  assert.equal(await readFile(devThemePath, "utf8"), devTheme);
  await rm(devThemePath);

  /** Metadata input path changed to exercise watcher recovery or registration updates. */
  const source = join(project.root, "src/themes/prod/default/metadata.jsonc");
  await writeFile(source, await readFile(source, "utf8"));
  await waitFor(() => project.builds() > count);

  /** Preview manifest contents used for registration or preservation assertions. */
  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));
  assert.equal(manifest.contributes.themes.length, 1);
  assert.equal(project.reminders(), 2);
  await project.controller.close();
});

/**
 * Create a controllable watcher with stubbed build services for scheduler assertions.
 *
 * @param t - Node.js test context used to register fixture cleanup.
 * @param project - Temporary project paths and fixture metadata.
 * @param [overrides] - Service replacements for the current scheduler scenario.
 */
function createScheduler(t, project, overrides = {}) {
  /** Event emitter standing in for the native source watcher. */
  const events = new EventEmitter();

  /** Recorded build/sync service invocation order. */
  const calls = [];

  /** Captured messages and counters for the current watcher. */
  const output = captureLogs();

  /** Native-watcher callbacks indexed by watched directory for simulated file events. */
  const listeners = new Map();

  /** Watched directories whose native watcher has received close. */
  const closedPaths = [];

  /** Watcher lifecycle handle registered for test cleanup. */
  const controller = watchThemes(
    { ...project, debounceMs: 20, logger: output.logger },
    {
      /**
       * Capture the watcher callback and return an event emitter with controllable shutdown.
       *
       * @param path - Watched directory used to select the simulated event listener.
       * @param _options - Unused native-watcher options in the test double.
       * @param listener - Native file-event callback captured for simulated source changes.
       */
      watch: (path, _options, listener) => {
        listeners.set(path, listener);

        /** Independent watcher emitter for this directory. */
        const watcher = path === join(project.root, "src") ? events : new EventEmitter();

        /** Mark the stubbed native watcher closed when scheduler cleanup runs. */
        watcher.close = () => closedPaths.push(path);

        return watcher;
      },

      /**
       * Record or control the production build phase for the current scheduler scenario.
       *
       * @returns Build summary containing changed paths, the default palette, and per-target results.
       */
      buildProdThemes: async () => {
        calls.push("prod");
        return { changed: [], targets: [{}] };
      },

      /**
       * Record or control the development build phase for the current scheduler scenario.
       *
       * @returns Per-target palettes and changed output paths.
       */
      buildDevThemes: async () => {
        calls.push("dev");
        return [{ changed: [] }];
      },

      /**
       * Record or control preview synchronization for the current scheduler scenario.
       *
       * @param options - Options passed to this operation.
       * @returns Preview manifest path and reload requirement.
       */
      syncDevExtension: async (options) => {
        calls.push("sync");
        return syncDevExtension(options);
      },
      ...overrides,
    },
  );

  t.after(() => controller.close());

  return {
    controller,
    events,
    calls,

    /**
     * Deliver a synthetic event to the source or registration watcher.
     * @param event - Native event type.
     * @param filename - Path relative to the selected watched directory.
     * @param [directory] - Watched directory; defaults to the source tree.
     */
    notify: (event, filename, directory = join(project.root, "src")) => listeners.get(directory)(event, filename),

    /** Report whether every stubbed native watcher has been closed. */
    didClose: () => closedPaths.length === listeners.size,
    ...output,
  };
}

test("watch debounces burst saves and ignores paths outside both source trees", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createPreviewProject(t);

  /** Controllable watcher and captured service calls for scheduler assertions. */
  const scheduler = createScheduler(t, project);
  await scheduler.controller.ready;
  scheduler.notify("change", "unrelated/input.jsonc");
  scheduler.notify("change", "../dev-extension/themes/generated.json");
  scheduler.notify("change", "themes/dev/test/palette/generated/palette.json");
  scheduler.notify("rename", "themes/dev/test/palette/generated");
  scheduler.notify("change", "themes\\dev\\test\\palette\\generated\\palette.md");
  scheduler.notify("change", "themes/dev/test/palette/default-palette.txt");
  scheduler.notify("change", "themes\\dev\\test\\palette\\default-palette.txt");
  scheduler.notify("rename", "themes/dev/test/palette/.theme-build-example");
  scheduler.notify("change", "themes/dev/test/palette/.theme-build-example/output");
  await delay(60);
  assert.equal(scheduler.builds(), 1);
  for (let index = 0; index < 10; index++) scheduler.notify("change", "themes/dev/test/tokens/ui.jsonc");
  await waitFor(() => scheduler.builds() === 2);
  await delay(60);
  assert.deepEqual(scheduler.calls, ["prod", "dev", "sync", "prod", "dev", "sync"]);
  await scheduler.controller.close();
});

test("watch queues edits during a build without overlapping passes", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createPreviewProject(t);

  /** Deferred signal marking entry into a deliberately paused build. */
  const entered = Promise.withResolvers();

  /** Deferred signal used to release a deliberately paused build. */
  const release = Promise.withResolvers();

  /** Build count recorded before or during a simulated source change. */
  let count = 0;

  t.after(() => release.resolve());

  /** Controllable watcher and captured service calls for scheduler assertions. */
  const scheduler = createScheduler(t, project, {
    /**
     * Record or control the production build phase for the current scheduler scenario.
     *
     * @returns Build summary containing changed paths, the default palette, and per-target results.
     */
    buildProdThemes: async () => {
      count++;

      if (count === 2) {
        entered.resolve();
        await release.promise;
      }

      return { changed: [], targets: [{}] };
    },
  });

  await scheduler.controller.ready;
  scheduler.notify("change", "themes/prod/default/tokens/ui.jsonc");
  await entered.promise;
  scheduler.notify("change", "themes/dev/test/metadata.jsonc");
  await delay(60);
  assert.equal(count, 2);
  assert.equal(scheduler.builds(), 1);
  release.resolve();
  await waitFor(() => scheduler.builds() === 3);
  assert.equal(count, 3);
  await scheduler.controller.close();
});

test("watch retries when a native event has no filename and accepts Windows path separators", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createPreviewProject(t);

  /** Controllable watcher and captured service calls for scheduler assertions. */
  const scheduler = createScheduler(t, project);
  await scheduler.controller.ready;
  scheduler.notify("rename", undefined);
  await waitFor(() => scheduler.builds() === 2);
  scheduler.notify("change", "themes\\dev\\test\\metadata.jsonc");
  await waitFor(() => scheduler.builds() === 3);
  await scheduler.controller.close();
});

for (const stage of ["prod", "dev", "sync"]) {
  test(`watch stops a failed ${stage} cycle and retries on the next source event`, async (t) => {
    /** Temporary source/preview fixture used by this watcher scenario. */
    const project = await createPreviewProject(t);

    /** Recorded build/sync service invocation order. */
    const calls = [];

    /** Whether the injected service should fail before the recovery save. */
    let failing = true;

    /** Controllable watcher and captured service calls for scheduler assertions. */
    const scheduler = createScheduler(t, project, {
      /**
       * Record or control the production build phase for the current scheduler scenario.
       *
       * @returns Build summary containing changed paths, the default palette, and per-target results.
       */
      buildProdThemes: async () => {
        calls.push("prod");
        if (failing && stage === "prod") throw new Error("Invalid prod source");
        return { changed: [], targets: [{}] };
      },

      /**
       * Record or control the development build phase for the current scheduler scenario.
       *
       * @returns Per-target palettes and changed output paths.
       */
      buildDevThemes: async () => {
        calls.push("dev");
        if (failing && stage === "dev") throw new Error("Invalid dev source");
        return [];
      },

      /**
       * Record or control preview synchronization for the current scheduler scenario.
       *
       * @param options - Options passed to this operation.
       * @returns Preview manifest path and reload requirement.
       */
      syncDevExtension: async (options) => {
        calls.push("sync");
        if (failing && stage === "sync") throw new Error("Cannot sync dev extension");
        return syncDevExtension(options);
      },
    });

    await scheduler.controller.ready;
    assert.equal(scheduler.errors.length, 1);
    assert.deepEqual(calls, ["prod", "dev", "sync"].slice(0, ["prod", "dev", "sync"].indexOf(stage) + 1));
    failing = false;
    scheduler.notify("change", "themes/prod/default/metadata.jsonc");
    await waitFor(() => scheduler.builds() === 1);
    assert.deepEqual(calls.slice(-3), ["prod", "dev", "sync"]);
    await scheduler.controller.close();
  });
}

test("watch shutdown cancels pending rebuilds and waits for an active build", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createPreviewProject(t);

  /** Deferred signal used to release a deliberately paused build. */
  const release = Promise.withResolvers();

  t.after(() => release.resolve());

  /** Controllable watcher and captured service calls for scheduler assertions. */
  const scheduler = createScheduler(t, project, {
    /**
     * Record or control the production build phase for the current scheduler scenario.
     *
     * @returns Build summary containing changed paths, the default palette, and per-target results.
     */
    buildProdThemes: async () => {
      await release.promise;
      return { changed: [], targets: [{}] };
    },
  });

  scheduler.notify("change", "themes/prod/default/metadata.jsonc");

  /** Whether the controller’s graceful shutdown has completed. */
  let closed = false;

  /** Shutdown promise observed while a build is still active. */
  const closing = scheduler.controller.close().then(() => {
    closed = true;
  });

  await delay(60);
  assert.equal(closed, false);
  assert.equal(scheduler.didClose(), true);
  release.resolve();
  await closing;
  assert.equal(scheduler.builds(), 1);
  scheduler.notify("change", "themes/prod/default/metadata.jsonc");
  await delay(60);
  assert.equal(scheduler.builds(), 1);
  await scheduler.controller.close();
});

test("watch reports native watcher failures and closes cleanly", async (t) => {
  /** Temporary source/preview fixture used by this watcher scenario. */
  const project = await createPreviewProject(t);

  /** Controllable watcher and captured service calls for scheduler assertions. */
  const scheduler = createScheduler(t, project);
  await scheduler.controller.ready;

  /** Synthetic native watcher failure used to verify error shutdown. */
  const error = new Error("Native watcher unavailable");
  scheduler.events.emit("error", error);
  assert.equal(await scheduler.controller.closed, error);
  assert.equal(scheduler.didClose(), true);
  assert.match(scheduler.errors[0], /File watcher failed/);
});

test("watch detects snapshot registration changes and keeps content-only edits live", async (t) => {
  /** Native watcher fixture with an initially empty snapshot directory. */
  const project = await createWatchProject(t);

  /** Snapshot registered, renamed, edited, and removed during this watch session. */
  const path = join(project.root, "dev-extension/static-snapshots/baseline.json");

  await writeFile(path, '{"name":"Snapshot","type":"dark","colors":{},"tokenColors":[]}');
  await waitFor(() => project.reminders() === 2);

  /** Successful-build count before a color-only snapshot replacement. */
  const count = project.builds();

  await writeFile(
    `${path}.tmp`,
    '{"name":"Snapshot","type":"dark","colors":{"editor.background":"#123456"},"tokenColors":[]}',
  );
  await rename(`${path}.tmp`, path);
  await waitFor(() => project.builds() > count);
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

  manifest.contributes.themes[0].id = "updated-preview-id";
  await writeFile(`${path}.tmp`, JSON.stringify(manifest));
  await rename(`${path}.tmp`, path);
  await waitFor(() => project.reminders() === 2);

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

test("watch filters root and preview output events while accepting snapshot inputs", async (t) => {
  /** Preview fixture for deterministic event filtering assertions. */
  const project = await createPreviewProject(t);

  /** Watch scheduler with separately addressable native watcher callbacks. */
  const scheduler = createScheduler(t, project);

  await scheduler.controller.ready;
  scheduler.notify("change", "README.md", project.root);
  scheduler.notify("change", "package.json", project.root);
  scheduler.notify("change", "themes/generated.json", join(project.root, "dev-extension"));
  scheduler.notify("change", "static-snapshots/README.md", join(project.root, "dev-extension"));
  await delay(60);
  assert.equal(scheduler.builds(), 1);
  scheduler.notify("change", "static-snapshots\\baseline.json", join(project.root, "dev-extension"));
  await waitFor(() => scheduler.builds() === 2);
  assert.equal(scheduler.reminders(), 1);
});

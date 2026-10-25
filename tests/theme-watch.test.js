import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { parse } from "jsonc-parser";
import { syncDevExtension } from "../scripts/dev-extension/sync.js";
import { watchThemes } from "../scripts/themes/watch.js";
import { createBuildProject, createPreviewProject } from "./test-projects.js";

async function waitFor(predicate) {
  const deadline = Date.now() + 5000;

  while (!(await predicate())) {
    assert.ok(Date.now() < deadline, "Timed out waiting for the watcher");
    await delay(10);
  }
}

function captureLogs() {
  const logs = [];
  const errors = [];

  return {
    logs,
    errors,
    logger: { log: (message) => logs.push(message), error: (message) => errors.push(message) },
    builds: () => logs.filter((message) => message.startsWith("[watch] Built ")).length,
    reminders: () => logs.filter((message) => message.includes("registrations changed")).length,
  };
}

async function createWatchProject(t, { dev = true } = {}) {
  const root = await createBuildProject(t);
  const extensionDirectory = join(root, "extension");

  for (const directory of ["images", "dev/snapshots"]) await mkdir(join(root, directory), { recursive: true });

  if (dev) {
    await mkdir(join(root, "src/dev/themes/sample"), { recursive: true });
    await writeFile(join(root, "src/dev/themes/sample/metadata.jsonc"), '{"name":"Dev Fixture","type":"dark"}');
  }

  const output = captureLogs();
  const controller = watchThemes({ root, extensionDirectory, debounceMs: 25, logger: output.logger });

  t.after(() => controller.close());
  await controller.ready;
  assert.deepEqual(output.errors, []);

  return { root, extensionDirectory, controller, ...output };
}

test("watch builds both groups on startup and syncs linked dev theme registrations", async (t) => {
  const project = await createWatchProject(t);
  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.ok(project.builds() >= 1);
  assert.equal(project.reminders(), 1);
  assert.equal(manifest.name, "cassidy-dark-dev");
  assert.deepEqual(
    manifest.contributes.themes.map(({ label, _watch }) => [label, _watch]),
    [
      ["Fixture Dev", true],
      ["Dev Fixture Dev (Sample)", true],
    ],
  );
  assert.equal(await realpath(join(project.extensionDirectory, "dev")), await realpath(join(project.root, "dev")));
  await project.controller.close();
});

test("watch rebuilds prod and inherited dev colors and follows repeated replacement saves", async (t) => {
  const project = await createWatchProject(t);
  const input = join(project.root, "src/prod/themes/default/tokens/ui.jsonc");

  for (const color of ["#123456", "#abcdef"]) {
    const count = project.builds();

    await writeFile(`${input}.tmp`, JSON.stringify({ colors: { "editor.background": color } }));
    await rename(`${input}.tmp`, input);
    await waitFor(() => project.builds() > count);

    for (const path of ["themes/cassidy-dark-color-theme.json", "dev/themes/cassidy-dark-color-theme-sample.json"]) {
      assert.equal(parse(await readFile(join(project.root, path), "utf8")).colors["editor.background"], color);
    }
  }

  assert.equal(project.reminders(), 1, "Color-only edits must not request a window reload");
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch rebuilds dev overrides, refreshes metadata registrations, and preserves prod output", async (t) => {
  const project = await createWatchProject(t);
  const prod = await readFile(join(project.root, "themes/cassidy-dark-color-theme.json"), "utf8");
  const count = project.builds();

  await mkdir(join(project.root, "src/dev/themes/sample/tokens"));
  await writeFile(
    join(project.root, "src/dev/themes/sample/tokens/ui.jsonc"),
    '{"colors":{"editor.background":"#010203"}}',
  );
  await writeFile(join(project.root, "src/dev/themes/sample/metadata.jsonc"), '{"name":"Renamed","type":"light"}');
  await waitFor(() => project.builds() > count);

  const dev = parse(await readFile(join(project.root, "dev/themes/cassidy-dark-color-theme-sample.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.equal(dev.colors["editor.background"], "#010203");
  assert.equal(dev.type, "light");
  assert.equal(manifest.contributes.themes[1].label, "Renamed Dev (Sample)");
  assert.equal(manifest.contributes.themes[1].uiTheme, "vs");
  assert.equal(await readFile(join(project.root, "themes/cassidy-dark-color-theme.json"), "utf8"), prod);
  assert.equal(project.reminders(), 2);
  await project.controller.close();
});

test("watch discovers a dev source tree created after startup", async (t) => {
  const project = await createWatchProject(t, { dev: false });
  const count = project.builds();

  await mkdir(join(project.root, "src/dev/themes/new"), { recursive: true });
  await waitFor(() => project.builds() > count);

  const report = JSON.parse(await readFile(join(project.root, "docs/palettes/generated-reports/new/palette.json")));

  assert.equal(report.generated.target, "dev/new");
  assert.equal(report.generated.fallback, true);
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch preserves outputs after invalid source and recovers on the next save", async (t) => {
  const project = await createWatchProject(t);
  const source = join(project.root, "src/prod/themes/default/metadata.jsonc");
  const valid = await readFile(source, "utf8");
  const themePath = join(project.root, "themes/cassidy-dark-color-theme.json");
  const theme = await readFile(themePath, "utf8");
  const manifestPath = join(project.extensionDirectory, "package.json");
  const manifest = await readFile(manifestPath, "utf8");
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
  const project = await createWatchProject(t);

  // Native recursive watching can report existing directories during startup discovery.
  await delay(150);

  const count = project.builds();

  await writeFile(join(project.root, "dev/themes/cassidy-dark-color-theme-sample.json"), "// Edited output\n");
  await writeFile(join(project.root, "docs/palettes/generated-reports/sample/palette.md"), "Edited report\n");
  await mkdir(join(project.root, "src/unrelated"));
  await writeFile(join(project.root, "src/unrelated/input.jsonc"), "{}");
  await delay(150);
  assert.equal(project.builds(), count);
  assert.deepEqual(project.errors, []);
  await project.controller.close();
});

test("watch keeps stale-output safeguards when a dev target is removed", async (t) => {
  const project = await createWatchProject(t);
  const count = project.builds();
  const devThemePath = join(project.root, "dev/themes/cassidy-dark-color-theme-sample.json");
  const devTheme = await readFile(devThemePath, "utf8");

  await rm(join(project.root, "src/dev/themes/sample"), { recursive: true });
  await waitFor(() => project.errors.length > 0);
  assert.match(project.errors[0], /Stale generated outputs/);
  assert.equal(await readFile(devThemePath, "utf8"), devTheme);
  await rm(devThemePath);
  await rm(join(project.root, "docs/palettes/generated-reports/sample"), { recursive: true });

  const source = join(project.root, "src/prod/themes/default/metadata.jsonc");

  await writeFile(source, await readFile(source, "utf8"));
  await waitFor(() => project.builds() > count);

  const manifest = JSON.parse(await readFile(join(project.extensionDirectory, "package.json"), "utf8"));

  assert.equal(manifest.contributes.themes.length, 1);
  assert.equal(project.reminders(), 2);
  await project.controller.close();
});

function createScheduler(t, project, overrides = {}) {
  const events = new EventEmitter();
  const calls = [];
  const output = captureLogs();
  let notify;
  let didClose = false;
  const controller = watchThemes(
    { ...project, debounceMs: 20, logger: output.logger },
    {
      watch: (_path, _options, listener) => {
        notify = listener;
        events.close = () => {
          didClose = true;
        };

        return events;
      },
      buildProdThemes: async () => {
        calls.push("prod");

        return { changed: [], targets: [{}] };
      },
      buildDevThemes: async () => {
        calls.push("dev");

        return [{ changed: [] }];
      },
      syncDevExtension: async (options) => {
        calls.push("sync");

        return syncDevExtension(options);
      },
      ...overrides,
    },
  );

  t.after(() => controller.close());

  return { controller, events, calls, notify, didClose: () => didClose, ...output };
}

test("watch debounces burst saves and ignores paths outside both source trees", async (t) => {
  const project = await createPreviewProject(t);
  const scheduler = createScheduler(t, project);

  await scheduler.controller.ready;
  scheduler.notify("change", "unrelated/input.jsonc");
  scheduler.notify("change", "../dev/themes/generated.json");
  scheduler.notify("change", "../docs/palettes/generated-reports/test/palette.json");
  await delay(60);
  assert.equal(scheduler.builds(), 1);

  for (let index = 0; index < 10; index++) scheduler.notify("change", "dev/themes/test/tokens/ui.jsonc");

  await waitFor(() => scheduler.builds() === 2);
  await delay(60);
  assert.deepEqual(scheduler.calls, ["prod", "dev", "sync", "prod", "dev", "sync"]);
  await scheduler.controller.close();
});

test("watch queues edits during a build without overlapping passes", async (t) => {
  const project = await createPreviewProject(t);
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  let count = 0;

  t.after(() => release.resolve());

  const scheduler = createScheduler(t, project, {
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
  scheduler.notify("change", "prod/themes/default/tokens/ui.jsonc");
  await entered.promise;
  scheduler.notify("change", "dev/themes/test/metadata.jsonc");
  await delay(60);
  assert.equal(count, 2);
  assert.equal(scheduler.builds(), 1);
  release.resolve();
  await waitFor(() => scheduler.builds() === 3);
  assert.equal(count, 3);
  await scheduler.controller.close();
});

test("watch retries when a native event has no filename and accepts Windows path separators", async (t) => {
  const project = await createPreviewProject(t);
  const scheduler = createScheduler(t, project);

  await scheduler.controller.ready;
  scheduler.notify("rename", undefined);
  await waitFor(() => scheduler.builds() === 2);
  scheduler.notify("change", "dev\\themes\\test\\metadata.jsonc");
  await waitFor(() => scheduler.builds() === 3);
  await scheduler.controller.close();
});

for (const stage of ["prod", "dev", "sync"]) {
  test(`watch stops a failed ${stage} cycle and retries on the next source event`, async (t) => {
    const project = await createPreviewProject(t);
    const calls = [];
    let failing = true;
    const scheduler = createScheduler(t, project, {
      buildProdThemes: async () => {
        calls.push("prod");

        if (failing && stage === "prod") throw new Error("Invalid prod source");

        return { changed: [], targets: [{}] };
      },
      buildDevThemes: async () => {
        calls.push("dev");

        if (failing && stage === "dev") throw new Error("Invalid dev source");

        return [];
      },
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
    scheduler.notify("change", "prod/themes/default/metadata.jsonc");
    await waitFor(() => scheduler.builds() === 1);
    assert.deepEqual(calls.slice(-3), ["prod", "dev", "sync"]);
    await scheduler.controller.close();
  });
}

test("watch shutdown cancels pending rebuilds and waits for an active build", async (t) => {
  const project = await createPreviewProject(t);
  const release = Promise.withResolvers();

  t.after(() => release.resolve());

  const scheduler = createScheduler(t, project, {
    buildProdThemes: async () => {
      await release.promise;

      return { changed: [], targets: [{}] };
    },
  });

  scheduler.notify("change", "prod/themes/default/metadata.jsonc");

  let closed = false;
  const closing = scheduler.controller.close().then(() => {
    closed = true;
  });

  await delay(60);
  assert.equal(closed, false);
  assert.equal(scheduler.didClose(), true);
  release.resolve();
  await closing;
  assert.equal(scheduler.builds(), 1);
  scheduler.notify("change", "prod/themes/default/metadata.jsonc");
  await delay(60);
  assert.equal(scheduler.builds(), 1);
  await scheduler.controller.close();
});

test("watch reports native watcher failures and closes cleanly", async (t) => {
  const project = await createPreviewProject(t);
  const scheduler = createScheduler(t, project);

  await scheduler.controller.ready;

  const error = new Error("Native watcher unavailable");

  scheduler.events.emit("error", error);
  assert.equal(await scheduler.controller.closed, error);
  assert.equal(scheduler.didClose(), true);
  assert.match(scheduler.errors[0], /File watcher failed/);
});

/**
 * Deterministic watcher scheduling.
 * @file Verify shared-description fast paths, serialized invalidation, idle recovery observation, preview retries, and closure without wall-clock waits.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { createBuildProject } from "../helpers/projects.js";
import { watchThemes } from "../../tooling/themes/watch.js";

/** Settle queued promise continuations without timer sleeps. */
async function settle() {
  await new Promise(setImmediate);
}

/**
 * Create fake native subscriptions and an explicit timer clock around the real serialized scheduler.
 * @param t - Test cleanup context.
 * @param [overrides] - Specific workflow overrides, preserving event/timer behavior.
 */
async function scheduler(t, overrides = {}) {
  /** Isolated files satisfy root-manifest comparisons without installed extension access. */
  const root = await createBuildProject(t),
    listeners = new Map(),
    timers = new Map(),
    calls = [],
    errors = [],
    logs = [];

  /** Mutable observed external state and accepted classification snapshot. */
  const state = { busy: false },
    current = { projection: "accepted" };

  /** Monotonic fake timer identifiers and observed native handle closure. */
  let projectionReads = 0;

  /** Monotonic timer identities and native handle counts. */
  let timerId = 0,
    closed = 0;

  /** Real scheduler is exercised; only its public workflow/timer boundaries are injected. */
  const controller = watchThemes(
    {
      root,
      extensionDirectory: join(root, "extension"),
      debounceMs: 10,
      recoveryMs: 1000,
      logger: {
        /**
         * Capture watcher progress and notify local observation barriers.
         * @param message - Diagnostic or progress message to capture.
         */
        log: (message) => logs.push(message),

        /**
         * Capture visible watcher failure diagnostics.
         * @param message - Diagnostic or progress message to capture.
         */
        error: (message) => errors.push(message),
      },
    },
    {
      /**
       * Register a fake subscription whose event/error callbacks can be driven explicitly.
       * @param path - Native subscription root.
       * @param options - Native recursive option.
       * @param listener - Source callback.
       */
      watch: (path, options, listener) => {
        /** Retained native handle records shutdown and supports error events. */
        const emitter = new EventEmitter();

        assert.equal(typeof options.recursive, "boolean");
        listeners.set(path, listener);

        /** Mark this subscription closed without emitting additional source events. */
        emitter.close = () => {
          closed++;
        };

        return emitter;
      },

      /**
       * Register an explicit fake timer, never a wall-clock wait.
       * @param callback - Timer callback.
       * @param ms - Requested delay.
       */
      setTimeout: (callback, ms) => {
        timers.set(++timerId, { callback, ms });
        return timerId;
      },

      /**
       * Cancel the exact queued fake timer.
       * @param id - Timer identity.
       */
      clearTimeout: (id) => timers.delete(id),

      /**
       * Observe the controlled external writer state without mutation.
       */
      observeWriter: async () => ({ ...state }),

      /**
       * Provide a distinct authored-input projection for simulated source events.
       */
      inputProjection: async () => String(++projectionReads),

      /**
       * Supply a controlled shared snapshot or persistent recovery failure.
       */
      loadTokenData: async () => {
        calls.push("load");
        return { ...current };
      },

      /**
       * Prepare a controlled generation behind the public scheduler boundary.
       */
      prepareBuild: async () => {
        calls.push("prepare");
        return {};
      },

      /**
       * Return the controlled applied artifact summary.
       */
      applyBuild: async () => {
        calls.push("apply");
        return { targets: [{ group: "prod" }, { group: "dev" }], changed: [], removed: [] };
      },

      /**
       * Simulate current preview synchronization or a retryable failure.
       */
      syncDevExtension: async () => {
        calls.push("sync");
        return { reloadRequired: false };
      },
      ...overrides,
    },
  );

  t.after(() => controller.close());
  await controller.ready;

  return {
    controller,
    root,
    current,
    state,
    calls,
    errors,
    logs,
    timers,

    /**
     * Drive a subscribed native event.
     * @param path - Source-root-relative filename.
     * @param [directory] - Subscription root override.
     */
    notify(path, directory = join(root, "src")) {
      listeners.get(directory)("change", path);
    },

    /**
     * Run currently queued timers of one delay, then settle asynchronous work.
     * @param ms - Timer delay selected by the test.
     * @param [idle] - Whether to await all active work after timer delivery.
     */
    async tick(ms, idle = true) {
      for (const [id, timer] of [...timers]) {
        if (timer.ms !== ms) continue;
        timers.delete(id);
        await timer.callback();
      }

      if (idle) await controller.whenIdle();
      else await settle();
    },

    /** Return the number of closed native subscriptions. */
    closedCount() {
      return closed;
    },
  };
}

test("valid shared description/version/usage changes load once and perform zero compilation/application/sync", async (t) => {
  /** Initial build establishes an accepted classification projection. */
  const project = await scheduler(t);
  project.calls.length = 0;
  project.notify("token-data/ui/details.jsonc");
  project.notify("token-data/semantic/details.jsonc");
  await project.tick(10);
  assert.deepEqual(project.calls, ["load"]);
  project.current.projection = "classification-or-scope-evidence-changed";
  project.notify("token-data/syntax/details.jsonc");
  await project.tick(10);
  assert.deepEqual(project.calls, ["load", "load", "prepare", "apply", "sync"]);
});

test("source filters exclude extraction configuration/generated files and accept unknown theme names and Windows separators", async (t) => {
  /** Fake timers prove ignored events do not even queue a pass. */
  const project = await scheduler(t);

  project.calls.length = 0;

  for (const path of [
    "token-data/upstream-sources.jsonc",
    "themes/prod/default/palette/generated/palette.json",
    "themes/prod/default/palette/default-palette.txt",
    "themes/prod/default/.theme-build-owned",
    "unrelated/value.jsonc",
  ])
    project.notify(path);

  await project.tick(10);
  assert.deepEqual(project.calls, []);
  project.notify("themes\\dev\\new\\metadata.jsonc");
  project.notify(undefined);
  await project.tick(10);
  assert.deepEqual(project.calls, ["prepare", "apply", "sync"]);
});

test("blocked recovery observations are read-only, deduplicated, and resume one failed pass without a source event", async (t) => {
  /** Failure is injected at the stable-snapshot boundary, just as an interrupted shared generation behaves. */
  let blocked = true,
    loads = 0;

  /** Explicit snapshots become readable only after recovery clears external state. */
  const project = await scheduler(t, {
    /**
     * Supply a controlled shared snapshot or persistent recovery failure.
     */
    loadTokenData: async () => {
      loads++;
      if (blocked) throw Object.assign(new Error("Incomplete generation fixture"), { code: "INCOMPLETE_GENERATION" });
      return { projection: "accepted" };
    },
  });

  project.state.marker = { id: "fixture" };
  await project.tick(1000);
  await project.tick(1000);
  assert.equal(loads, 1);
  assert.equal(project.errors.length, 1);
  project.notify("themes/prod/default/tokens/ui/definitions.jsonc");
  await project.tick(10);
  assert.equal(loads, 1);

  // A replacement writer still prevents resumption after the original marker disappears.
  delete project.state.marker;
  project.state.busy = true;
  await project.tick(1000);
  assert.equal(loads, 1);
  project.state.busy = false;
  blocked = false;
  await project.tick(1000);
  assert.equal(loads, 2);
  assert.deepEqual(project.calls, ["prepare", "apply", "sync"]);
  assert.equal(project.timers.size, 0);
});

test("preview-only retry skips preparation, application, and shared reload; source events still progress", async (t) => {
  /** Initial synchronization fails after successful artifact application. */
  let failPreview = true,
    syncs = 0;

  /** Injected sync failure keeps generated artifacts outside rollback. */
  const project = await scheduler(t, {
    /**
     * Simulate current preview synchronization or a retryable failure.
     */
    syncDevExtension: async () => {
      syncs++;
      if (failPreview) throw new Error("Preview path temporarily unavailable");
      return { reloadRequired: false };
    },
  });

  assert.deepEqual(project.calls, ["load", "prepare", "apply"]);
  await project.tick(1000);
  assert.equal(syncs, 2);
  assert.equal(project.errors.length, 1);
  project.notify("themes/prod/default/tokens/ui/details.jsonc");
  await project.tick(10);
  assert.equal(project.calls.filter((call) => call === "prepare").length, 2);
  failPreview = false;
  project.calls.length = 0;
  await project.tick(1000);
  assert.deepEqual(project.calls, []);
  assert.equal(project.timers.size, 0);
});

test("edits arriving during preparation coalesce into one later pass with no overlapping work", async (t) => {
  /** Controllable second preparation holds the scheduler while multiple source events arrive. */
  let prepareCount = 0,
    active = 0,
    maximum = 0,
    release;

  /** Entry barrier ensures source events arrive while the second preparation is actually active. */
  let entered;

  /** Resolves at the controlled preparation boundary. */
  const enteredSecond = new Promise((resolve) => {
    entered = resolve;
  });

  t.after(() => release?.());

  /** Public preparation boundary is held without any private call-sequence mocks. */
  const project = await scheduler(t, {
    /**
     * Prepare a controlled generation behind the public scheduler boundary.
     */
    prepareBuild: async () => {
      prepareCount++;
      active++;
      maximum = Math.max(maximum, active);

      if (prepareCount === 2) {
        entered();
        await new Promise((resolve) => {
          release = resolve;
        });
      }

      active--;

      return {};
    },
  });

  project.notify("themes/prod/default/metadata.jsonc");
  await project.tick(10, false);
  await enteredSecond;
  project.notify("themes/dev/new/metadata.jsonc");
  project.notify("themes/prod/default/tokens/ui/definitions.jsonc");
  await project.tick(10, false);
  assert.equal(prepareCount, 2);
  release();
  await project.controller.whenIdle();
  assert.equal(prepareCount, 3);
  assert.equal(maximum, 1);
});

test("snapshot events arriving during synchronization retain one serialized preview-only pass", async (t) => {
  /** Hold a synchronization while another snapshot change and its debounce timer arrive. */
  let syncs = 0,
    release,
    entered;

  /** Explicit barrier identifies the active second synchronization. */
  const enteredSecond = new Promise((resolve) => {
    entered = resolve;
  });

  t.after(() => release?.());

  /** Real scheduler receives snapshot events through its preview subscription. */
  const project = await scheduler(t, {
    /** Synchronize once per consumed snapshot generation, holding the second pass. */
    async syncDevExtension() {
      syncs++;

      if (syncs === 2) {
        entered();
        await new Promise((resolve) => {
          release = resolve;
        });
      }

      return { reloadRequired: false };
    },
  });

  project.calls.length = 0;
  project.notify("snapshots/first.json", join(project.root, "preview"));
  await project.tick(10, false);
  await enteredSecond;
  project.notify("snapshots/second.json", join(project.root, "preview"));
  await project.tick(10, false);
  assert.equal(syncs, 2);
  release();
  await project.controller.whenIdle();
  assert.equal(syncs, 3);
  assert.deepEqual(project.calls, []);
});

test("shutdown cancels blocked-state observation and closes every subscription without late resumption", async (t) => {
  /** Initial contention creates only one pending bounded observation. */
  const project = await scheduler(t, {
    /**
     * Supply a controlled shared snapshot or persistent recovery failure.
     */
    loadTokenData: async () => {
      throw Object.assign(new Error("Writer busy"), { code: "WRITER_BUSY" });
    },
  });

  await project.controller.close();
  await project.tick(1000);
  assert.equal(project.closedCount(), 3);
  assert.equal(project.timers.size, 0);
  assert.deepEqual(project.calls, []);
});

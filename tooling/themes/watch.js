/**
 * Serialized theme watching.
 * @file Validate stable shared snapshots, coalesce source work, retry preview-only failures, and resume after external recovery without source events.
 */

import { mkdirSync, watch as watchDirectory } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { repositoryRoot, tokenDataPaths } from "../shared/paths.js";
import { formatMessage } from "../shared/terminal-output.js";
import { observeWriter, requireStable } from "../shared/transactions.js";
import { readOptional, inputProjection } from "./inputs.js";
import { prepareBuild, applyBuild } from "./build.js";
import { loadTokenData } from "../tokens/data/load.js";
import { logReloadReminder, syncDevExtension } from "../preview/sync.js";

/**
 * Classify source events while excluding generated artifacts and extraction-only configuration.
 * @param filename - Native source-root event path.
 */
function sourceEvent(filename) {
  if (!filename) return "source";

  /** Native event separators normalized independently from the host platform. */
  const path = filename.toString().replaceAll("\\", "/");

  if (/\/(?:\.theme-build-[^/]+|palette\/(?:generated(?:\/|$)|default-palette\.txt$))/.test(path)) return undefined;
  if (
    tokenDataPaths.some((file) => {
      /** Source-relative shared file, including ancestor directory events. */ const relative = file.slice(4);
      return path === relative || relative.startsWith(`${path}/`);
    })
  )
    return "shared";

  return ["themes", "themes/prod", "themes/dev"].some(
    (directory) => path === directory || (directory !== "themes" && path.startsWith(`${directory}/`)),
  )
    ? "source"
    : undefined;
}

/**
 * Watch source/registration inputs through one debounced scheduler with read-only recovery observation.
 * @param [options] - Watcher configuration.
 * @param [options.root] - Checkout or isolated project root.
 * @param [options.extensionDirectory] - Isolated or installed preview destination.
 * @param [options.debounceMs] - Save-burst coalescing delay.
 * @param [options.recoveryMs] - Bounded external-state/preview retry observation interval.
 * @param [options.logger] - Progress/error logger.
 * @param [operations] - Narrow scheduler/workflow replacements for deterministic tests.
 */
export function watchThemes(
  {
    root = repositoryRoot,
    extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
    debounceMs = 150,
    recoveryMs = 1000,
    logger = console,
  } = {},
  operations = {},
) {
  /** Workflow and timer operations are replaceable without mocking private call sequences. */
  const services = {
    watch: watchDirectory,
    prepareBuild,
    applyBuild,
    loadTokenData,
    syncDevExtension,
    observeWriter,
    requireStable,
    inputProjection,
    setTimeout,
    clearTimeout,
    ...operations,
  };

  /** Pending work survives contention, malformed inputs, preview failure, and explicit recovery. */
  let sourceDirty = true,
    sharedDirty = false,
    manifestDirty = false,
    pendingPreview = false,
    failed = false;

  /** Successful local snapshots and own-manifest event comparison. */
  let snapshot, lastManifest, lastDiagnostic, lastSourceProjection, pendingSummary;

  /** Serialized build lifecycle, debounce timer, and bounded recovery observer. */
  let running,
    timer,
    observer,
    blocked = false,
    stopping = false,
    failure,
    resolveClosed;

  /** Shutdown resolves only after all native watchers and in-flight work finish. */
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  /** Cancel bounded observation when normal work resumes or shutdown begins. */
  function stopObserving() {
    services.clearTimeout(observer);
    observer = undefined;
  }

  /** Observe existing coordination metadata without loading or compiling a known incomplete generation. */
  function observeRecovery() {
    if (stopping || observer) return;

    observer = services.setTimeout(async () => {
      observer = undefined;

      try {
        /** Both checkout and installed destination can be held by another checkout's writer. */
        const states = await Promise.all([services.observeWriter(root), services.observeWriter(extensionDirectory)]);

        if (stopping) return;
        if (states.some((state) => state.busy || state.marker)) {
          blocked = true;
          observeRecovery();

          return;
        }

        blocked = false;

        if (failed) sourceDirty = true;

        startBuild();
      } catch (error) {
        report(error);
        observeRecovery();
      }
    }, recoveryMs);
  }

  /**
   * Report a persistent condition once while retaining visible failures and actionable retry guidance.
   * @param error - Workflow or observation failure.
   */
  function report(error) {
    if (lastDiagnostic === error.message) return;

    lastDiagnostic = error.message;
    logger.error(
      `${formatMessage(`[watch] ${error.message}`, "error")}\n${formatMessage("[watch] Waiting for a corrected input, preview retry, or explicit recovery.", "info")}`,
    );
  }

  /** Prepare/apply once, or refresh only shared documentation, or retry only preview synchronization. */
  async function build() {
    /** Consume current work while later events remain queued independently. */
    const source = sourceDirty,
      shared = sharedDirty,
      manifest = manifestDirty;

    sourceDirty = false;
    sharedDirty = false;
    manifestDirty = false;

    try {
      await services.requireStable(root);

      /** A stable shared snapshot is loaded once per pass requiring a reload. */
      const current = !snapshot || shared ? await services.loadTokenData({ root }) : snapshot;
      const classificationChanged = !snapshot || current.projection !== snapshot.projection;
      const manifestChanged = manifest && (await readOptional(join(root, "package.json"))) !== lastManifest;

      /** Native generated-directory events do not invalidate unchanged authored inputs. */
      const sourceProjection = source ? await services.inputProjection(root) : lastSourceProjection;

      if ((source && sourceProjection !== lastSourceProjection) || failed || classificationChanged || manifestChanged) {
        logger.log(formatMessage("[watch] Building prod and dev themes...", "heading"));

        /** Complete combined preparation precedes every output write. */
        const prepared = await services.prepareBuild({ root, snapshot: current });
        const result = await services.applyBuild(prepared);

        snapshot = current;
        lastManifest = await readOptional(join(root, "package.json"));
        failed = false;
        pendingPreview = true;
        pendingSummary = result;
        lastSourceProjection = sourceProjection;
      } else snapshot = current;

      if (pendingPreview) {
        try {
          /** Preview-only retries use already successful generated artifacts and no compiler/palette work. */
          const preview = await services.syncDevExtension({ root, extensionDirectory });

          pendingPreview = false;
          logger.log(formatMessage(`[watch] Synced dev manifest: ${preview.manifestPath}`, "success"));

          if (preview.reloadRequired) logReloadReminder(logger);
        } catch (error) {
          report(
            new Error(
              `Build completed; preview synchronization failed: ${error.message}. Retry npm run sync:preview.`,
              { cause: error },
            ),
          );
          observeRecovery();

          return;
        }
      }

      if (pendingSummary) {
        reportSummary(pendingSummary);
        pendingSummary = undefined;
      }

      lastDiagnostic = undefined;
      blocked = false;
      stopObserving();
    } catch (error) {
      // Retain failed source work so unchanged classification cannot suppress a corrected retry.
      failed = true;

      if (error.code === "STALE_INPUT") {
        sharedDirty = true;
        schedule("source");

        return;
      }

      if (["WRITER_BUSY", "INCOMPLETE_GENERATION"].includes(error.code)) {
        blocked = true;
        observeRecovery();
      }

      report(error);
    }
  }

  /**
   * Report a completed source generation after preview synchronization succeeds.
   * @param result - Applied target/artifact summary.
   */
  function reportSummary(result) {
    /** Counts and path reporting do not trigger an extra compilation or freshness pass. */
    const prod = result.targets.filter((target) => target.group === "prod").length,
      dev = result.targets.length - prod;

    logger.log(
      formatMessage(
        `[watch] Built ${prod} prod and ${dev} dev themes; ${result.changed.length - result.removed.length} generated files updated${result.removed.length ? `; ${result.removed.length} generated output${result.removed.length === 1 ? "" : "s"} removed` : ""}.`,
        "success",
      ),
    );

    for (const path of result.changed)
      logger.log(formatMessage(`  ${path}${result.removed.includes(path) ? " (removed)" : ""}`, "file"));
  }

  /** Start one coalesced pass only when no other pass or blocking writer is active. */
  function startBuild() {
    if (stopping || blocked || running || (!sourceDirty && !sharedDirty && !manifestDirty && !pendingPreview)) return;

    running = build().finally(() => {
      running = undefined;

      if (!stopping && !blocked && !timer && (sourceDirty || sharedDirty || manifestDirty)) startBuild();
    });
  }

  /**
   * Coalesce an accepted event through the serialized scheduler.
   * @param kind - source, shared, manifest, or preview work.
   */
  function schedule(kind) {
    if (stopping) return;
    if (kind === "source") sourceDirty = true;
    if (kind === "shared") sharedDirty = true;
    if (kind === "manifest") manifestDirty = true;
    if (kind === "preview") pendingPreview = true;

    services.clearTimeout(timer);
    timer = services.setTimeout(() => {
      timer = undefined;
      startBuild();
    }, debounceMs);
  }

  /** Native watcher handles are all closed, including partial startup failures. */
  const watchers = [];

  /** Gracefully close watchers/timers and wait for the active pass without queuing more work. */
  function close() {
    if (!stopping) {
      stopping = true;
      sourceDirty = sharedDirty = manifestDirty = pendingPreview = false;
      services.clearTimeout(timer);
      stopObserving();

      for (const watcher of watchers) watcher.close();

      void Promise.resolve(running).then(() => resolveClosed(failure));
    }

    return closed;
  }

  /**
   * Attach one native subscription and register its error handler immediately.
   * @param path - Subscription directory.
   * @param recursive - Whether nested source events are required.
   * @param listener - Event filter/scheduler.
   */
  function addWatcher(path, recursive, listener) {
    /** Retained watcher participates in complete shutdown. */
    const watcher = services.watch(path, { recursive }, listener);

    watchers.push(watcher);
    watcher.on("error", (error) => {
      failure = error;
      logger.error(formatMessage(`[watch] File watcher failed: ${error.message}`, "error"));
      void close();
    });
  }

  try {
    mkdirSync(join(root, "preview"), { recursive: true });
    addWatcher(join(root, "src"), true, (_event, filename) => {
      /** Source filter returns only relevant theme or exact shared-data dependencies. */
      const kind = sourceEvent(filename);

      if (kind) schedule(kind);
    });
    addWatcher(root, false, (_event, filename) => {
      if (!filename || filename.toString() === "package.json") schedule("manifest");
    });
    addWatcher(join(root, "preview"), true, (_event, filename) => {
      /** Generated preview themes are deliberately excluded from recursive input events. */
      const path = filename?.toString().replaceAll("\\", "/");

      if (!path || path === "snapshots" || (path.startsWith("snapshots/") && path.endsWith(".json")))
        schedule("preview");
    });
  } catch (error) {
    for (const watcher of watchers) watcher.close();

    throw error;
  }

  logger.log(
    `${formatMessage("[watch] Watching theme sources, shared token data, package.json, and snapshots.", "info")} ${formatMessage("Press Ctrl+C to stop.", "action")}`,
  );
  startBuild();

  /** Wait for serialized work already started, including passes queued during that work. */
  async function whenIdle() {
    while (running) await running;
  }

  return { ready: running, close, closed, whenIdle };
}

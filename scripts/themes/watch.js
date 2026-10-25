/**
 * Theme source watcher.
 * @file Watch source changes and serialize debounced theme builds and development extension synchronization.
 */

import { watch as watchDirectory } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDevThemes, buildProdThemes } from "./build.js";
import { syncDevExtension } from "../dev-extension/sync.js";
import { readOptional } from "../lib/theme-source-inputs.js";

/** ANSI styles used to distinguish watcher status messages in terminal output. */
const styles = {
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  green: "\u001b[32m",
  orange: "\u001b[38;5;208m",
  red: "\u001b[31m",
  dim: "\u001b[2m",
  reset: "\u001b[0m",
};

/** Apply an ANSI style to a watcher message. */
function styled(message, style) {
  return `${style}${message}${styles.reset}`;
}

/**
 * Extract a stable registration snapshot, returning undefined for absent or invalid manifests.
 *
 * @param source - Preview manifest JSON text, or undefined when no previous manifest exists.
 */
function themeRegistrations(source) {
  try {
    return JSON.stringify(JSON.parse(source).contributes?.themes);
  } catch {
    return undefined;
  }
}

/**
 * Accept events in prod/dev source trees, including unknown filenames that require a rebuild.
 *
 * @param filename - Source path reported by the native watcher, when available.
 */
function isThemeSource(filename) {
  if (!filename) return true;

  /** Watcher event path normalized to forward slashes. */
  const path = filename.toString().replaceAll("\\", "/");

  return ["prod", "dev"].some((group) => {
    /** Theme-source directory inside the current prod or dev group. */
    const directory = `themes/${group}`;

    return path === "themes" || path === directory || path.startsWith(`${directory}/`);
  });
}

/**
 * Watch theme sources and serialize builds; operations can be replaced in isolated scheduler tests.
 *
 * @param [options] - Options passed to this operation.
 * @param [options.root] - Repository or fixture root; defaults to this checkout.
 * @param [options.extensionDirectory] - Separate preview extension directory; defaults to the local VS Code extension path.
 * @param [options.debounceMs] - Delay used to coalesce source-save bursts before rebuilding.
 * @param [options.logger] - Logger receiving build progress, errors, and reload reminders.
 * @param [operations] - Optional watcher/build/sync replacements used by scheduler tests.
 * @returns Startup and shutdown promises plus a graceful close function.
 */
export function watchThemes(
  {
    root = fileURLToPath(new URL("../../", import.meta.url)),
    extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
    debounceMs = 150,
    logger = console,
  } = {},
  operations = {},
) {
  /** Native watcher and build/sync operations, including test replacements. */
  const services = { watch: watchDirectory, buildProdThemes, buildDevThemes, syncDevExtension, ...operations };

  /** Whether a source event has requested another build pass. */
  let pending = true;

  /** Pending debounce timeout, cleared when a save burst settles. */
  let timer;

  /** Promise for the currently active serialized build pass. */
  let running;

  /** Whether graceful shutdown has begun. */
  let stopping = false;

  /** Native watcher error returned when shutdown completes. */
  let failure;

  /** Resolver used to complete the shutdown promise. */
  let resolveClosed;

  /** Promise settled after watcher closure and any active build. */
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  /** Run one prod/dev build and preview sync, reporting failures without stopping future retries. */
  async function build() {
    pending = false;
    logger.log(styled("[watch] Building prod and dev themes...", styles.yellow));

    try {
      /** Production build summary for this watcher cycle. */
      const prod = await services.buildProdThemes({ root });

      /** Development target summaries for this watcher cycle. */
      const dev = await services.buildDevThemes({ root });

      /** Preview manifest contents before synchronization. */
      const previous = await readOptional(join(extensionDirectory, "package.json"));

      /** Generated preview manifest path returned by synchronization. */
      const manifestPath = await services.syncDevExtension({ root, extensionDirectory });

      /** Preview manifest contents after synchronization. */
      const current = await readFile(manifestPath, "utf8");

      /** Total generated files changed across both build groups. */
      const changed = prod.changed.length + dev.reduce((sum, target) => sum + target.changed.length, 0);

      /** Changed generated paths already expressed relative to the repository root. */
      const changedFiles = [...prod.changed, ...dev.flatMap((target) => target.changed)];

      logger.log(
        styled(
          `[watch] Built ${prod.targets.length} prod and ${dev.length} dev themes; ${changed} generated files updated.`,
          styles.green,
        ),
      );

      for (const path of changedFiles) logger.log(styled(`        - ${path}`, styles.dim));

      logger.log();

      if (themeRegistrations(previous) !== themeRegistrations(current)) {
        logger.log(
          styled(
            "[watch] Theme registrations changed. Run Developer: Reload Window, then select a Dev theme.",
            styles.orange,
          ),
        );
      }
    } catch (error) {
      const message = `[watch] ${error.message}`;
      const diagnostic = /stale/i.test(error.message) ? styled(message, styles.red) : message;

      logger.error(`${diagnostic}\n${styled("[watch] Waiting for the next source change to retry.", styles.dim)}`);
    }
  }

  /** Start pending work only when no build is running and shutdown has not begun. */
  function startBuild() {
    if (stopping || running || !pending) return;

    running = build().finally(() => {
      running = undefined;

      if (pending && !timer && !stopping) startBuild();
    });
  }

  /** Native recursive source watcher used by the build scheduler. */
  const watcher = services.watch(join(root, "src"), { recursive: true }, (_event, filename) => {
    if (stopping || !isThemeSource(filename)) return;

    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      startBuild();
    }, debounceMs);
  });

  /** Stop watching, cancel pending work, and resolve shutdown after any active build completes. */
  function close() {
    if (!stopping) {
      stopping = true;
      pending = false;
      clearTimeout(timer);
      watcher.close();
      void Promise.resolve(running).then(() => resolveClosed(failure));
    }

    return closed;
  }

  watcher.on("error", (error) => {
    failure = error;
    logger.error(`[watch] File watcher failed: ${error.message}`);
    void close();
  });

  logger.log(styled("[watch] Watching src/themes/prod/ and src/themes/dev/. Press Ctrl+C to stop.", styles.blue));
  startBuild();

  return { ready: running, close, closed };
}

if (import.meta.main) {
  try {
    /** Watcher lifecycle handle used by the command-line entry point. */
    const controller = watchThemes();

    /** Request graceful watcher shutdown when a process termination signal arrives. */
    const stop = () => void controller.close();

    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);

    try {
      if (await controller.closed) process.exitCode = 1;
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  } catch (error) {
    console.error(`[watch] ${error.message}`);
    process.exitCode = 1;
  }
}

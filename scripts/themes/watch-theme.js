import { watch as watchDirectory } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDevThemes, buildProdThemes } from "./build-theme.js";
import { syncDevExtension } from "../dev-extension/sync.js";
import { readOptional } from "../lib/theme-targets.js";

function themeRegistrations(source) {
  try {
    return JSON.stringify(JSON.parse(source).contributes?.themes);
  } catch {
    return undefined;
  }
}

function isThemeSource(filename) {
  if (!filename) return true;

  const path = filename.toString().replaceAll("\\", "/");

  return ["prod", "dev"].some((group) => {
    const directory = `${group}/themes`;

    return path === group || path === directory || path.startsWith(`${directory}/`);
  });
}

/** Watch theme sources and serialize builds; operations can be replaced in isolated scheduler tests. */
export function watchThemes(
  {
    root = fileURLToPath(new URL("../../", import.meta.url)),
    extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
    debounceMs = 150,
    logger = console,
  } = {},
  operations = {},
) {
  const services = { watch: watchDirectory, buildProdThemes, buildDevThemes, syncDevExtension, ...operations };
  let pending = true;
  let timer;
  let running;
  let stopping = false;
  let failure;
  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  async function build() {
    pending = false;
    logger.log("[watch] Building prod and dev themes...");

    try {
      const prod = await services.buildProdThemes({ root });
      const dev = await services.buildDevThemes({ root });
      const previous = await readOptional(join(extensionDirectory, "package.json"));
      const manifestPath = await services.syncDevExtension({ root, extensionDirectory });
      const current = await readFile(manifestPath, "utf8");
      const changed = prod.changed.length + dev.reduce((sum, target) => sum + target.changed.length, 0);

      logger.log(
        `[watch] Built ${prod.targets.length} prod and ${dev.length} dev themes; ${changed} generated files updated.`,
      );

      if (themeRegistrations(previous) !== themeRegistrations(current)) {
        logger.log("[watch] Theme registrations changed. Run Developer: Reload Window, then select a Dev theme.");
      }
    } catch (error) {
      logger.error(`[watch] ${error.message}\n[watch] Waiting for the next source change to retry.`);
    }
  }

  function startBuild() {
    if (stopping || running || !pending) return;

    running = build().finally(() => {
      running = undefined;

      if (pending && !timer && !stopping) startBuild();
    });
  }

  const watcher = services.watch(join(root, "src"), { recursive: true }, (_event, filename) => {
    if (stopping || !isThemeSource(filename)) return;

    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      startBuild();
    }, debounceMs);
  });

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

  logger.log("[watch] Watching src/prod/themes/ and src/dev/themes/. Press Ctrl+C to stop.");
  startBuild();

  return { ready: running, close, closed };
}

if (import.meta.main) {
  try {
    const controller = watchThemes();
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

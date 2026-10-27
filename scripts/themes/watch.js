/**
 * Theme source watcher.
 * @file Watch source changes and serialize debounced theme builds and development extension synchronization.
 */

import { watchThemes } from "../../tooling/themes/watch.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

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
  console.error(formatMessage(`[watch] ${error.message}`, "error"));
  process.exitCode = 1;
}

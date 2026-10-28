/**
 * Theme source watcher.
 * @file Watch source changes and serialize debounced theme builds and development extension synchronization.
 */

import { watchThemes } from "../../tooling/themes/watch.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";
import { createTerminalProgress } from "../../tooling/shared/terminal-progress.js";

/** Active watcher task during source checks, builds, and preview synchronization. */
let progress;

/**
 * Replace the current watcher task or clear it before ordinary output.
 * @param {string} [message] - Active task, if one is running.
 */
function reportProgress(message) {
  progress?.stop();
  progress = message ? createTerminalProgress(message) : undefined;
}

try {
  /** Watcher lifecycle handle used by the command-line entry point. */
  const controller = watchThemes({ onProgress: reportProgress });

  /** Request graceful watcher shutdown when a process termination signal arrives. */
  const stop = () => void controller.close();

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    if (await controller.closed) process.exitCode = 1;
  } finally {
    reportProgress();
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
} catch (error) {
  reportProgress();
  console.error(formatMessage(`[watch] ${error.message}`, "error"));
  process.exitCode = 1;
}

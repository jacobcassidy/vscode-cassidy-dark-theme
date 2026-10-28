/**
 * Theme and palette builds.
 * @file Assemble theme inputs, resolve colors, generate reports, and write or check build outputs.
 */

import { verifyBuildRestored, runBuild } from "../../tooling/themes/build.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";
import { createTerminalProgress } from "../../tooling/shared/terminal-progress.js";

/** Active build stage, cleared before command results and errors. */
let progress;

/**
 * Replace the current quiet-stage display or clear it for ordinary output.
 * @param {string} [message] - Current build stage.
 */
function reportProgress(message) {
  progress?.stop();
  progress = message ? createTerminalProgress(message) : undefined;
}

try {
  if (process.argv.length === 3 && process.argv[2] === "--recover=verify-restored") {
    reportProgress("Verifying restored build outputs");
    await verifyBuildRestored({ operation: "build" });
    reportProgress();
    console.log(formatMessage("Verified complete restored generation.", "success"));
  } else {
    /** Command-line options validated before selecting a build mode. */
    const flags = process.argv.slice(2);

    if (
      flags.some((flag) => !["--check", "--palette-only", "--dev", "--all"].includes(flag)) ||
      flags.filter((flag) => ["--all", "--dev", "--palette-only"].includes(flag)).length > 1
    ) {
      throw new Error("Usage: node dev/scripts/themes/build.js [--check] [--palette-only | --dev | --all]");
    }

    await runBuild({
      mode: flags.includes("--all")
        ? "all"
        : flags.includes("--dev")
          ? "dev"
          : flags.includes("--palette-only")
            ? "palette"
            : "prod",
      check: flags.includes("--check"),
      onProgress: reportProgress,
    });
  }
} catch (error) {
  reportProgress();
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
} finally {
  reportProgress();
}

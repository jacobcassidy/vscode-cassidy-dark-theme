/**
 * Theme and palette builds.
 * @file Assemble theme inputs, resolve colors, generate reports, and write or check build outputs.
 */

import { verifyBuildRestored, runBuild } from "../../tooling/themes/build.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  if (process.argv.length === 3 && process.argv[2] === "--recover=verify-restored") {
    await verifyBuildRestored({ operation: "build" });
    console.log(formatMessage("Verified complete restored generation.", "success"));
  } else {
    /** Command-line options validated before selecting a build mode. */
    const flags = process.argv.slice(2);

    if (
      flags.some((flag) => !["--check", "--palette-only", "--dev", "--all"].includes(flag)) ||
      flags.filter((flag) => ["--all", "--dev", "--palette-only"].includes(flag)).length > 1
    ) {
      throw new Error("Usage: node scripts/themes/build.js [--check] [--palette-only | --dev | --all]");
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
    });
  }
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

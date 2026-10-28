/**
 * Missing theme properties.
 * @file Add missing UI and semantic tokens and complete matching documentation for the production default.
 */

import { verifyBuildRestored } from "../../tooling/themes/build.js";
import { addThemeProperties } from "../../tooling/generators/add-properties.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";
import { withTerminalProgress } from "../../tooling/shared/terminal-progress.js";

try {
  if (process.argv.length === 3 && process.argv[2] === "--recover=verify-restored") {
    await withTerminalProgress("Verifying restored property generation", () =>
      verifyBuildRestored({ operation: "add-properties" }),
    );
    console.log(formatMessage("Verified complete restored generation.", "success"));
  } else {
    /** Explicit command-line targets, or the configured allowlist when no arguments are supplied. */
    const themes = process.argv.slice(2);

    /** Completed property additions. */
    const updates = await withTerminalProgress("Adding missing theme properties", () =>
      addThemeProperties(themes.length ? { themes } : {}),
    );

    for (const update of updates) {
      console.log(
        formatMessage(
          `${update.theme} ${update.section}: added ${update.added.length} properties (${update.path})`,
          "success",
        ),
      );
    }
  }
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

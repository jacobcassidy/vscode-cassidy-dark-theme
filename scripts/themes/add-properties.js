/**
 * Missing theme properties.
 * @file Add missing UI and semantic tokens and complete matching documentation for the production default.
 */

import { addThemeProperties } from "../../tooling/generators/add-properties.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  /** Explicit command-line targets, or the configured allowlist when no arguments are supplied. */
  const themes = process.argv.slice(2);

  for (const update of await addThemeProperties(themes.length ? { themes } : {})) {
    console.log(
      formatMessage(
        `${update.theme} ${update.section}: added ${update.added.length} properties (${update.path})`,
        "success",
      ),
    );
  }
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

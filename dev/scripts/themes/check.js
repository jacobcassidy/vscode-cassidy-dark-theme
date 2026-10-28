/**
 * Theme validation.
 * @file Validate generated theme structures, manifest registrations, and required asset paths.
 */

import { checkThemes } from "../../tooling/themes/check.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";
import { withTerminalProgress } from "../../tooling/shared/terminal-progress.js";

try {
  /** Validated theme count. */
  const count = await withTerminalProgress("Validating themes and manifest assets", () => checkThemes());

  console.log(formatMessage(`Validated ${count} themes and manifest asset paths.`, "success"));
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

/**
 * Theme validation.
 * @file Validate generated theme structures, manifest registrations, and required asset paths.
 */

import { checkThemes } from "../../tooling/themes/check.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  console.log(formatMessage(`Validated ${await checkThemes()} themes and manifest asset paths.`, "success"));
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

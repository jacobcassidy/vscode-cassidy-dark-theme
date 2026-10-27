/**
 * Legacy consumer audit command.
 * @file Run read-only retired-path, source-contract, and executable reachability checks.
 */

import { checkLegacy } from "../../tooling/maintenance/check-legacy.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  /** Audited executable module and supported entry-point counts. */
  const result = await checkLegacy();

  console.log(
    formatMessage(
      `Audited ${result.modules} executable modules and ${result.roots} runtime/configuration roots.`,
      "success",
    ),
  );
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

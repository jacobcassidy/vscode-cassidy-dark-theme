/**
 * Executable reachability audit command.
 * @file Check executable references, module reachability, and consumed exports without running workflows.
 */

import { checkReachability } from "../../tooling/maintenance/check-reachability.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";
import { withTerminalProgress } from "../../tooling/shared/terminal-progress.js";

try {
  /** Audited executable module and supported entry-point counts. */
  const result = await withTerminalProgress("Auditing executable reachability", () => checkReachability());

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

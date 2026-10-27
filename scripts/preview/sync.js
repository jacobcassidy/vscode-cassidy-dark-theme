/**
 * Preview synchronization command.
 * @file Retry preview registrations and asset links without compiling or generating palettes.
 */

import { syncDevExtension, logReloadReminder } from "../../tooling/preview/sync.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  if (process.argv.length !== 2) throw new Error("Usage: npm run sync:preview");

  /** Successful synchronization and conditional editor reload requirement. */
  const result = await syncDevExtension();

  console.log(formatMessage(`Synced dev manifest: ${result.manifestPath}`, "success"));

  if (result.reloadRequired) logReloadReminder();
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

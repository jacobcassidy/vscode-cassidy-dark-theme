/**
 * Shared description update command.
 * @file Parse explicit upstream/replay/recovery options and report description refresh results and review proposals.
 */

import { updateTokenDetails } from "../../tooling/tokens/data/update-details.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

/** One cancellation signal propagates through retrieval, extraction, and application boundaries. */
const cancellation = new AbortController();

/** Stop pending retrieval/application when an orderly termination signal arrives. */
function cancel() {
  cancellation.abort(new Error("Token detail refresh cancelled"));
}

process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);

try {
  /** Explicit updater arguments and selected source options. */
  const args = process.argv.slice(2),
    options = { extensionSources: [], signal: cancellation.signal };

  for (let index = 0; index < args.length; index++) {
    /** Current CLI flag. */
    const flag = args[index];

    if (["--offline", "--check", "--recover"].includes(flag)) options[flag.slice(2)] = true;
    else if (flag === "--recover=verify-restored") options.recover = "verify-restored";
    else if (["--vscode-source", "--vscode-main-source", "--extension-source"].includes(flag)) {
      /** Required source directory argument, never inferred from an unknown flag. */
      const path = args[++index];

      if (!path || path.startsWith("--")) throw new Error(`${flag} requires a source directory`);

      if (flag === "--extension-source") options.extensionSources.push(path);
      else options[flag === "--vscode-source" ? "vscodeSource" : "vscodeMainSource"] = path;
    } else throw new Error(`Unknown updater option: ${flag}`);
  }

  /** Prepared/applied refresh and nonfatal review proposals. */
  const result = await updateTokenDetails(options);

  console.log(
    formatMessage(
      result.verifiedRestored
        ? "Verified complete restored generation."
        : `${result.replay ? "Recorded-source replay (latest was not checked)" : "Latest upstream inputs verified"}: ${result.changed.length} files ${options.check ? "checked" : "updated"}.`,
      "success",
    ),
  );

  for (const warning of result.warnings) console.warn(formatMessage(warning, "info"));

  for (const proposal of result.proposals)
    console.log(formatMessage(`Review proposal: ${JSON.stringify(proposal)}`, "action"));
} catch (error) {
  console.error(formatMessage(error.message, "error"));

  for (const proposal of error.proposals ?? [])
    console.log(formatMessage(`Review proposal: ${JSON.stringify(proposal)}`, "action"));

  process.exitCode = 1;
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}

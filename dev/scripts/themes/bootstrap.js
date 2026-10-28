/**
 * Clean project bootstrap command.
 * @file Parse verified extension checkouts, prepare a neutral default when needed, and report generated source paths.
 */

import { bootstrapTokenData } from "../../tooling/tokens/data/bootstrap.js";
import { repositoryRoot } from "../../tooling/shared/paths.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";
import { withTerminalProgress } from "../../tooling/shared/terminal-progress.js";

/** Cancellation propagates to source retrieval and guarded application. */
const cancellation = new AbortController();

/** Stop ongoing bootstrap work on orderly termination. */
function cancel() {
  cancellation.abort(new Error("Token bootstrap cancelled"));
}

process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);

try {
  /** Explicit extension checkout arguments. */
  const extensionSources = [];
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index++) {
    if (args[index] !== "--extension-source") throw new Error(`Unknown bootstrap option: ${args[index]}`);
    const path = args[++index];
    if (!path || path.startsWith("--")) throw new Error("--extension-source requires a directory");
    extensionSources.push(path);
  }

  const result = await withTerminalProgress("Bootstrapping shared token data", (update) =>
    bootstrapTokenData({
      root: repositoryRoot,
      extensionSources,
      signal: cancellation.signal,
      onProgress: update,
    }),
  );
  console.log(formatMessage(`Generated ${result.changed.length} source files. Run npm run build.`, "success"));
  for (const warning of result.warnings) console.warn(formatMessage(warning, "info"));
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}

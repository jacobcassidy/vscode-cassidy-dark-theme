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

/**
 * Print unresolved registration ID expressions grouped by source and file.
 * @param warnings - Tab-separated source, file, position, and registration diagnostics.
 */
function printWarnings(warnings) {
  /** Diagnostics grouped as source ID → file path → formatted registrations. */
  const grouped = new Map();

  for (const warning of warnings) {
    /** Source origin and registration details emitted by static extraction. */
    const [source, path, position, ...detail] = warning.split("\t");

    /** Registration lines for the current source snapshot. */
    let files = grouped.get(source);

    if (!files) {
      files = new Map();
      grouped.set(source, files);
    }

    /** Existing or newly created diagnostics for this source file. */
    const registrations = files.get(path) ?? [];
    registrations.push(`${position}: ${detail.join("\t")}`);
    files.set(path, registrations);
  }

  for (const [source, files] of grouped) {
    console.warn(formatMessage(`${source}:`, "info"));

    for (const [path, registrations] of files) {
      console.warn(`  ${path}:`);

      for (const registration of registrations) console.warn(`    ${registration}`);
    }
  }
}

process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);

try {
  /** Explicit extension checkout arguments. */
  const extensionSources = [];
  const args = process.argv.slice(2);

  /** Detailed extraction diagnostics are opt-in to keep normal bootstrap output concise. */
  let debug = false;

  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--debug") {
      debug = true;

      continue;
    }

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
  if (debug) printWarnings(result.warnings);
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}

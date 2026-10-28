/**
 * Isolated color-schema runtime.
 * @file Run the VS Code capture host with console output owned by a dedicated child process.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

/** Exact release, cache, capture-host, and short-profile paths supplied by the parent. */
const [version, commit, cache, host, output, profile] = process.argv.slice(2);

/**
 * Report quiet-stage activity independently of captured console output.
 * @param stage - Current runtime stage shown by the parent's terminal progress.
 */
function report(stage) {
  if (process.send) process.send({ stage });
  else console.error(stage);
}

/**
 * Read product metadata without trusting an installed editor.
 * @param executable - Downloaded VS Code executable path.
 */
async function productFor(executable) {
  /** macOS and Linux place metadata in different ancestor directories. */
  let directory = dirname(executable);

  for (let depth = 0; depth < 6; depth++) {
    for (const relative of ["resources/app/product.json", "Resources/app/product.json"]) {
      try {
        return JSON.parse(await readFile(join(directory, relative), "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    directory = dirname(directory);
  }

  throw new Error(`VS Code product.json was not found beside ${executable}`);
}

try {
  report(`Downloading or reusing VS Code ${version} for schema capture`);

  /** Download progress uses IPC instead of starting the library's second terminal spinner. */
  const executable = await downloadAndUnzipVSCode({
    version,
    cachePath: join(cache, "vscode"),
    reporter: {
      /**
       * Forward meaningful download stages without leaking library console output.
       * @param event - Structured VS Code downloader progress event.
       */
      report(event) {
        if (event.stage === "downloading")
          report(
            `Downloading VS Code ${version}: ${Math.floor(event.bytesSoFar / 1048576)} / ${Math.ceil(event.totalBytes / 1048576)} MB`,
          );
        else if (event.stage === "extractingSynchonrously") report(`Extracting VS Code ${version}`);
        else if (event.stage === "retrying")
          report(`Retrying VS Code ${version} download (${event.attempt}/${event.totalAttempts})`);
      },

      /**
       * Retain downloader diagnostics in the runtime log.
       * @param error - Download failure reported before retry or rejection.
       */
      error(error) {
        console.error(error);
      },
    },
  });

  /** Both source and binary must belong to the same immutable VS Code revision. */
  const product = await productFor(executable);

  if (product.commit !== commit)
    throw new Error(`VS Code ${version} schema runtime commit ${product.commit} does not match ${commit}`);

  report(`Reading registered color schemas from VS Code ${version}`);
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: host,
    extensionTestsPath: join(host, "run.js"),
    extensionTestsEnv: { CASSIDY_SCHEMA_OUTPUT: output },
    cachePath: join(cache, "profiles"),
    launchArgs: [
      `--user-data-dir=${join(profile, "user")}`,
      `--extensions-dir=${join(profile, "extensions")}`,
      "--locale=en-US",
      "--skip-welcome",
      "--skip-release-notes",
      "--new-window",
    ],
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  process.disconnect?.();
}

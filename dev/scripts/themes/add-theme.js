/**
 * Minimal theme setup.
 * @file Create a default-backed theme with complete UI and semantic property placeholders.
 */

import { verifyBuildRestored } from "../../tooling/themes/build.js";
import { addTheme } from "../../tooling/generators/add-theme.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  if (process.argv.length === 3 && process.argv[2] === "--recover=verify-restored") {
    await verifyBuildRestored({ operation: "add-theme" });
    console.log(formatMessage("Verified complete restored generation.", "success"));
  } else {
    if (process.argv.length !== 3) throw new Error("Usage: npm run create -- <prod/name|dev/name>");

    /** Created theme files and property counts reported to the command-line caller. */
    const result = await addTheme({ theme: process.argv[2] });

    console.log(formatMessage(`Created new ${result.theme} theme`, "success"));

    for (const path of result.files) console.log(formatMessage(`  ${path}`, "file"));

    for (const update of result.updates)
      console.log(formatMessage(`${update.path}: added ${update.added.length} properties`, "success"));

    console.log(formatMessage(`Build with \`${result.command}\` or \`npm run build\``, "action"));
  }
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

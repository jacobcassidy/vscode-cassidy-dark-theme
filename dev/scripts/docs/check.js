/**
 * Documentation check command.
 * @file Run read-only maintained link, anchor, and complete JSONC example validation.
 */

import { checkDocs } from "../../tooling/docs/check.js";
import { formatMessage } from "../../tooling/shared/terminal-output.js";

try {
  /** Validated maintained documents, including their links and inline examples. */
  const result = await checkDocs();

  console.log(formatMessage(`Validated ${result.documents} maintained documents.`, "success"));
} catch (error) {
  console.error(formatMessage(error.message, "error"));
  process.exitCode = 1;
}

/**
 * VS Code color schema capture runner.
 * @file Read VS Code's registered virtual JSON schemas from an isolated extension test host.
 */

/** VS Code extension API exposed to the test host. */
const vscode = require("vscode");

/** Filesystem output stays in the caller's ignored cache until transaction preparation finishes. */
const { writeFile } = require("node:fs/promises");

/**
 * Capture the resolved registry schemas after VS Code has initialized its built-in contributions.
 * @returns A promise settled after the JSON snapshot reaches the caller's staging file.
 */
exports.run = async function run() {
  /** Exact registered virtual schema IDs needed for token coverage comparisons. */
  const ids = ["color-theme", "workbench-colors", "token-styling", "textmate-colors"];

  /** Captured schema contents keyed by their virtual registry IDs. */
  const schemas = {};

  for (const id of ids) {
    /** Registered schema bytes served through VS Code's own virtual filesystem. */
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(`vscode://schemas/${id}`));

    schemas[id] = JSON.parse(Buffer.from(bytes).toString("utf8"));
  }

  await writeFile(process.env.CASSIDY_SCHEMA_OUTPUT, JSON.stringify({ version: vscode.version, schemas }));
};

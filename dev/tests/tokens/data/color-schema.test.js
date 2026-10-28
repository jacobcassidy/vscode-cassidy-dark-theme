/**
 * Color theme schema capture contracts.
 * @file Verify versioned schema identities, exact registration gaps, and deterministic release reports.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  colorSchemaReport,
  prepareColorSchema,
  runSchemaRuntime,
  schemaRecords,
} from "../../../tooling/tokens/data/color-schema.js";

for (const code of [0, 7]) {
  test(`schema runtime isolates console output and preserves diagnostics for exit ${code}`, async (t) => {
    /** Real subprocess output verifies descriptor routing without launching VS Code. */
    const root = await mkdtemp(join(tmpdir(), "cassidy-runtime-")),
      modulePath = join(root, "runtime.cjs"),
      logPath = join(root, "capture.log");

    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(
      modulePath,
      `/**
 * Capture worker fixture.
 * @file Emit noisy runtime output and report progress over IPC.
 */
console.log("runtime stdout, including library exit messages");
console.error("runtime stderr");
process.send({ stage: "Reading registered color schemas" });
process.exitCode = ${code};
process.disconnect();
`,
    );

    /** Only explicit IPC stages should reach the parent's progress callback. */
    const stages = [];

    /** Pending runtime operation retains its log even if the child fails. */
    const operation = runSchemaRuntime({ modulePath, args: [], logPath, onProgress: (stage) => stages.push(stage) });

    if (code === 0) await operation;
    else
      await assert.rejects(
        operation,
        (error) => error.message.includes(logPath) && /exited with 7/.test(error.message),
      );

    assert.deepEqual(stages, ["Reading registered color schemas"]);
    assert.match(await readFile(logPath, "utf8"), /runtime stdout, including library exit messages\nruntime stderr/);
  });
}

/** Exact stable release identity shared by the capture fixtures. */
const resolution = {
  version: "1.2.3",
  inputs: [{ id: "vscode-stable", kind: "core", revision: "a".repeat(40) }],
};

/** Return a complete resolved schema bundle with one UI and semantic registration each. */
function schemas() {
  return {
    "color-theme": {
      properties: {
        colors: { $ref: "vscode://schemas/workbench-colors" },
        semanticTokenColors: { $ref: "vscode://schemas/token-styling" },
      },
    },
    "workbench-colors": { properties: { "editor.background": { description: "Editor canvas." } } },
    "token-styling": {
      properties: { variable: { description: "Variables." }, "*.readonly": { description: "Read-only." } },
    },
    "textmate-colors": { type: "array" },
  };
}

test("schema capture validates exact references and identifies type and modifier registrations", () => {
  /** Exact token registry maps parsed from the virtual schema bundle. */
  const records = schemaRecords(schemas());

  assert.equal(records.ui.get("editor.background").description, "Editor canvas.");
  assert.ok(records.types.has("variable"));
  assert.ok(records.modifiers.has("readonly"));
  assert.throws(() => schemaRecords({ ...schemas(), "workbench-colors": { properties: {} } }), /registry is empty/);
});

test("a versioned snapshot replays without runtime access and reports extraction gaps", async (t) => {
  /** Isolated project directory containing only captured documentation artifacts. */
  const root = await mkdtemp(join(tmpdir(), "cassidy-schema-"));

  t.after(() => rm(root, { recursive: true, force: true }));

  /** Fresh capture supplied without launching VS Code. */
  const prepared = await prepareColorSchema({ root, resolution, capture: async () => schemas() });

  assert.equal(prepared.path, "dev/docs/refreshes/vscode-1.2.3/color-theme.json");

  await mkdir(join(root, "dev/docs/refreshes/vscode-1.2.3"), { recursive: true });
  await writeFile(join(root, prepared.path), prepared.source);
  await mkdir(join(root, "dev/docs/refreshes/vscode-1.2.4"), { recursive: true });
  await writeFile(
    join(root, "dev/docs/refreshes/vscode-1.2.4/color-theme.json"),
    JSON.stringify({ ...prepared.snapshot, version: "1.2.4" }),
  );

  /** Offline replay must reuse checked-in bytes without a capture callback. */
  const replay = await prepareColorSchema({
    root,
    resolution,
    replay: true,
    capture: async () => {
      throw new Error("runtime started");
    },
  });

  assert.equal(replay.source, prepared.source);

  /** Empty static source maps leave all exact schema IDs visible in the report. */
  const extracted = [{ identity: resolution.inputs[0], ui: new Map(), types: new Map(), modifiers: new Map() }];
  const generated = {
    definitions: {
      ui: { records: new Map() },
      semantic: { records: new Map([["variable", { category: "standard" }]]) },
    },
  };
  const report = await colorSchemaReport({ root, resolution, schema: replay, extracted, generated });

  assert.match(report, /Missing from all source extraction[\s\S]*`editor\.background`/);
  assert.match(report, /Workbench colors[\s\S]*Added since prior snapshot\n\n- `editor\.background`/);
  assert.match(report, /Semantic modifiers[\s\S]*`readonly`/);
  assert.match(report, /Semantic types[\s\S]*Missing from generated inventory\n\nNone\./);
  assert.match(report, /Semantic modifiers[\s\S]*Missing from generated inventory\n\n- `readonly`/);
});

/**
 * Reproducible visual checks.
 * @file Run actual VS Code screenshots in the same pinned Linux container locally and in CI.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createTerminalProgress } from "../../tooling/shared/terminal-progress.js";

/** Explicit baseline changes are the only supported command option. */
const update = process.argv.slice(2);

if (update.length > 1 || (update.length && update[0] !== "--update"))
  throw new Error("Usage: npm run check:visual -- [--update]");

/** Fixed Linux/amd64 runtime and isolated persistent download/output directories. */
const image =
    "mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea",
  root = process.cwd(),
  cache = resolve(root, "dev/.cache/visual"),
  baselines = resolve(root, "dev/tests/visual/baselines");

for (const path of [cache, `${cache}/node_modules`, resolve(root, "node_modules"), baselines])
  mkdirSync(path, { recursive: true });

/** Container dependencies never share the host's native modules or VS Code profile. */
const args = [
  "run",
  "--rm",
  "--init",
  "--platform",
  "linux/amd64",
  "--ipc=host",
  "--user",
  `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  "--env",
  "HOME=/cache/home",
  "--env",
  "CI=1",
  "--workdir",
  "/workspace",
  "--mount",
  `type=bind,src=${root},dst=/workspace,readonly`,
  "--mount",
  `type=bind,src=${cache},dst=/cache`,
  "--mount",
  `type=bind,src=${cache}/node_modules,dst=/workspace/node_modules`,
  "--mount",
  `type=bind,src=${cache},dst=/workspace/dev/.cache/visual`,
];

if (update.length) args.push("--mount", `type=bind,src=${baselines},dst=/workspace/dev/tests/visual/baselines`);

args.push(
  image,
  "bash",
  "-c",
  "mkdir -p /cache/home && npm ci --ignore-scripts --no-audit --no-fund && xvfb-run -a node node_modules/@playwright/test/cli.js test" +
    (update.length ? " --update-snapshots" : ""),
);

/** Forward container output while showing the active task whenever Docker is quiet. */
const child = spawn("docker", args, { stdio: ["inherit", "pipe", "pipe"] });

/** Quiet-output timer and currently displayed task. */
let quietTimer, progress;

/** Start task feedback after a full second without child output. */
function expectOutput() {
  clearTimeout(quietTimer);
  quietTimer = setTimeout(() => {
    progress = createTerminalProgress("Running VS Code visual checks in Docker");
  }, 1000);
}

/**
 * Forward a child chunk and resume feedback if the next output is delayed.
 * @param {Buffer} chunk - Container output chunk.
 * @param {NodeJS.WriteStream} stream - Matching parent output stream.
 */
function forwardOutput(chunk, stream) {
  progress?.stop();
  progress = undefined;
  stream.write(chunk);
  expectOutput();
}

child.stdout.on("data", (chunk) => forwardOutput(chunk, process.stdout));
child.stderr.on("data", (chunk) => forwardOutput(chunk, process.stderr));
expectOutput();

child.on("error", (error) => {
  clearTimeout(quietTimer);
  progress?.stop();
  console.error(`Docker is required for visual checks: ${error.message}`);
  process.exitCode = 1;
});

child.on("close", (status) => {
  clearTimeout(quietTimer);
  progress?.stop();
  process.exitCode = status ?? 1;
});

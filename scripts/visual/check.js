/**
 * Reproducible visual checks.
 * @file Run actual VS Code screenshots in the same pinned Linux container locally and in CI.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** Explicit baseline changes are the only supported command option. */
const update = process.argv.slice(2);

if (update.length > 1 || (update.length && update[0] !== "--update"))
  throw new Error("Usage: npm run check:visual -- [--update]");

/** Fixed Linux/amd64 runtime and isolated persistent download/output directories. */
const image =
    "mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea",
  root = process.cwd(),
  cache = resolve(root, ".cache/visual"),
  baselines = resolve(root, "tests/visual/baselines");

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
  `type=bind,src=${cache},dst=/workspace/.cache/visual`,
];

if (update.length) args.push("--mount", `type=bind,src=${baselines},dst=/workspace/tests/visual/baselines`);

args.push(
  image,
  "bash",
  "-c",
  "mkdir -p /cache/home && npm ci --ignore-scripts --no-audit --no-fund && xvfb-run -a node node_modules/@playwright/test/cli.js test" +
    (update.length ? " --update-snapshots" : ""),
);

/** Forward test output and preserve failure status. */
const result = spawnSync("docker", args, { stdio: "inherit" });

if (result.error) console.error(`Docker is required for visual checks: ${result.error.message}`);

process.exitCode = result.status ?? 1;

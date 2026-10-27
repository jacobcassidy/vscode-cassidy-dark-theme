/**
 * Immutable upstream test projects.
 * @file Create local Git/content-addressed extraction fixtures with no network or user extension access.
 */

import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

/** Literal Git subprocess runner, restricted to temporary test projects. */
const run = promisify(execFile);

/**
 * Create a local source input, optionally verified against an actual immutable Git commit.
 * @param t - Test cleanup context.
 * @param [options] - Fixture identity options.
 * @param [options.kind] - core or extension.
 * @param [options.git] - Whether to create Git history.
 */
export async function createUpstream(t, { kind = "core", git = kind === "core" } = {}) {
  /** Unique temporary source root with deterministic checked-in fixture contents. */
  const directory = await mkdtemp(join(tmpdir(), "cassidy-upstream-"));

  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL(`../fixtures/upstream/${kind}/`, import.meta.url), directory, { recursive: true });

  if (kind === "core") await writeFile(join(directory, "package.json"), '{"name":"vscode-fixture"}');
  if (!git) return { directory };

  await run("git", ["init", "--quiet"], { cwd: directory });
  await run("git", ["add", "."], { cwd: directory });
  await run(
    "git",
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Record source fixture",
    ],
    { cwd: directory },
  );

  /** Full commit identity is independently obtained from Git. */
  const revision = (await run("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();

  return { directory, revision };
}

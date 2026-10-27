/**
 * Immutable extraction sources.
 * @file Resolve latest releases, bound retrieval, verify source contents, and publish revision caches independently of repository application.
 */

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { readFile, readdir, lstat, mkdir, writeFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fields, parseJsonc } from "../../shared/jsonc.js";
import { assertFresh, capturePaths, withGuards } from "../../shared/transactions.js";

/** Promisified Git process runner, never used to execute upstream application code. */
const execute = promisify(execFile);

/**
 * Validate the explicit extraction policy while retaining successful replay history.
 * @param config - Parsed source configuration.
 */
export function validateSourceConfig(config) {
  fields(
    config,
    ["policy", "repository", "supplementalMain", "retrieval", "coverageExceptions", "lastSuccessful"],
    "upstream-sources.jsonc",
  );

  if (
    config.policy !== "latest-stable" ||
    config.repository !== "microsoft/vscode" ||
    typeof config.supplementalMain !== "boolean"
  )
    throw new Error("Source policy must follow latest-stable microsoft/vscode with explicit supplementalMain");

  fields(config.retrieval, ["requestMs", "attempts", "totalMs"], "retrieval");

  for (const key of ["requestMs", "attempts", "totalMs"]) {
    if (!Number.isFinite(config.retrieval[key]) || config.retrieval[key] <= 0)
      throw new Error(`retrieval.${key} must be finite and positive`);
  }

  if (!Number.isInteger(config.retrieval.attempts)) throw new Error("retrieval.attempts must be an integer");
  if (!Array.isArray(config.coverageExceptions)) throw new Error("coverageExceptions must be an array");

  if (config.lastSuccessful !== undefined) {
    fields(config.lastSuccessful, ["resolution", "coverage", "acceptedCoverage"], "lastSuccessful");
    fields(config.lastSuccessful.resolution, ["version", "tag", "inputs"], "lastSuccessful.resolution");

    /** Recorded release metadata never substitutes an ambiguous branch/tag for immutable source identities. */
    const resolution = config.lastSuccessful.resolution;

    if (
      !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(resolution.version) ||
      resolution.tag?.replace(/^v/, "") !== resolution.version
    )
      throw new Error("Malformed recorded stable release version/tag");
    if (!Array.isArray(resolution.inputs) || !resolution.inputs.length || resolution.inputs[0].id !== "vscode-stable")
      throw new Error("Recorded source inputs must begin with vscode-stable");

    /** Input IDs must remain unique and immutable across replay. */
    const ids = new Set();

    for (const identity of resolution.inputs) {
      fields(identity, ["id", "kind", "revision", "contributor"], "recorded input");

      if (
        typeof identity.id !== "string" ||
        !identity.id.trim() ||
        ids.has(identity.id) ||
        !["core", "extension"].includes(identity.kind) ||
        !(identity.kind === "core" ? /^[a-f0-9]{40}$/ : /^(?:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/).test(
          identity.revision,
        )
      )
        throw new Error(`Malformed recorded immutable source identity: ${identity.id}`);
      if (identity.kind === "extension" && (typeof identity.contributor !== "string" || !identity.contributor.trim()))
        throw new Error(`Recorded extension contributor is missing: ${identity.id}`);

      ids.add(identity.id);
    }

    if (!Array.isArray(config.lastSuccessful.coverage) || !Array.isArray(config.lastSuccessful.acceptedCoverage))
      throw new Error("Recorded coverage and acceptance evidence must be arrays");
    if (config.lastSuccessful.coverage.length !== resolution.inputs.length)
      throw new Error("Recorded coverage does not cover every source input");

    for (const coverage of config.lastSuccessful.coverage) {
      fields(coverage, ["identity", "ui", "types", "modifiers", "scopes"], "recorded coverage");

      if (
        !resolution.inputs.some(
          (identity) => identity.id === coverage.identity?.id && identity.revision === coverage.identity.revision,
        )
      )
        throw new Error("Coverage identity differs from successful resolution");

      for (const family of ["ui", "types", "modifiers", "scopes"]) {
        if (
          !Array.isArray(coverage[family]) ||
          coverage[family].some((id) => typeof id !== "string" || !id.trim()) ||
          new Set(coverage[family]).size !== coverage[family].length
        )
          throw new Error(`Malformed recorded ${family} coverage`);
      }
    }
  }

  return config;
}

/**
 * Parse a finite server retry delay without accepting malformed or negative values.
 * @param value - Retry-After header.
 * @param now - Current epoch milliseconds.
 */
export function retryDelay(value, now) {
  if (!value) return undefined;

  /** Seconds or HTTP date, normalized to nonnegative milliseconds. */
  const result = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;

  return Number.isFinite(result) && result >= 0 ? result : undefined;
}

/**
 * Create one finite retrieval context, shared by metadata, Git downloads, and cache waits.
 * @param options - Injectable retrieval operations and policy.
 * @param options.policy - Positive requestMs, integer attempts, and totalMs budgets.
 * @param [options.signal] - Invocation cancellation signal.
 * @param [options.fetch] - HTTP transport.
 * @param [options.now] - Clock in milliseconds.
 * @param [options.wait] - Cancellable backoff operation.
 * @param [options.random] - Jitter source.
 */
export function createRetrieval({
  policy,
  signal,
  fetch = globalThis.fetch,
  now = Date.now,
  wait = delay,
  random = Math.random,
}) {
  validateSourceConfig({
    policy: "latest-stable",
    repository: "microsoft/vscode",
    supplementalMain: true,
    retrieval: policy,
    coverageExceptions: [],
  });

  /** Shared start time prevents each request from resetting the invocation budget. */
  const started = now();

  /** Remaining total budget, checked before requests, waits, and Git subprocesses. */
  function remaining() {
    signal?.throwIfAborted();

    /** Remaining invocation milliseconds. */
    const available = policy.totalMs - (now() - started);

    if (available <= 0) throw new Error("Retrieval total budget exhausted");

    return available;
  }

  /**
   * Fetch JSON through bounded transient retries; invalid metadata is never retried.
   * @param url - Exact GitHub API URL.
   */
  async function request(url) {
    for (let attempt = 1; attempt <= policy.attempts; attempt++) {
      /** Attempt deadline is also bounded by the invocation deadline. */
      const timeout = AbortSignal.timeout(Math.max(1, Math.floor(Math.min(policy.requestMs, remaining()))));

      try {
        /** HTTP response tied to both invocation and attempt cancellation. */
        const response = await fetch(url, {
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          headers: { Accept: "application/vnd.github+json", "User-Agent": "cassidy-token-details" },
        });

        if (!response.ok) {
          /** Retry only explicitly transient transport/status/rate-limit failures. */
          const transient =
            [408, 429].includes(response.status) ||
            response.status >= 500 ||
            (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");

          throw Object.assign(new Error(`HTTP ${response.status} retrieving ${url}`), {
            fatal: !transient,
            retryAfter: retryDelay(response.headers.get("retry-after"), now()),
          });
        }

        /** Response body must fit inside the same request budget. */
        const text = await response.text();

        remaining();

        try {
          return JSON.parse(text);
        } catch (error) {
          throw Object.assign(new Error(`Invalid release/source metadata from ${url}`, { cause: error }), {
            fatal: true,
          });
        }
      } catch (error) {
        signal?.throwIfAborted();
        remaining();

        if (error.fatal || attempt === policy.attempts)
          throw new Error(`Retrieval failed after ${attempt} attempt(s) for ${url}: ${error.message}`, {
            cause: error,
          });

        /** Capped exponential delay plus bounded jitter, honoring a valid server delay. */
        const backoff = error.retryAfter ?? Math.min(1000 * 2 ** (attempt - 1), 5000) + Math.floor(random() * 100);

        if (backoff >= remaining())
          throw new Error(`Retrieval retry delay exceeds remaining total budget for ${url}`, { cause: error });

        await wait(backoff, undefined, { signal });
      }
    }
  }

  /**
   * Run Git with a finite process deadline and propagated invocation cancellation.
   * @param args - Literal Git arguments.
   * @param cwd - Source/cache working directory.
   */
  async function git(args, cwd) {
    /** Git process deadline never exceeds the remaining invocation budget. */
    const result = await execute("git", args, {
      cwd,
      signal,
      timeout: Math.min(policy.requestMs, remaining()),
      maxBuffer: 64 * 1024 * 1024,
    });

    remaining();

    return result.stdout;
  }

  /**
   * Wait briefly for cache publication while retaining the invocation budget/cancellation.
   * @param ms - Requested bounded wait.
   */
  async function pause(ms) {
    if (ms >= remaining()) throw new Error("Cache publication wait exceeds retrieval total budget");

    await wait(ms, undefined, { signal });
  }

  return { request, git, remaining, signal, pause };
}

/**
 * Resolve a stable release tag (including annotated tags) and current supplemental main exactly once.
 * @param config - Validated tracking policy.
 * @param retrieval - Bounded request context.
 */
export async function resolveLatest(config, retrieval) {
  /** Official repository API base. */
  const base = `https://api.github.com/repos/${config.repository}`;
  const release = await retrieval.request(`${base}/releases/latest`);

  if (
    release.draft ||
    release.prerelease ||
    typeof release.tag_name !== "string" ||
    !/^v?\d+\.\d+\.\d+$/.test(release.tag_name)
  )
    throw new Error("Latest release metadata does not identify a published stable VS Code release");

  /** Tag object may point at an annotated tag rather than a commit. */
  let object = (await retrieval.request(`${base}/git/ref/tags/${encodeURIComponent(release.tag_name)}`)).object;

  for (let depth = 0; object?.type === "tag" && depth < 8; depth++)
    object = (await retrieval.request(`${base}/git/tags/${object.sha}`)).object;

  if (object?.type !== "commit" || !/^[a-f0-9]{40}$/.test(object.sha))
    throw new Error("Stable release tag did not resolve to a full commit");

  /** Stable-first source order is preserved throughout extraction. */
  const inputs = [{ id: "vscode-stable", kind: "core", revision: object.sha }];

  if (config.supplementalMain) {
    /** Current main revision is pinned for the entire invocation. */
    const main = (await retrieval.request(`${base}/git/ref/heads/main`)).object;

    if (main?.type !== "commit" || !/^[a-f0-9]{40}$/.test(main.sha))
      throw new Error("Main did not resolve to a full commit");

    inputs.push({ id: "vscode-main", kind: "core", revision: main.sha });
  }

  return { version: release.tag_name.replace(/^v/, ""), tag: release.tag_name, inputs };
}

/**
 * Select all extraction dependencies, including manifests/localization/grammars and static imports.
 * @param path - Source-relative filename.
 * @param kind - core or extension.
 */
function relevant(path, kind) {
  if (
    path
      .split("/")
      .some((segment) => [".git", "node_modules", "test", "tests", "fixtures", "out", "dist"].includes(segment))
  )
    return false;

  return (
    /\.(?:ts|tsx|js|json|jsonc|tmLanguage|plist)$/.test(path) &&
    (kind !== "core" || /^(?:src\/|extensions\/|package(?:\.nls[^/]*)?\.json$)/.test(path))
  );
}

/**
 * Freeze every relevant file without following links or executing source code.
 * @param directory - Verified input root.
 * @param kind - core or extension.
 */
async function sourceFiles(directory, kind) {
  /** Frozen bytes indexed by deterministic source-relative filenames. */
  const files = new Map();

  /**
   * Walk only relevant source roots and reject relevant links/special entries.
   * @param relative - Current source-relative directory.
   */
  async function visit(relative) {
    for (const entry of await readdir(join(directory, relative), { withFileTypes: true })) {
      /** Normalized source path; entry types are not followed implicitly. */
      const path = relative ? `${relative}/${entry.name}` : entry.name;

      if ([".git", "node_modules", "test", "tests", "fixtures", "out", "dist"].includes(entry.name)) continue;
      if (entry.isDirectory()) {
        if (kind !== "core" || relative || ["src", "extensions"].includes(entry.name)) await visit(path);
      } else if (relevant(path, kind)) {
        if (!entry.isFile()) throw new Error(`Relevant source must be a regular file: ${path}`);

        files.set(path, await readFile(join(directory, path)));
      }
    }
  }

  await visit("");

  return new Map([...files].sort(([left], [right]) => left.localeCompare(right, "en")));
}

/**
 * Hash a deterministic content manifest, excluding timestamps and absolute paths.
 * @param files - Sorted dependency path/byte map.
 */
function contentRevision(files) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify([...files].map(([path, bytes]) => [path, createHash("sha256").update(bytes).digest("hex")])))
    .digest("hex")}`;
}

/**
 * Verify Git blobs or contributor-addressed contents and retain immutable frozen extraction inputs.
 * @param directory - Supplied checkout/cache directory.
 * @param identity - Expected id/kind/revision and optional contributor.
 * @param retrieval - Bounded context for local Git commands.
 */
export async function verifySource(directory, identity, retrieval) {
  /** Relevant source dependencies frozen before extraction. */
  const files = await sourceFiles(directory, identity.kind);
  const digest = contentRevision(files);

  /** Existing repository marker distinguishes dirty Git inputs from content-addressed contributors. */
  const git = await lstat(join(directory, ".git")).catch((error) => {
    if (error.code === "ENOENT") return undefined;

    throw error;
  });

  /** Immutable recorded revision, verified against actual bytes rather than HEAD alone. */
  let revision = identity.revision;

  if (git) {
    /** Requested revision must exist; HEAD equality alone never proves input integrity. */
    const commit = (await retrieval.git(["rev-parse", `${revision ?? "HEAD"}^{commit}`], directory)).trim();
    const tracked = await retrieval.git(["ls-tree", "-rz", "--full-tree", commit], directory);
    const expected = new Map(
      tracked
        .split("\0")
        .filter(Boolean)
        .map((record) => {
          /** Git tree row separates mode/type/blob from an exact filename. */ const [metadata, path] =
            record.split("\t");
          return [path, metadata.split(" ")];
        })
        .filter(([path]) => relevant(path, identity.kind)),
    );

    if (expected.size !== files.size)
      throw new Error(`Relevant Git source inventory differs from ${commit}: ${identity.id}`);

    for (const [path, bytes] of files) {
      /** Git blob IDs cover both content bytes and object length. */
      const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

      if (expected.get(path)?.[0] !== "100644" && expected.get(path)?.[0] !== "100755")
        throw new Error(`Relevant Git entry type differs: ${path}`);
      if (expected.get(path)?.[2] !== blob)
        throw new Error(`Relevant Git source content differs from ${commit}: ${path}`);
    }

    if (revision && revision !== commit)
      throw new Error(`Source revision mismatch for ${identity.id}: expected ${revision}, got ${commit}`);

    revision = commit;
  } else {
    if (identity.kind === "core") throw new Error(`Core source requires verified Git history: ${directory}`);
    if (revision && revision !== digest) throw new Error(`Content manifest mismatch for ${identity.id}`);

    revision = digest;
  }

  /** Contributor identity comes from its manifest, never the token namespace. */
  let contributor;

  if (identity.kind === "extension") {
    /** Root extension manifest is part of the immutable content manifest. */
    const manifest = parseJsonc(files.get("package.json")?.toString() ?? "", `${directory}/package.json`).value;

    if (
      typeof manifest.publisher !== "string" ||
      typeof manifest.name !== "string" ||
      !manifest.publisher.trim() ||
      !manifest.name.trim()
    )
      throw new Error(`Extension source requires verified publisher/name: ${directory}`);

    contributor = `${manifest.publisher}.${manifest.name}`;

    if (identity.contributor && contributor !== identity.contributor)
      throw new Error(`Contributor identity mismatch: ${identity.id}`);
  }

  return { directory, files, identity: { ...identity, revision, ...(contributor ? { contributor } : {}) }, digest };
}

/**
 * Reverify frozen contents immediately before repository publication.
 * @param source - Verified frozen extraction input.
 */
export async function assertSourceFresh(source) {
  if (contentRevision(await sourceFiles(source.directory, source.identity.kind)) !== source.digest)
    throw new Error(`Extraction input changed after verification: ${source.identity.id}`);
}

/**
 * Retrieve an exact core revision through owned staging and short cache publication guards.
 * @param options - Cache/source retrieval options.
 * @param options.root - Checkout root.
 * @param options.identity - Exact core source identity.
 * @param options.retrieval - Bounded invocation context.
 * @param [options.supplied] - Matching user-supplied checkout.
 * @param [options.replay] - Read-only/offline source use; never repair or publish cache entries.
 * @param [options.populate] - Injectable staging population for deterministic cache tests.
 */
export async function obtainSource({ root, identity, retrieval, supplied, replay = false, populate }) {
  if (supplied) return verifySource(supplied, identity, retrieval);

  /** Exact-revision cache directory and its completed-entry proof. */
  const destination = join(root, ".cache/token-details", identity.revision);

  /**
   * Verify a completed cache entry without trusting directory presence.
   * @param directory - Published or staging directory.
   */
  async function completed(directory) {
    /** Completion metadata itself never substitutes for verifying relevant Git blobs. */
    const record = JSON.parse(await readFile(join(directory, ".complete.json"), "utf8"));
    const source = await verifySource(directory, identity, retrieval);

    if (record.revision !== identity.revision || record.digest !== source.digest)
      throw new Error(`Corrupt cache completion proof: ${directory}`);

    return source;
  }

  try {
    return await completed(destination);
  } catch (error) {
    if (replay)
      throw new Error(
        `Missing or corrupt recorded source ${identity.id}@${identity.revision}; run an online update or supply a matching checkout.`,
        { cause: error },
      );
  }

  /** Unique staging is private to this publisher until fully verified. */
  const staging = `${destination}.staging-${randomUUID()}`;

  await mkdir(staging, { recursive: true });

  try {
    if (populate) await populate(staging);
    else {
      await retrieval.git(["init", "--quiet"], staging);
      await retrieval.git(["remote", "add", "origin", "https://github.com/microsoft/vscode.git"], staging);
      await retrieval.git(["fetch", "--quiet", "--depth=1", "origin", identity.revision], staging);
      await retrieval.git(["checkout", "--quiet", "--detach", "FETCH_HEAD"], staging);
    }

    /** Verified completion record is written only inside owned staging. */
    const source = await verifySource(staging, identity, retrieval);

    await writeFile(
      join(staging, ".complete.json"),
      JSON.stringify({ revision: identity.revision, digest: source.digest }),
    );
    retrieval.remaining();

    while (true) {
      retrieval.remaining();

      try {
        return await withGuards([destination], async () => {
          try {
            return await completed(destination);
          } catch {
            /** Destination fingerprint is checked under the short publication guard. */
            const expected = await capturePaths([destination]);

            await assertFresh(expected);
            retrieval.remaining();
            await mkdir(dirname(destination), { recursive: true });
            await rm(destination, { recursive: true, force: true });
            await rename(staging, destination);

            return completed(destination);
          }
        });
      } catch (error) {
        if (error.code !== "WRITER_BUSY") throw error;

        await retrieval.pause(50);
      }
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

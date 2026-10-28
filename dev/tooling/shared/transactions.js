/**
 * Coordinated filesystem application.
 * @file Guard canonical resources, reject stale inputs, roll back controlled failures, and detect interrupted generations.
 */

import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, readlink, readdir, realpath, mkdir, writeFile, rename, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Inspect an entry without following links, preserving bytes and absence for recovery verification.
 * @param path - Absolute entry path.
 * @returns Immutable JSON-compatible entry representation.
 */
export async function fingerprint(path) {
  try {
    /** Entry type inspected before reading any contents. */
    const info = await lstat(path);

    if (info.isSymbolicLink()) return { type: "link", target: await readlink(path) };

    if (info.isFile())
      return {
        type: "file",
        hash: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      };

    if (!info.isDirectory()) throw new Error(`Unsupported filesystem entry: ${path}`);

    /** Sorted immediate entries, including nested entry types. */
    const children = {};

    for (const name of (await readdir(path)).sort()) children[name] = await fingerprint(join(path, name));

    return { type: "directory", children };
  } catch (error) {
    if (error.code === "ENOENT") return { type: "absent" };
    throw error;
  }
}

/**
 * Compare serializable fingerprints.
 * @param left - First fingerprint.
 * @param right - Second fingerprint.
 */
function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Canonicalize a resource even when its final directories have not been created.
 * @param path - Resource root or destination.
 */
async function canonicalPath(path) {
  try {
    return await realpath(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return join(await canonicalPath(dirname(resolve(path))), resolve(path).split(/[\\/]/).at(-1));
  }
}

/**
 * Locate temporary coordination state without creating it.
 * @param resource - Canonicalized resource path.
 */
async function statePath(resource) {
  return join(
    tmpdir(),
    "cassidy-theme-writers",
    createHash("sha256")
      .update(await canonicalPath(resource))
      .digest("hex"),
  );
}

/**
 * Read optional coordination JSON, failing closed on malformed metadata.
 * @param path - Metadata filename.
 */
async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw new Error(`Invalid writer state ${path}: ${error.message}`, { cause: error });
  }
}

/**
 * Test local process liveness; permission errors count as active owners.
 * @param pid - Recorded process identifier.
 */
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("Malformed writer owner PID");

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

/**
 * Read an atomically published guard owner without accepting partial or ambiguous metadata.
 * @param guard - Resource guard directory.
 */
async function readGuardOwner(guard) {
  try {
    /** Every published guard contains one immutable, uniquely named owner record. */
    const files = await readdir(guard);

    if (!files.length) return undefined;

    if (files.length !== 1 || !/^owner-[a-f0-9-]+\.json$/.test(files[0]))
      throw new Error(`Malformed guard ownership: ${guard}`);

    /** A concurrent completed release may remove the observed owner before this read. */
    const owner = await readState(join(guard, files[0]));

    if (!owner) return undefined;

    if (`owner-${owner.token}.json` !== files[0]) throw new Error(`Mismatched guard ownership token: ${guard}`);

    return { ...owner, filename: files[0] };
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Read existing writer/generation state without locks, repair, or state creation.
 * @param resource - Checkout root or shared preview destination.
 */
export async function observeWriter(resource) {
  /** External coordination directory, keyed by the canonical resource. */
  const directory = await statePath(resource);

  /** Guard owner, interrupted operation, and completed generation. */
  const [owner, marker, generation] = await Promise.all([
    readGuardOwner(join(directory, "guard")),
    readState(join(directory, "incomplete.json")),
    readState(join(directory, "generation.json")),
  ]);
  return { owner, marker, generation, busy: owner ? alive(owner.pid) : false };
}

/**
 * Refuse consumers of an active or interrupted application.
 * @param resource - Checkout root.
 * @returns Stable completed-generation identity.
 */
export async function requireStable(resource) {
  /** Observed state never mutates abandoned guard or marker metadata. */
  const state = await observeWriter(resource);

  if (state.marker) {
    throw Object.assign(
      new Error(
        `Incomplete generation ${state.marker.id}: ${Object.keys(state.marker.before ?? {}).join(", ")}. Restore the complete affected set, then run ${state.marker.recovery ?? "the owning command with --recover=verify-restored"}.`,
      ),
      { code: "INCOMPLETE_GENERATION" },
    );
  }

  if (state.busy)
    throw Object.assign(new Error("Writer busy; retry after the current writer finishes."), { code: "WRITER_BUSY" });

  return state.generation;
}

/**
 * Acquire short, consistently ordered resource guards and release only owned state.
 * @param resources - Canonical checkout/destination resources.
 * @param operation - Guarded asynchronous operation receiving ownership.
 */
export async function withGuards(resources, operation) {
  /** Owned guards are released in reverse canonical resource order. */
  const owned = [];

  /** Operation outcome is retained so release failures never hide an application error. */
  let result, operationError;

  try {
    for (const resource of [...new Set(await Promise.all(resources.map(canonicalPath)))].sort()) {
      /** Resource-specific metadata remains outside the checkout and source caches. */
      const directory = await statePath(resource),
        token = randomUUID();

      /** Atomic public guard directory and this process's unique immutable owner filename. */
      const guard = join(directory, "guard"),
        filename = `owner-${token}.json`;

      /** Private populated reservation, never mistaken for an active application. */
      const staging = join(directory, `.guard-${token}`);

      await mkdir(staging, { recursive: true });

      try {
        // Publishing a populated directory eliminates an ownerless guard acquisition window.
        await writeFile(join(staging, filename), JSON.stringify({ pid: process.pid, token }), { flag: "wx" });

        try {
          await rename(staging, guard);
        } catch (error) {
          if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error;

          /** Only a demonstrably dead immutable owner can be removed. */
          const previous = await readGuardOwner(guard);

          if (!previous || alive(previous.pid))
            throw Object.assign(new Error(`Writer busy for ${resource}; retry after the current writer finishes.`), {
              code: "WRITER_BUSY",
            });

          // Remove only that unique owner's record; a competing reaper cannot unlink a new owner's record.
          await rm(join(guard, previous.filename), { force: true });

          try {
            await rmdir(guard);
          } catch (failure) {
            if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(failure.code)) throw failure;
          }

          try {
            await rename(staging, guard);
          } catch (failure) {
            throw Object.assign(
              new Error(`Writer busy for ${resource}; another writer acquired the released guard.`, { cause: failure }),
              { code: "WRITER_BUSY" },
            );
          }
        }

        owned.push({ directory, guard, token, filename });
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    }

    result = await operation(owned);
  } catch (error) {
    operationError = error;
  }

  /** Release every owned resource, reporting cleanup failures alongside the original outcome. */
  const releaseErrors = [];

  for (const owner of owned.reverse()) {
    try {
      if ((await readGuardOwner(owner.guard))?.token !== owner.token) continue;

      await rm(join(owner.guard, owner.filename), { force: true });

      try {
        await rmdir(owner.guard);
      } catch (error) {
        if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code))
          releaseErrors.push(`${owner.guard}: ${error.message}`);
      }
    } catch (error) {
      releaseErrors.push(`${owner.guard}: ${error.message}`);
    }
  }

  if (releaseErrors.length)
    throw Object.assign(
      new Error(
        `${operationError ? `${operationError.message}; ` : ""}guard release failed: ${releaseErrors.join("; ")}`,
        { cause: operationError },
      ),
      { code: operationError?.code ?? "WRITER_BUSY" },
    );

  if (operationError) throw operationError;

  return result;
}

/**
 * Capture explicit dependency paths; absent paths detect newly created fallback overrides.
 * @param paths - Absolute dependency paths.
 */
export async function capturePaths(paths) {
  /** Dependency fingerprints indexed by absolute path. */
  const result = {};
  for (const path of paths) result[path] = await fingerprint(path);
  return result;
}

/**
 * Recheck all prepared dependencies and destinations before applying any changes.
 * @param expected - Fingerprints captured during preparation.
 */
export async function assertFresh(expected) {
  for (const [path, value] of Object.entries(expected)) {
    if (!same(await fingerprint(path), value))
      throw Object.assign(new Error(`Stale prepared input or destination: ${path}. Retry the command.`), {
        code: "STALE_INPUT",
      });
  }
}

/**
 * Reject symlinks and special entries along a destination path beneath its root.
 * @param root - Canonical checkout root.
 * @param path - Root-relative destination path.
 */
export async function validateDestination(root, path) {
  if (path.startsWith("/") || path.split(/[\\/]/).includes("..")) throw new Error(`Unsafe artifact path: ${path}`);

  /** Current entry checked from the root through the destination. */
  let current = root;

  for (const segment of path.split("/")) {
    current = join(current, segment);

    /** Entry metadata, including dangling links, without recursively reading ancestor directories. */
    const entry = await lstat(current).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (entry?.isSymbolicLink()) throw new Error(`Artifact path must not be a symlink: ${current}`);
  }
}

/**
 * Write a complete sibling file and replace its destination atomically.
 * @param path - Destination filename.
 * @param bytes - Complete replacement contents.
 */
async function replaceFile(path, bytes) {
  await mkdir(dirname(path), { recursive: true });

  /** Unique owned sibling, never used as a discovery input. */
  const staging = join(dirname(path), `.theme-build-${randomUUID()}`);

  try {
    await writeFile(staging, bytes, { flag: "wx" });
    await rename(staging, path);
  } finally {
    await rm(staging, { force: true });
  }
}

/**
 * Back up a validated regular file/directory for controlled in-process rollback only.
 * @param path - Absolute destination.
 */
async function backup(path) {
  /** Snapshot entry type. */
  const entry = await fingerprint(path);
  if (entry.type === "link") throw new Error(`Artifact path must not be a symlink: ${path}`);
  if (entry.type === "file") return { type: "file", bytes: await readFile(path) };
  if (entry.type === "absent") return entry;

  /** Nested directory backup, preserving every owned file. */
  const children = {};
  for (const name of Object.keys(entry.children)) children[name] = await backup(join(path, name));
  return { type: "directory", children };
}

/**
 * Restore a saved entry after checking transaction ownership.
 * @param path - Absolute destination.
 * @param entry - In-memory pre-application entry.
 */
async function restore(path, entry) {
  if (entry.type === "absent") return rm(path, { recursive: true, force: true });
  if (entry.type === "file") return replaceFile(path, entry.bytes);
  await mkdir(path, { recursive: true });
  for (const [name, child] of Object.entries(entry.children)) await restore(join(path, name), child);
}

/**
 * Apply a complete artifact map under caller-owned guards with optimistic rollback.
 * @param options - Prepared application and narrow filesystem failure injection.
 * @param options.root - Checkout root.
 * @param options.output - Relative destinations mapped to text or null removals.
 * @param options.expected - All dependency and destination fingerprints.
 * @param options.owner - Checkout guard ownership.
 * @param [options.recovery] - Explicit restored-set verification command.
 * @param [options.operations] - Replacement/removal overrides used by failure tests.
 * @param [options.allowRecovery] - Exact interrupted-marker identity accepted by fresh explicit recovery.
 * @param [options.signal] - Orderly invocation cancellation signal.
 * @param [options.operation] - Owning workflow used for exact restoration instructions.
 */
export async function applyArtifacts({
  root,
  output,
  expected,
  owner,
  recovery = "npm run build -- --recover=verify-restored",
  operations = {},
  allowRecovery,
  signal,
  operation = "build",
}) {
  root = await canonicalPath(root);

  /** Current interrupted operation must never be silently certified by another writer. */
  const previous = await readState(join(owner.directory, "incomplete.json"));

  if (previous && previous.id !== allowRecovery)
    throw Object.assign(new Error(`Incomplete generation ${previous.id}; run ${previous.recovery}.`), {
      code: "INCOMPLETE_GENERATION",
    });

  await assertFresh(expected);

  /** Validated changed entries and in-memory rollback backups. */
  const changed = [],
    saved = new Map(),
    before = {};

  /** Missing parent directories are part of a new artifact generation, including theme reservations. */
  const createdDirectories = new Set();

  for (const [path, text] of output) {
    await validateDestination(root, path);

    /** Current destination type/bytes must agree with the complete prepared candidate. */
    const entry = await fingerprint(join(root, path));

    before[join(root, path)] = entry;

    if (
      text === null
        ? entry.type === "absent"
        : entry.type === "file" && (await readFile(join(root, path), "utf8")) === text
    )
      continue;

    if (text !== null) {
      /** Parent traversal stops at the existing checkout root and records only absent entries. */
      let parent = dirname(join(root, path));

      while (parent !== root && parent.startsWith(`${root}/`)) {
        /** Missing parents must also be absent after a complete rollback/restoration verification. */
        const parentEntry = await fingerprint(parent);

        if (parentEntry.type === "absent") {
          createdDirectories.add(parent);
          before[parent] = parentEntry;
        }

        parent = dirname(parent);
      }
    }

    changed.push(path);
    saved.set(path, await backup(join(root, path)));
  }

  if (!changed.length && !previous) return [];

  /** Persistent detection marker has verification metadata, never crash-replay backups. */
  const marker = { id: randomUUID(), pid: process.pid, before, recovery, operation };

  await replaceFile(join(owner.directory, "incomplete.json"), JSON.stringify(marker));

  /** Expected post-write fingerprints for ownership-aware rollback. */
  const applied = new Map();

  try {
    for (const path of changed) {
      signal?.throwIfAborted();
      await assertFresh({ [join(root, path)]: before[join(root, path)] });

      /** Intended generation, computed from candidate bytes rather than a potentially newer editor save. */
      const intended =
        output.get(path) === null
          ? { type: "absent" }
          : { type: "file", hash: createHash("sha256").update(output.get(path)).digest("hex") };

      applied.set(path, intended);

      if (output.get(path) === null) await (operations.remove ?? rm)(join(root, path), { recursive: true });
      else await (operations.replace ?? replaceFile)(join(root, path), output.get(path));

      await assertFresh({ [join(root, path)]: intended });
    }

    signal?.throwIfAborted();
    await replaceFile(join(owner.directory, "generation.json"), JSON.stringify(marker.id));
    await rm(join(owner.directory, "incomplete.json"));

    return changed;
  } catch (error) {
    /** Restoration failures are reported alongside the original application error. */
    const failures = [];

    for (const [path, expectedEntry] of [...applied].reverse()) {
      try {
        if (same(await fingerprint(join(root, path)), before[join(root, path)])) continue;

        if (!same(await fingerprint(join(root, path)), expectedEntry))
          throw new Error(`newer edit preserved: ${path}`, { cause: error });

        await (operations.restore ?? restore)(join(root, path), saved.get(path));
      } catch (failure) {
        failures.push(`${path}: ${failure.message}`);
      }
    }

    for (const directory of [...createdDirectories].sort((left, right) => right.length - left.length)) {
      try {
        await rmdir(directory);
      } catch (failure) {
        if (failure.code !== "ENOENT")
          failures.push(`${directory}: directory restoration failed; newer contents preserved: ${failure.message}`);
      }
    }

    if (!failures.length && !previous) await rm(join(owner.directory, "incomplete.json"));
    else if (previous) await replaceFile(join(owner.directory, "incomplete.json"), JSON.stringify(previous));

    throw Object.assign(
      new Error(
        `${error.message}${failures.length ? `; rollback incomplete: ${failures.join("; ")}` : "; prior artifacts restored"}`,
        { cause: error },
      ),
      { code: failures.length || previous ? "INCOMPLETE_GENERATION" : error.code },
    );
  }
}

/**
 * Verify the complete pre-application set under the normal guard, then clear only that marker.
 * @param resource - Owning checkout root.
 * @param validate - Local read-only contract validation, receiving marker and guard ownership.
 * @param [operation] - Required owning workflow identity.
 */
export async function verifyRestored(resource, validate, operation) {
  return withGuards([resource], async ([owner]) => {
    /** Retained marker must include the complete verification set. */
    const marker = await readState(join(owner.directory, "incomplete.json"));

    if (!marker || !marker.id || !Object.keys(marker.before ?? {}).length)
      throw new Error("No complete interrupted-generation verification metadata is available.");

    if (operation && marker.operation !== operation)
      throw new Error(
        `Interrupted generation belongs to ${marker.operation ?? "an unknown workflow"}; use its owning recovery command`,
      );

    await assertFresh(marker.before);
    await validate(marker, owner);
    await assertFresh(marker.before);
    await rm(join(owner.directory, "incomplete.json"));
  });
}

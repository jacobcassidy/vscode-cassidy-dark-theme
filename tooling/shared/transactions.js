/**
 * Coordinated filesystem application.
 * @file Guard canonical resources, reject stale inputs, roll back controlled failures, and detect interrupted generations.
 */

import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, readlink, readdir, realpath, mkdir, writeFile, rename, rm } from "node:fs/promises";
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
export async function canonicalPath(path) {
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
 * Read existing writer/generation state without locks, repair, or state creation.
 * @param resource - Checkout root or shared preview destination.
 */
export async function observeWriter(resource) {
  /** External coordination directory, keyed by the canonical resource. */
  const directory = await statePath(resource);

  /** Guard owner, interrupted operation, and completed generation. */
  const [owner, marker, generation] = await Promise.all([
    readState(join(directory, "guard", "owner.json")),
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
  /** Owned guards retained for reverse-order release. */
  const owned = [];

  try {
    for (const resource of [...new Set(await Promise.all(resources.map(canonicalPath)))].sort()) {
      /** Resource-specific external coordination directory. */
      const directory = await statePath(resource);

      await mkdir(directory, { recursive: true });

      /** Atomic directory reservation and unguessable release identity. */
      const guard = join(directory, "guard"),
        token = randomUUID();

      try {
        await mkdir(guard);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;

        /** Existing owner must be demonstrably dead before abandonment repair. */
        const owner = await readState(join(guard, "owner.json"));

        if (!owner || alive(owner.pid))
          throw Object.assign(new Error(`Writer busy for ${resource}; retry after the current writer finishes.`), {
            code: "WRITER_BUSY",
          });

        // Renaming the dead guard prevents its removal from touching a replacement owner.
        /** Isolated abandoned directory removed without clearing incomplete state. */
        const abandoned = `${guard}.abandoned-${token}`;

        await rename(guard, abandoned);
        await rm(abandoned, { recursive: true });
        await mkdir(guard);
      }

      await writeFile(join(guard, "owner.json"), JSON.stringify({ pid: process.pid, token }));
      owned.push({ resource, directory, guard, token });
    }

    return await operation(owned);
  } finally {
    for (const owner of owned.reverse()) {
      if ((await readState(join(owner.guard, "owner.json")))?.token === owner.token)
        await rm(owner.guard, { recursive: true });
    }
  }
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
async function safeDestination(root, path) {
  if (path.startsWith("/") || path.split(/[\\/]/).includes("..")) throw new Error(`Unsafe artifact path: ${path}`);

  /** Current entry checked from the root through the destination. */
  let current = root;

  for (const segment of path.split("/")) {
    current = join(current, segment);

    /** Entry metadata, including dangling links. */
    const entry = await fingerprint(current);

    if (entry.type === "link") throw new Error(`Artifact path must not be a symlink: ${current}`);
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
 */
export async function applyArtifacts({
  root,
  output,
  expected,
  owner,
  recovery = "npm run build -- --recover=verify-restored",
  operations = {},
  allowRecovery,
}) {
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

  for (const [path, text] of output) {
    await safeDestination(root, path);

    /** Current destination type/bytes must agree with the complete prepared candidate. */
    const entry = await fingerprint(join(root, path));

    if (
      text === null
        ? entry.type === "absent"
        : entry.type === "file" && (await readFile(join(root, path), "utf8")) === text
    )
      continue;

    changed.push(path);
    before[join(root, path)] = entry;
    saved.set(path, await backup(join(root, path)));
  }

  if (!changed.length && !previous) return [];

  /** Persistent detection marker has verification metadata, never crash-replay backups. */
  const marker = { id: randomUUID(), pid: process.pid, before, recovery };

  await replaceFile(join(owner.directory, "incomplete.json"), JSON.stringify(marker));

  /** Expected post-write fingerprints for ownership-aware rollback. */
  const applied = new Map();

  try {
    for (const path of changed) {
      await assertFresh({ [join(root, path)]: before[join(root, path)] });

      if (output.get(path) === null) await (operations.remove ?? rm)(join(root, path), { recursive: true });
      else await (operations.replace ?? replaceFile)(join(root, path), output.get(path));

      applied.set(path, await fingerprint(join(root, path)));
    }

    await replaceFile(join(owner.directory, "generation.json"), JSON.stringify(marker.id));
    await rm(join(owner.directory, "incomplete.json"));

    return changed;
  } catch (error) {
    /** Restoration failures are reported alongside the original application error. */
    const failures = [];

    for (const [path, expectedEntry] of [...applied].reverse()) {
      try {
        if (!same(await fingerprint(join(root, path)), expectedEntry))
          throw new Error(`newer edit preserved: ${path}`, { cause: error });

        await (operations.restore ?? restore)(join(root, path), saved.get(path));
      } catch (failure) {
        failures.push(`${path}: ${failure.message}`);
      }
    }

    if (!failures.length && !previous) await rm(join(owner.directory, "incomplete.json"));
    else if (previous) await replaceFile(join(owner.directory, "incomplete.json"), JSON.stringify(previous));

    throw new Error(
      `${error.message}${failures.length ? `; rollback incomplete: ${failures.join("; ")}` : "; prior artifacts restored"}`,
      { cause: error },
    );
  }
}

/**
 * Verify the complete pre-application set under the normal guard, then clear only that marker.
 * @param resource - Owning checkout root.
 * @param validate - Local read-only contract validation, with recovery-only loading.
 */
export async function verifyRestored(resource, validate) {
  return withGuards([resource], async ([owner]) => {
    /** Retained marker must include the complete verification set. */
    const marker = await readState(join(owner.directory, "incomplete.json"));

    if (!marker || !marker.id || !Object.keys(marker.before ?? {}).length)
      throw new Error("No complete interrupted-generation verification metadata is available.");

    await assertFresh(marker.before);
    await validate();
    await assertFresh(marker.before);
    await rm(join(owner.directory, "incomplete.json"));
  });
}

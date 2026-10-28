/**
 * Verified GitHub release recovery.
 * @file Validate package identity, tag commits, and existing asset bytes before recovering a release.
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import yauzl from "yauzl";
import { parseStringPromise } from "xml2js";

/** Subprocess adapter and canonical repository. */
const execute = promisify(execFile),
  repository = "jacobcassidy/vscode-cassidy-dark-theme";

/**
 * Read bounded manifests without extracting archive paths.
 * @param bytes - Frozen archive bytes.
 * @returns {Promise<Map<string, string>>} Manifest text indexed by archive path.
 */
function manifests(bytes) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, archive) => {
      if (error) return reject(error);

      /** Manifest text indexed by archive path. */
      const found = new Map();

      /**
       * Close malformed archives.
       * @param failure - Archive or validation error.
       */
      function fail(failure) {
        archive.close();
        reject(failure);
      }

      archive.on("error", fail);
      archive.on("end", () => resolve(found));
      archive.on("entry", (entry) => {
        if (!["extension/package.json", "extension.vsixmanifest"].includes(entry.fileName)) {
          archive.readEntry();
          return;
        }

        if (found.has(entry.fileName) || entry.uncompressedSize > 2 * 1024 * 1024)
          return fail(new Error(`Duplicate or oversized VSIX manifest: ${entry.fileName}`));

        found.set(entry.fileName, "");
        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError) return fail(streamError);

          /** Manifest stream chunks. */
          const chunks = [];

          stream.on("error", fail);
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => {
            found.set(entry.fileName, Buffer.concat(chunks).toString("utf8"));
            archive.readEntry();
          });
        });
      });
      archive.readEntry();
    });
  });
}

/**
 * Require both embedded identities to match the checkout before any GitHub call.
 * @param bytes - Frozen archive bytes.
 * @param expected - Checkout package manifest.
 */
async function verifyIdentity(bytes, expected) {
  /** Archive entries containing independent identity declarations. */
  const entries = await manifests(bytes);

  if (!entries.has("extension/package.json") || !entries.has("extension.vsixmanifest"))
    throw new Error("VSIX must contain extension/package.json and extension.vsixmanifest");

  /** Parsed manifests and XML identity attributes. */
  const embedded = JSON.parse(entries.get("extension/package.json")),
    xml = await parseStringPromise(entries.get("extension.vsixmanifest"), {
      explicitArray: false,
      attrkey: "attributes",
    }),
    identity = xml.PackageManifest?.Metadata?.Identity?.attributes;

  for (const [key, attribute] of [
    ["name", "Id"],
    ["publisher", "Publisher"],
    ["version", "Version"],
  ]) {
    if (!expected[key] || embedded[key] !== expected[key] || identity?.[attribute] !== expected[key])
      throw new Error(`VSIX ${key} does not match checkout (${expected[key]}) in both embedded manifests`);
  }
}

/**
 * Recover a release without overwriting tags, notes, or conflicting assets.
 * @param options - Recovery inputs.
 * @param options.vsix - Archive path to verify and publish.
 * @param options.root - Repository checkout directory.
 * @param [options.run] - Subprocess adapter returning stdout and stderr.
 * @param [options.commit] - Checkout revision, defaulting to HEAD.
 * @returns Verified tag, archive SHA-256, and created/uploaded/verified status.
 */
export async function recoverGitHubRelease({ vsix, root, run = execute, commit }) {
  /** Freeze archive bytes and checkout identity. */
  const bytes = await readFile(vsix),
    expected = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  await verifyIdentity(bytes, expected);

  /** Expected immutable release identity. */
  const digest = createHash("sha256").update(bytes).digest("hex"),
    tag = `v${expected.version}`,
    asset = basename(vsix),
    revision = (await run("git", ["rev-parse", `${commit ?? "HEAD"}^{commit}`], { cwd: root })).stdout.trim();

  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Cannot resolve the release checkout commit");

  /**
   * Read metadata, treating only explicit HTTP 404 responses as absence.
   * @param path - Repository API suffix.
   * @param [missing] - Whether a missing object is allowed.
   */
  async function api(path, missing = false) {
    try {
      return JSON.parse((await run("gh", ["api", `repos/${repository}/${path}`])).stdout);
    } catch (error) {
      if (missing && /HTTP 404\b/.test(String(error.stderr))) return null;

      throw error;
    }
  }

  await run("gh", ["api", `repos/${repository}`, "--silent"]);

  /** Existing release and tag metadata. */
  const release = await api(`releases/tags/${tag}`, true),
    reference = await api(`git/ref/tags/${tag}`, true);

  if (release && !reference)
    throw new Error(`Release ${tag} exists without its tag; review GitHub state before recovery`);

  /** Annotated tag chains are peeled with a finite bound. */
  let object = reference?.object;

  for (let depth = 0; object?.type === "tag" && depth < 8; depth++) {
    if (!/^[a-f0-9]{40}$/.test(object.sha)) throw new Error(`Invalid annotated tag metadata for ${tag}`);

    object = (await api(`git/tags/${object.sha}`)).object;
  }

  if (reference && (object?.type !== "commit" || object.sha !== revision))
    throw new Error(`Tag ${tag} does not resolve to checkout ${revision}; review the tag before recovery`);

  if (release && (release.tag_name !== tag || !Array.isArray(release.assets)))
    throw new Error(`Invalid release metadata for ${tag}`);

  /** Same-name assets must match exact archive bytes. */
  const assets = release?.assets.filter((entry) => entry.name === asset) ?? [];

  if (assets.length > 1) throw new Error(`Release ${tag} contains duplicate assets named ${asset}`);

  if (assets.length) {
    if (!Number.isSafeInteger(assets[0].id) || assets[0].id <= 0 || assets[0].state !== "uploaded")
      throw new Error(`Release asset ${asset} is not completely uploaded`);

    /** Download bytes rather than trusting the filename or server digest. */
    const downloaded = (
      await run(
        "gh",
        ["api", `repos/${repository}/releases/assets/${assets[0].id}`, "--header", "Accept: application/octet-stream"],
        { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
      )
    ).stdout;

    if (createHash("sha256").update(downloaded).digest("hex") !== digest)
      throw new Error(`Release asset ${asset} has different bytes; review it before recovery`);

    return { tag, digest, status: "verified" };
  }

  /** Private staging prevents a supplied path changing after verification. */
  const staging = await mkdtemp(join(tmpdir(), "cassidy-release-"));

  try {
    /** Frozen archive passed to GitHub CLI. */
    const frozen = join(staging, asset);

    await writeFile(frozen, bytes, { mode: 0o444 });

    if (release) await run("gh", ["release", "upload", tag, frozen, "--repo", repository]);
    else {
      /** Changelog notes generated from the same checkout. */
      const notes = join(staging, "notes.md");

      await writeFile(
        notes,
        (await run("bash", ["dev/scripts/release/publish/get-changelog-notes.sh"], { cwd: root })).stdout,
      );
      await run("gh", [
        "release",
        "create",
        tag,
        frozen,
        "--repo",
        repository,
        "--target",
        revision,
        "--title",
        tag,
        "--notes-file",
        notes,
      ]);
    }

    return { tag, digest, status: release ? "uploaded" : "created" };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/**
 * GitHub recovery integrity tests.
 * @file Exercise embedded identity, tag peeling, byte comparisons, and safe recovery without contacting GitHub.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yazl from "yazl";
import { recoverGitHubRelease } from "../../tooling/release/github.js";

/** Fixture checkout identities. */
const identity = { name: "cassidy-dark", publisher: "jacobcassidy", version: "1.2.1" },
  revision = "a".repeat(40);

/**
 * Create a minimal independent VSIX fixture.
 * @param t - Test cleanup context.
 * @param [options] - Manifest overrides.
 * @param [options.json] - Package JSON overrides.
 * @param [options.xml] - XML identity overrides.
 * @param [options.omit] - Manifest path to omit.
 * @param [options.duplicate] - Manifest path to duplicate.
 */
async function fixture(t, { json = {}, xml = {}, omit, duplicate } = {}) {
  /** Isolated checkout and archive paths. */
  const root = await mkdtemp(join(tmpdir(), "release-test-")),
    vsix = join(root, "cassidy-dark.vsix"),
    zip = new yazl.ZipFile(),
    metadata = { ...identity, ...xml },
    entries = [
      ["extension/package.json", JSON.stringify({ ...identity, ...json })],
      [
        "extension.vsixmanifest",
        `<PackageManifest><Metadata><Identity Id="${metadata.name}" Publisher="${metadata.publisher}" Version="${metadata.version}"/></Metadata></PackageManifest>`,
      ],
    ];

  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "package.json"), JSON.stringify(identity));

  for (const [path, content] of entries) {
    if (path === omit) continue;

    zip.addBuffer(Buffer.from(content), path);

    if (path === duplicate) zip.addBuffer(Buffer.from(content), path);
  }

  /** Archive bytes collected independently of the recovery reader. */
  const chunks = [],
    bytes = new Promise((resolve, reject) => {
      zip.outputStream.on("data", (chunk) => chunks.push(chunk));
      zip.outputStream.on("error", reject);
      zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    });

  zip.end();
  await writeFile(vsix, await bytes);

  return { root, vsix };
}

/**
 * Record subprocess calls and emulate read-only GitHub metadata plus explicit writes.
 * @param location - Fixture checkout and archive paths.
 * @param [options] - Remote state overrides.
 * @param [options.tag] - Tag object or null for no tag.
 * @param [options.release] - Release metadata or null.
 * @param [options.download] - Asset bytes, defaulting to fixture bytes.
 * @param [options.annotated] - Annotated tag target.
 * @param [options.failure] - HTTP failure to inject.
 * @param [options.mutate] - Whether to modify the supplied archive during metadata lookup.
 */
async function remote(
  location,
  { tag = { type: "commit", sha: revision }, release = null, download, annotated, failure, mutate = false } = {},
) {
  /** Recorded calls, expected bytes, and staged uploads. */
  const calls = [],
    original = await readFile(location.vsix),
    uploads = [];

  /**
   * Run the exact recovery subprocess contract against fixture state.
   * @param command - Executable name.
   * @param args - Argument array.
   */
  async function run(command, args) {
    calls.push([command, ...args]);

    if (command === "git") return { stdout: revision + "\n" };
    if (command === "bash") return { stdout: "Release notes\n" };
    if (command !== "gh") throw new Error(`Unexpected command ${command}`);

    if (args[0] === "release") {
      uploads.push(await readFile(args[3]));
      return { stdout: "" };
    }

    if (args.includes("--silent")) return { stdout: "" };
    if (mutate) await writeFile(location.vsix, "changed after validation");
    if (failure) throw Object.assign(new Error("GitHub failed"), { stderr: `gh: HTTP ${failure}` });

    /** Requested API route mapped to deterministic metadata. */
    const path = args[1];

    if (path.includes("/releases/assets/")) return { stdout: download ?? original };
    if (path.includes("/git/tags/")) return { stdout: JSON.stringify({ object: annotated }) };

    /** A 404 is explicit, rather than a generic CLI/authentication failure. */
    const value = path.includes("/releases/tags/") ? release : tag ? { object: tag } : null;

    if (value === null) throw Object.assign(new Error("Not found"), { stderr: "gh: HTTP 404" });

    return { stdout: JSON.stringify(value) };
  }

  return { run, calls, uploads, original };
}

for (const manifest of ["json", "xml"]) {
  for (const key of ["name", "publisher", "version"]) {
    test(`reject mismatched ${manifest} ${key} before any remote operation`, async (t) => {
      /** Mismatched fixture and a runner that must never be called. */
      const location = await fixture(t, { [manifest]: { [key]: "wrong" } });

      await assert.rejects(
        recoverGitHubRelease({ ...location, run: () => assert.fail("Unexpected subprocess") }),
        new RegExp(`VSIX ${key}`),
      );
    });
  }
}

for (const options of [{ omit: "extension/package.json" }, { duplicate: "extension.vsixmanifest" }]) {
  test(`reject malformed archive manifest membership ${JSON.stringify(options)}`, async (t) => {
    /** Invalid manifest membership. */
    const location = await fixture(t, options);

    await assert.rejects(
      recoverGitHubRelease({ ...location, run: () => assert.fail("Unexpected subprocess") }),
      /must contain|Duplicate/,
    );
  });
}

test("reject a non-ZIP file before any remote operation", async (t) => {
  /** Corrupted supplied archive. */
  const location = await fixture(t);

  await writeFile(location.vsix, "not a ZIP");
  await assert.rejects(recoverGitHubRelease({ ...location, run: () => assert.fail("Unexpected subprocess") }));
});

test("create missing release with frozen bytes and exact checkout target", async (t) => {
  /** Missing remote release and tag; original file changes after validation. */
  const location = await fixture(t),
    state = await remote(location, { tag: null, mutate: true }),
    result = await recoverGitHubRelease({ ...location, run: state.run });

  assert.equal(result.status, "created");
  assert.deepEqual(state.uploads, [state.original]);
  assert.ok(state.calls.some((call) => call.includes("create") && call.includes(revision)));
});

test("upload a missing asset without replacing release notes", async (t) => {
  /** Existing exact release with no archive asset. */
  const location = await fixture(t),
    state = await remote(location, { release: { tag_name: "v1.2.1", assets: [] } }),
    result = await recoverGitHubRelease({ ...location, run: state.run });

  assert.equal(result.status, "uploaded");
  assert.equal(state.uploads.length, 1);
  assert.ok(!state.calls.some((call) => call.includes("create") || call[0] === "bash"));
});

for (const matching of [true, false]) {
  test(`existing same-name asset requires identical bytes (${matching}) and peeled tag`, async (t) => {
    /** Annotated tag plus an existing named asset. */
    const location = await fixture(t),
      state = await remote(location, {
        tag: { type: "tag", sha: "b".repeat(40) },
        annotated: { type: "commit", sha: revision },
        release: { tag_name: "v1.2.1", assets: [{ id: 7, name: "cassidy-dark.vsix", state: "uploaded" }] },
        download: matching ? undefined : Buffer.from("different archive"),
      });

    if (matching) assert.equal((await recoverGitHubRelease({ ...location, run: state.run })).status, "verified");
    else await assert.rejects(recoverGitHubRelease({ ...location, run: state.run }), /different bytes/);

    assert.equal(state.uploads.length, 0);
  });
}

for (const options of [
  { tag: { type: "commit", sha: "c".repeat(40) } },
  { tag: null, release: { tag_name: "v1.2.1", assets: [] } },
  { failure: 403 },
  { release: { tag_name: "v1.2.1", assets: [{ id: 1, name: "cassidy-dark.vsix", state: "new" }] } },
]) {
  test(`inconsistent or inaccessible remote state cannot trigger writes: ${JSON.stringify(options)}`, async (t) => {
    /** Invalid remote state with write recording. */
    const location = await fixture(t),
      state = await remote(location, options);

    await assert.rejects(recoverGitHubRelease({ ...location, run: state.run }));
    assert.equal(state.uploads.length, 0);
  });
}

/**
 * Maintained documentation checks.
 * @file Verify local links/anchors, reference destinations, complete schemas/codecs, and explicit partial excerpts without network or writes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createBuildProject, writeFixture } from "../helpers/projects.js";
import { checkDocs } from "../../tooling/docs/check.js";

/**
 * Snapshot every fixture file so read-only checking cannot conceal source/output writes.
 * @param root - Temporary project root.
 */
async function snapshot(root) {
  /** Sorted file inventory with raw source bytes. */
  const paths = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  return Promise.all(paths.map(async (path) => [path, (await readFile(path)).toString("base64")]));
}

test("local/reference links, duplicate heading anchors, directories, and links into archives resolve read-only", async (t) => {
  /** Archived internals are not strict maintained inputs, but active links to them must exist. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "guide.md"),
    "# Guide\n\n[one][ref]\n\n[second](target.md#repeat-1)\n\n[archive](archive/old.md)\n\n[directory](archive/)\n\n[ref]: target.md#hello-world\n",
  );

  await writeFixture(join(root, "target.md"), "# Hello `world`\n\n## Repeat\n\n## Repeat\n");
  await writeFixture(join(root, "archive/old.md"), "[Historical broken input](removed.md)");

  /** Complete checkout bytes must remain unchanged through successful validation. */
  const before = await snapshot(root);

  await checkDocs({ root, files: ["guide.md"] });
  assert.deepEqual(await snapshot(root), before);
  await writeFixture(join(root, "guide.md"), "[Broken](target.md#missing-anchor)");
  await assert.rejects(checkDocs({ root, files: ["guide.md"] }), /guide.md:1.*missing anchor/);
});

test("complete fences use local schemas/codecs and partial excerpts require explicit markers", async (t) => {
  /** A complete disabled UI descriptor needs no palette or alias resolution to validate structurally. */
  const root = await createBuildProject(t);

  /** Complete categorized example independent from checker implementation. */
  const complete =
    '{"standard":{},"sourceCode":{},"nonStandard":{"custom":{"foreground":{"disabled":true,"disabledReason":"Intentional fixture."}}},"deprecated":{}}';

  await writeFixture(
    join(root, "guide.md"),
    `<!-- token-example: ui definitions theme -->\n\n\`\`\`jsonc\n${complete}\n\`\`\`\n`,
  );

  await checkDocs({ root, files: ["guide.md"] });
  await writeFixture(join(root, "guide.md"), '<!-- partial-jsonc -->\n```jsonc\n"partial": {\n```\n');
  await checkDocs({ root, files: ["guide.md"] });
  await writeFixture(join(root, "guide.md"), "```jsonc\n{}\n```\n");
  await assert.rejects(checkDocs({ root, files: ["guide.md"] }), /needs a complete token-example contract/);

  await writeFixture(
    join(root, "guide.md"),
    `<!-- token-example: ui definitions theme -->\n\`\`\`jsonc\n${complete.replace('"disabled":true', '"disabled":"yes"')}\n\`\`\``,
  );

  await assert.rejects(checkDocs({ root, files: ["guide.md"] }), /schema validation failed/);
});

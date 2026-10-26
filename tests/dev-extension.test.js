/**
 * Development extension tests.
 * @file Verify repeatable preview synchronization, asset links, registrations, and source-file protections.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { syncDevExtension } from "../scripts/dev-extension/sync.js";
import { createPreviewProject } from "./test-projects.js";

test("dev extension sync is repeatable and refreshes themes without modifying the source manifest", async (t) => {
  /** Isolated preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);

  /** Original source text or assembled theme template used by the assertion. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  /** Destination manifest or source target path used by this scenario. */
  const target = await syncDevExtension(project);

  await syncDevExtension(project);

  /** Manifest fixture parsed before mutation or synchronization. */
  const manifest = JSON.parse(await readFile(target, "utf8"));

  assert.equal(manifest.name, "cassidy-dark-dev");
  assert.equal(manifest.displayName, "Cassidy Dark Dev");
  assert.equal(manifest.__metadata, undefined);
  assert.deepEqual(
    manifest.contributes.themes.map((theme) => theme.label),
    ["Cassidy Dark Dev", "Cassidy Dark Dev (Test)"],
  );

  for (const directory of ["themes", "dev-extension", "images"]) {
    assert.equal(
      await realpath(join(project.extensionDirectory, directory)),
      await realpath(join(project.root, directory)),
    );
  }

  await writeFile(join(project.root, "dev-extension/themes/cassidy-dark-color-theme-new.json"), project.theme);
  await syncDevExtension(project);

  /** Preview manifest reloaded after synchronization. */
  const refreshed = JSON.parse(await readFile(target, "utf8"));

  assert.equal(refreshed.contributes.themes.length, 3);
  assert.ok(refreshed.contributes.themes.every((theme) => theme._watch === true));
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

test("dev extension sync refuses a linked extension directory", async (t) => {
  /** Isolated preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);

  await symlink(project.root, project.extensionDirectory, "dir");
  await assert.rejects(syncDevExtension(project), /folder must be a regular directory/);
});

test("dev extension sync refuses a linked manifest without overwriting its target", async (t) => {
  /** Isolated preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);

  /** Original source text or assembled theme template used by the assertion. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  await mkdir(project.extensionDirectory);
  await symlink(join(project.root, "package.json"), join(project.extensionDirectory, "package.json"));
  await assert.rejects(syncDevExtension(project), /manifest is a symlink/);
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

for (const kind of ["directory", "wrong symlink"]) {
  test(`dev extension sync refuses an asset occupied by a ${kind}`, async (t) => {
    /** Isolated preview/source fixture with cleanup registered by the test. */
    const project = await createPreviewProject(t);

    /** Preview asset-link path inspected by the symlink protection test. */
    const link = join(project.extensionDirectory, "themes");

    await mkdir(project.extensionDirectory);

    if (kind === "directory") {
      await mkdir(link);
    } else {
      await symlink(join(project.root, "images"), link, "dir");
    }

    await assert.rejects(syncDevExtension(project), /Expected a symlink/);
  });
}

test("dev extension sync includes all prod themes, derives dev theme types, and labels sorted snapshots", async (t) => {
  /** Isolated preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);

  /** Manifest fixture parsed before mutation or synchronization. */
  const manifest = project.manifest;

  manifest.contributes.themes.push({ label: "Alternate", uiTheme: "hc-black", path: "themes/alternate.json" });
  await writeFile(
    join(project.root, "themes/alternate.json"),
    '{"name":"Alternate","type":"hc","colors":{},"tokenColors":[]}',
  );
  await writeFile(join(project.root, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(project.root, "dev-extension/themes/cassidy-dark-color-theme-test.json"),
    '{"name":"Cassidy Dark","type":"light","colors":{},"tokenColors":[]}',
  );

  for (const name of ["z-old", "a-old"]) {
    await writeFile(join(project.root, `dev-extension/static-snapshots/${name}.json`), project.theme);
  }

  /** Original source text or assembled theme template used by the assertion. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  /** Destination manifest or source target path used by this scenario. */
  const target = await syncDevExtension(project);

  /** Generated preview manifest inspected for registration metadata. */
  const preview = JSON.parse(await readFile(target, "utf8"));

  /** Initial build or manifest result retained for repeatability checks. */
  const first = await readFile(target, "utf8");

  await syncDevExtension(project);
  assert.equal(await readFile(target, "utf8"), first);
  assert.deepEqual(
    preview.contributes.themes.map(({ label, uiTheme }) => [label, uiTheme]),
    [
      ["Cassidy Dark Dev", "vs-dark"],
      ["Alternate Dev", "hc-black"],
      ["Cassidy Dark Dev (Test)", "vs"],
      ["Cassidy Dark Snapshot (a-old)", "vs-dark"],
      ["Cassidy Dark Snapshot (z-old)", "vs-dark"],
    ],
  );
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

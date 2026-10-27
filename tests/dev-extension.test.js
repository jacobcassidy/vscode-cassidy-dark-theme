/**
 * Development extension tests.
 * @file Verify repeatable preview synchronization, asset links, registrations, and source-file protections.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { syncDevExtension } from "../scripts/dev-extension/sync.js";
import { checkThemes } from "../scripts/themes/check.js";
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
  assert.equal(manifest.displayName, "Cassidy Dark Preview");
  assert.equal(manifest.__metadata, undefined);
  assert.deepEqual(
    manifest.contributes.themes.map((theme) => theme.label),
    ["Cassidy Dark Preview", "Cassidy Dark Preview (Test)"],
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

  manifest.contributes.themes.push({
    label: "Alternate (High Contrast)",
    uiTheme: "hc-black",
    path: "themes/alternate.json",
  });
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
      ["Cassidy Dark Preview", "vs-dark"],
      ["Alternate Preview (High Contrast)", "hc-black"],
      ["Cassidy Dark Preview (Test)", "vs"],
      ["Cassidy Dark Snapshot (a-old)", "vs-dark"],
      ["Cassidy Dark Snapshot (z-old)", "vs-dark"],
    ],
  );
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

test("preview names override existing suffixes without changing default or published labels", async (t) => {
  /** Isolated preview project used to compare published and preview registrations. */
  const project = await createPreviewProject(t);

  project.manifest.contributes.themes.push({
    label: "Custom (Named Target)",
    uiTheme: "hc-light",
    path: "themes/named.json",
  });
  await writeFile(join(project.root, "package.json"), JSON.stringify(project.manifest));

  for (const [path, name, type, previewName] of [
    ["themes/theme.json", "Cassidy Dark", "dark", "Ignored Default"],
    ["themes/named.json", "Custom", "hcLight", "  Release Candidate  "],
    ["dev-extension/themes/cassidy-dark-color-theme-test.json", "Experiment", "light", "Mixed CASE"],
    ["dev-extension/static-snapshots/cassidy-dark-color-theme-old.json", "Cassidy Dark", "dark", "Baseline 1.3"],
  ]) {
    await writeFile(join(project.root, path), JSON.stringify({ name, type, previewName, colors: {}, tokenColors: [] }));
  }

  /** Published manifest retained before preview synchronization. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  /** Generated preview manifest with overrides applied only to existing suffixes. */
  const manifest = JSON.parse(await readFile(await syncDevExtension(project), "utf8"));

  assert.deepEqual(
    manifest.contributes.themes.map(({ label, uiTheme }) => [label, uiTheme]),
    [
      ["Cassidy Dark Preview", "vs-dark"],
      ["Custom Preview (Release Candidate)", "hc-light"],
      ["Experiment Preview (Mixed CASE)", "vs"],
      ["Cassidy Dark Snapshot (Baseline 1.3)", "vs-dark"],
    ],
  );
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
  assert.equal(await checkThemes(project.root), 4);
});

for (const path of [
  "themes/theme.json",
  "dev-extension/themes/cassidy-dark-color-theme-test.json",
  "dev-extension/static-snapshots/old.json",
]) {
  test(`preview name validation reports invalid values in ${path}`, async (t) => {
    /** Isolated preview project containing the metadata under validation. */
    const project = await createPreviewProject(t);

    for (const previewName of [null, false, 42, {}, [], "", " \t\n "]) {
      await writeFile(
        join(project.root, path),
        JSON.stringify({
          name: "Cassidy Dark",
          type: "dark",
          previewName,
          colors: {},
          tokenColors: [],
        }),
      );
      await assert.rejects(syncDevExtension(project), (error) => {
        assert.ok(error.message.includes(path));
        assert.match(error.message, /previewName must be a nonempty string/);

        return true;
      });
      await assert.rejects(checkThemes(project.root), /previewName must be a nonempty string/);
    }
  });
}

for (const directory of ["themes", "static-snapshots"]) {
  test(`preview names cannot create duplicate labels in ${directory}`, async (t) => {
    /** Isolated project whose two distinct files resolve to the same preview label. */
    const project = await createPreviewProject(t);

    /** Previously valid manifest that a rejected synchronization must preserve. */
    const target = await syncDevExtension(project);

    /** Original preview manifest contents retained before introducing a collision. */
    const before = await readFile(target, "utf8");

    for (const name of ["first", "second"]) {
      await writeFile(
        join(project.root, `dev-extension/${directory}/${name}.json`),
        JSON.stringify({
          name: "Cassidy Dark",
          type: "dark",
          previewName: " Same Name ",
          colors: {},
          tokenColors: [],
        }),
      );
    }

    await assert.rejects(syncDevExtension(project), /Preview theme labels must be unique/);
    assert.equal(await readFile(target, "utf8"), before);
  });
}

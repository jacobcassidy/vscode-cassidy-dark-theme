/**
 * Development extension tests.
 * @file Verify repeatable preview synchronization, asset links, registrations, and source-file protections.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, readlink, realpath, rm, stat, symlink } from "node:fs/promises";
import { writeFixture as writeFile, createPreviewProject } from "../helpers/projects.js";
import { join } from "node:path";
import test from "node:test";
import { syncDevExtension } from "../../tooling/preview/sync.js";
import { checkGeneratedThemes as checkThemes } from "../../tooling/themes/generated-validation.js";

test("dev extension sync is repeatable and refreshes themes without modifying the source manifest", async (t) => {
  /** Isolated dev/preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);

  /** Original source text or assembled theme template used by the assertion. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  /** Destination manifest or source target path used by this scenario. */
  const { manifestPath: target, reloadRequired } = await syncDevExtension(project);

  assert.equal(reloadRequired, true);

  /** Initial manifest timestamp used to verify that unchanged syncs do not write it. */
  const before = await stat(target);

  assert.equal((await syncDevExtension(project)).reloadRequired, false);
  assert.equal((await stat(target)).mtimeMs, before.mtimeMs);

  /** Manifest fixture parsed before mutation or synchronization. */
  const manifest = JSON.parse(await readFile(target, "utf8"));

  assert.equal(manifest.name, "cassidy-dark-dev");
  assert.equal(manifest.displayName, "Cassidy Dark Preview");
  assert.equal(manifest.__metadata, undefined);
  assert.deepEqual(
    manifest.contributes.themes.map((theme) => theme.label),
    ["Cassidy Dark Preview", "Cassidy Dark Preview (Test)"],
  );

  for (const directory of ["themes", "preview", "images"]) {
    assert.equal(
      await realpath(join(project.extensionDirectory, directory)),
      await realpath(join(project.root, directory === "preview" ? "dev/preview" : directory)),
    );
  }

  await writeFile(join(project.root, "dev/preview/themes/cassidy-dark-color-theme-new.json"), project.theme);
  assert.equal((await syncDevExtension(project)).reloadRequired, true);

  /** Preview manifest reloaded after synchronization. */
  const refreshed = JSON.parse(await readFile(target, "utf8"));

  assert.equal(refreshed.contributes.themes.length, 3);
  assert.ok(refreshed.contributes.themes.every((theme) => theme._watch === true));
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

test("dev extension sync refuses a linked extension directory", async (t) => {
  /** Isolated dev/preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);
  await symlink(project.root, project.extensionDirectory, "dir");
  await assert.rejects(syncDevExtension(project), /folder must be a regular directory/);
});

test("dev extension sync requires manual repair of the old checkout preview link", async (t) => {
  /** Isolated project with an extension link pointing to the pre-migration location. */
  const project = await createPreviewProject(t);

  /** Stale link retained to prove failed sync does not replace user state. */
  const link = join(project.extensionDirectory, "preview"),
    oldTarget = join(project.root, "preview");

  await mkdir(project.extensionDirectory);
  await symlink(oldTarget, link, "dir");

  await assert.rejects(syncDevExtension(project), /Expected a symlink/);
  assert.equal(await readlink(link), oldTarget);

  await rm(link);
  await syncDevExtension(project);
  assert.equal(await realpath(link), await realpath(join(project.root, "dev/preview")));
});

test("dev extension sync refuses a linked manifest without overwriting its target", async (t) => {
  /** Isolated dev/preview/source fixture with cleanup registered by the test. */
  const project = await createPreviewProject(t);

  /** Original source text or assembled theme template used by the assertion. */
  const source = await readFile(join(project.root, "package.json"), "utf8");
  await mkdir(project.extensionDirectory);
  await symlink(join(project.root, "package.json"), join(project.extensionDirectory, "package.json"));
  await assert.rejects(syncDevExtension(project), /manifest is a symlink/);
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

for (const directory of ["themes", "preview", "images"]) {
  for (const kind of ["directory", "wrong symlink", "dangling symlink"]) {
    test(`dev extension sync protects the ${directory} asset occupied by a ${kind}`, async (t) => {
      /** Isolated dev/preview/source fixture with cleanup registered by the test. */
      const project = await createPreviewProject(t);

      /** Preview asset-link path inspected by the symlink protection test. */
      const link = join(project.extensionDirectory, directory);

      /** Unrelated or missing target whose symlink must remain unchanged. */
      const target = join(
        project.root,
        kind === "dangling symlink" ? "missing-assets" : directory === "images" ? "themes" : "images",
      );

      await mkdir(project.extensionDirectory);

      if (kind === "directory") {
        await mkdir(link);
      } else {
        await symlink(target, link, "dir");
      }

      await assert.rejects(syncDevExtension(project), /Expected a symlink/);

      if (kind === "directory") assert.equal((await stat(link)).isDirectory(), true);
      else assert.equal(await readlink(link), target);
    });
  }
}

test("dev extension sync includes all prod themes, derives dev theme types, and labels sorted snapshots", async (t) => {
  /** Isolated dev/preview/source fixture with cleanup registered by the test. */
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
    join(project.root, "dev/preview/themes/cassidy-dark-color-theme-test.json"),
    '{"name":"Cassidy Dark","type":"light","colors":{},"tokenColors":[]}',
  );

  for (const name of ["z-old", "a-old"]) {
    await writeFile(join(project.root, `dev/preview/snapshots/${name}.json`), project.theme);
  }

  /** Original source text or assembled theme template used by the assertion. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  /** Destination manifest or source target path used by this scenario. */
  const { manifestPath: target } = await syncDevExtension(project);

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
    ["dev/preview/themes/cassidy-dark-color-theme-test.json", "Experiment", "light", "Mixed CASE"],
    ["dev/preview/snapshots/cassidy-dark-color-theme-old.json", "Cassidy Dark", "dark", "Baseline 1.3"],
  ]) {
    await writeFile(join(project.root, path), JSON.stringify({ name, type, previewName, colors: {}, tokenColors: [] }));
  }

  /** Published manifest retained before preview synchronization. */
  const source = await readFile(join(project.root, "package.json"), "utf8");

  /** Generated preview manifest with overrides applied only to existing suffixes. */
  const manifest = JSON.parse(await readFile((await syncDevExtension(project)).manifestPath, "utf8"));

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
  "dev/preview/themes/cassidy-dark-color-theme-test.json",
  "dev/preview/snapshots/old.json",
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

for (const directory of ["themes", "snapshots"]) {
  test(`preview names cannot create duplicate labels in ${directory}`, async (t) => {
    /** Isolated project whose two distinct files resolve to the same preview label. */
    const project = await createPreviewProject(t);

    /** Previously valid manifest that a rejected synchronization must preserve. */
    const { manifestPath: target } = await syncDevExtension(project);

    /** Original preview manifest contents retained before introducing a collision. */
    const before = await readFile(target, "utf8");

    for (const name of ["first", "second"]) {
      await writeFile(
        join(project.root, `dev/preview/${directory}/${name}.json`),
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

test("preview reload detection ignores formatting, ordering, unrelated fields, and live content edits", async (t) => {
  /** Isolated preview project used to distinguish registration changes from live updates. */
  const project = await createPreviewProject(t);

  /** Initial preview manifest used to reorder semantically equivalent registrations. */
  const { manifestPath } = await syncDevExtension(project);

  /** Existing preview registrations rewritten with reversed array and key ordering. */
  const previous = JSON.parse(await readFile(manifestPath, "utf8"));

  previous.contributes.themes = previous.contributes.themes
    .reverse()
    .map((theme) => Object.fromEntries(Object.entries(theme).reverse()));

  await writeFile(manifestPath, JSON.stringify(previous));
  assert.equal((await syncDevExtension(project)).reloadRequired, false);
  project.manifest.description = "Updated package description";
  project.manifest.devDependencies = { fixture: "1.0.0" };
  await writeFile(join(project.root, "package.json"), JSON.stringify(project.manifest));

  for (const path of ["themes/theme.json", "dev/preview/themes/cassidy-dark-color-theme-test.json"]) {
    await writeFile(
      join(project.root, path),
      JSON.stringify({
        name: "Cassidy Dark",
        type: "dark",
        semanticHighlighting: false,
        colors: { "editor.background": "#123456" },
        tokenColors: [{ scope: "string", settings: { foreground: "#abcdef" } }],
        semanticTokenColors: { variable: "#abcdef" },
      }),
    );
  }

  assert.equal((await syncDevExtension(project)).reloadRequired, false);
  assert.equal(JSON.parse(await readFile(manifestPath, "utf8")).description, project.manifest.description);
});

for (const [key, value] of [
  ["id", "old-id"],
  ["label", "Old Preview"],
  ["path", "themes/old.json"],
  ["uiTheme", "vs"],
  ["_watch", false],
]) {
  test(`preview reload detection notices changed registration ${key}`, async (t) => {
    /** Preview project used to test one changed registration field. */
    const project = await createPreviewProject(t);

    /** Generated preview manifest that simulates the previously installed registration. */
    const { manifestPath } = await syncDevExtension(project);

    /** Previous registration changed independently of generated theme contents. */
    const previous = JSON.parse(await readFile(manifestPath, "utf8"));
    previous.contributes.themes[0][key] = value;
    await writeFile(manifestPath, JSON.stringify(previous));
    assert.equal((await syncDevExtension(project)).reloadRequired, true);
    assert.equal((await syncDevExtension(project)).reloadRequired, false);
  });
}

test("preview reload detection covers invalid manifests and repaired asset links", async (t) => {
  /** Preview installation used to exercise missing and malformed state. */
  const project = await createPreviewProject(t);

  /** Generated manifest path replaced with missing or invalid input below. */
  const { manifestPath } = await syncDevExtension(project);

  for (const source of ["", "{", "null", "{}", '{"contributes":{"themes":[null]}}']) {
    await writeFile(manifestPath, source);
    assert.equal((await syncDevExtension(project)).reloadRequired, true);
    assert.equal((await syncDevExtension(project)).reloadRequired, false);
  }

  await rm(manifestPath);
  assert.equal((await syncDevExtension(project)).reloadRequired, true);

  for (const directory of ["themes", "preview", "images"]) {
    await rm(join(project.extensionDirectory, directory));
    assert.equal((await syncDevExtension(project)).reloadRequired, true);
    assert.equal((await syncDevExtension(project)).reloadRequired, false);
  }
});

test("preview reload detection follows snapshot additions, metadata changes, and removals", async (t) => {
  /** Preview project whose snapshot registration is updated over repeated syncs. */
  const project = await createPreviewProject(t);

  /** New snapshot path used to test registration lifecycle changes. */
  const path = join(project.root, "dev/preview/snapshots/baseline.json");

  await syncDevExtension(project);
  await writeFile(path, project.theme);
  assert.equal((await syncDevExtension(project)).reloadRequired, true);
  await writeFile(
    path,
    JSON.stringify({ name: "Cassidy Dark", type: "light", previewName: "Renamed", colors: {}, tokenColors: [] }),
  );

  assert.equal((await syncDevExtension(project)).reloadRequired, true);
  assert.equal((await syncDevExtension(project)).reloadRequired, false);
  await rm(path);
  assert.equal((await syncDevExtension(project)).reloadRequired, true);
});

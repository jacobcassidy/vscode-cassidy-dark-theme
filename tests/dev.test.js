import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { syncDev } from "../scripts/local-extension/sync.js";
import { createProject } from "./helpers.js";

test("development sync is repeatable and refreshes themes without modifying the source manifest", async (t) => {
  const project = await createProject(t);
  const source = await readFile(join(project.root, "package.json"), "utf8");
  const target = await syncDev(project);

  await syncDev(project);

  const manifest = JSON.parse(await readFile(target, "utf8"));

  assert.equal(manifest.name, "cassidy-dark-dev");
  assert.equal(manifest.displayName, "Cassidy Dark Dev");
  assert.equal(manifest.__metadata, undefined);
  assert.deepEqual(
    manifest.contributes.themes.map((theme) => theme.label),
    ["Cassidy Dark Dev", "Cassidy Dark Dev (Test)"],
  );

  for (const directory of ["themes", "dev", "images"]) {
    assert.equal(
      await realpath(join(project.extensionDirectory, directory)),
      await realpath(join(project.root, directory)),
    );
  }

  await writeFile(join(project.root, "dev/themes/cassidy-dark-color-theme-new.json"), project.theme);
  await syncDev(project);

  const refreshed = JSON.parse(await readFile(target, "utf8"));

  assert.equal(refreshed.contributes.themes.length, 3);
  assert.ok(refreshed.contributes.themes.every((theme) => theme._watch === true));
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

test("development sync refuses a linked extension directory", async (t) => {
  const project = await createProject(t);

  await symlink(project.root, project.extensionDirectory, "dir");
  await assert.rejects(syncDev(project), /folder must be a regular directory/);
});

test("development sync refuses a linked manifest without overwriting its target", async (t) => {
  const project = await createProject(t);
  const source = await readFile(join(project.root, "package.json"), "utf8");

  await mkdir(project.extensionDirectory);
  await symlink(join(project.root, "package.json"), join(project.extensionDirectory, "package.json"));
  await assert.rejects(syncDev(project), /manifest is a symlink/);
  assert.equal(await readFile(join(project.root, "package.json"), "utf8"), source);
});

for (const kind of ["directory", "wrong symlink"]) {
  test(`development sync refuses an asset occupied by a ${kind}`, async (t) => {
    const project = await createProject(t);
    const link = join(project.extensionDirectory, "themes");

    await mkdir(project.extensionDirectory);

    if (kind === "directory") {
      await mkdir(link);
    } else {
      await symlink(join(project.root, "images"), link, "dir");
    }

    await assert.rejects(syncDev(project), /Expected a symlink/);
  });
}

test("preview sync includes all production themes, derives local theme types, and labels sorted snapshots", async (t) => {
  const project = await createProject(t);
  const manifest = project.manifest;

  manifest.contributes.themes.push({ label: "Alternate", uiTheme: "hc-black", path: "themes/alternate.json" });
  await writeFile(
    join(project.root, "themes/alternate.json"),
    '{"name":"Alternate","type":"hc","colors":{},"tokenColors":[]}',
  );
  await writeFile(join(project.root, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(project.root, "dev/themes/cassidy-dark-color-theme-test.json"),
    '{"name":"Cassidy Dark","type":"light","colors":{},"tokenColors":[]}',
  );

  for (const name of ["z-old", "a-old"]) {
    await writeFile(join(project.root, `dev/snapshots/${name}.json`), project.theme);
  }

  const source = await readFile(join(project.root, "package.json"), "utf8");
  const target = await syncDev(project);
  const preview = JSON.parse(await readFile(target, "utf8"));
  const first = await readFile(target, "utf8");

  await syncDev(project);
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

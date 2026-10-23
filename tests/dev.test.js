import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { syncDev } from "../scripts/dev/sync.js";
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

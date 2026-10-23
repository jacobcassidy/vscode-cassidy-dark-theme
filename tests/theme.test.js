import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { checkThemes } from "../scripts/check-theme.js";
import { createProject } from "./helpers.js";

test("theme validation accepts JSONC in both production and development themes", async (t) => {
  const { root } = await createProject(t);

  assert.equal(await checkThemes(root), 2);
});

test("theme validation rejects malformed development JSONC", async (t) => {
  const { root } = await createProject(t);

  await writeFile(join(root, "dev/themes/cassidy-dark-color-theme-test.json"), '{ "colors": ');
  await assert.rejects(checkThemes(root), /invalid JSONC/);
});

test("theme validation rejects an invalid production theme structure", async (t) => {
  const { root } = await createProject(t);

  await writeFile(join(root, "themes/theme.json"), '{ "colors": [], "tokenColors": {} }');
  await assert.rejects(checkThemes(root), /expected a theme object/);
});

for (const asset of ["icon", "theme"]) {
  test(`theme validation rejects a missing manifest ${asset}`, async (t) => {
    const { root, manifest } = await createProject(t);

    if (asset === "icon") {
      manifest.icon = "images/missing.png";
    } else {
      manifest.contributes.themes[0].path = "themes/missing.json";
    }

    await writeFile(join(root, "package.json"), JSON.stringify(manifest));
    await assert.rejects(checkThemes(root), /ENOENT/);
  });
}

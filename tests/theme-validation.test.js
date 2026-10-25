import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { checkThemes } from "../scripts/themes/check.js";
import { createPreviewProject } from "./test-projects.js";

test("theme validation accepts JSONC in both prod and dev themes", async (t) => {
  const { root } = await createPreviewProject(t);

  assert.equal(await checkThemes(root), 2);
});

test("theme validation rejects malformed dev JSONC", async (t) => {
  const { root } = await createPreviewProject(t);

  await writeFile(join(root, "dev/themes/cassidy-dark-color-theme-test.json"), '{ "colors": ');
  await assert.rejects(checkThemes(root), /invalid JSONC/);
});

test("theme validation rejects an invalid prod theme structure", async (t) => {
  const { root } = await createPreviewProject(t);

  await writeFile(join(root, "themes/theme.json"), '{ "colors": [], "tokenColors": {} }');
  await assert.rejects(checkThemes(root), /expected a theme object/);
});

for (const asset of ["icon", "theme"]) {
  test(`theme validation rejects a missing manifest ${asset}`, async (t) => {
    const { root, manifest } = await createPreviewProject(t);

    if (asset === "icon") {
      manifest.icon = "images/missing.png";
    } else {
      manifest.contributes.themes[0].path = "themes/missing.json";
    }

    await writeFile(join(root, "package.json"), JSON.stringify(manifest));
    await assert.rejects(checkThemes(root), /ENOENT/);
  });
}

test("theme validation rejects registrations whose UI type differs from their theme metadata", async (t) => {
  const { root, manifest } = await createPreviewProject(t);

  manifest.contributes.themes[0].uiTheme = "hc-black";
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await assert.rejects(checkThemes(root), /uiTheme does not match theme type dark/);
});

test("theme validation rejects duplicate labels and unregistered prod files", async (t) => {
  const { root, manifest, theme } = await createPreviewProject(t);

  manifest.contributes.themes.push({ ...manifest.contributes.themes[0] });
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await assert.rejects(checkThemes(root), /labels must be nonempty and unique/);
  manifest.contributes.themes.pop();
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, "themes/extra.json"), theme);
  await assert.rejects(checkThemes(root), /Unregistered prod theme/);
});

test("theme validation keeps dev themes out of prod registrations", async (t) => {
  const { root, manifest } = await createPreviewProject(t);

  manifest.contributes.themes[0].path = "dev/themes/cassidy-dark-color-theme-test.json";
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await assert.rejects(checkThemes(root), /Invalid or duplicate prod theme path/);
});

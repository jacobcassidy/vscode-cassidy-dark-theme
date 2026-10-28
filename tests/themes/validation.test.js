/**
 * Theme validation tests.
 * @file Verify JSONC theme validation, manifest assets, registration consistency, and development-theme exclusions.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  writeFixture as writeFile,
  createPreviewProject,
  createBuildProject,
  readBuildOutputs,
} from "../helpers/projects.js";
import { join } from "node:path";
import test from "node:test";
import { checkGeneratedThemes as checkThemes } from "../../tooling/themes/generated-validation.js";
import { checkThemes as checkCurrentThemes } from "../../tooling/themes/check.js";
import { prepareBuild, applyBuild } from "../../tooling/themes/build.js";

test("combined theme validation compares generated artifacts and checks manifest assets without writes", async (t) => {
  /** Complete authored fixture supports source preparation as well as generated validation. */
  const root = await createBuildProject(t);

  /** Production manifest receives the icon required by generated asset validation. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  manifest.icon = "images/icon.png";
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, manifest.icon), "fixture");
  await applyBuild(await prepareBuild({ root }));
  assert.equal(await checkCurrentThemes(root), 1);
  await writeFile(join(root, "src/themes/prod/default/palette/generated/palette.md"), "Stale report\n");

  /** A failed comparison must preserve every byte, including the deliberately stale report. */
  const before = await readBuildOutputs(root);

  await assert.rejects(checkCurrentThemes(root), /missing or stale/);
  assert.deepEqual(await readBuildOutputs(root), before);
});

test("theme validation accepts JSONC in both prod and dev themes", async (t) => {
  /** Temporary source project root for this test scenario. */
  const { root } = await createPreviewProject(t);
  assert.equal(await checkThemes(root), 2);
});

test("theme validation rejects malformed dev JSONC", async (t) => {
  /** Temporary source project root for this test scenario. */
  const { root } = await createPreviewProject(t);
  await writeFile(join(root, "preview/themes/cassidy-dark-color-theme-test.json"), '{ "colors": ');
  await assert.rejects(checkThemes(root), /invalid JSONC/);
});

test("theme validation rejects an invalid prod theme structure", async (t) => {
  /** Temporary source project root for this test scenario. */
  const { root } = await createPreviewProject(t);
  await writeFile(join(root, "themes/theme.json"), '{ "colors": [], "tokenColors": {} }');
  await assert.rejects(checkThemes(root), /expected a theme object/);
});

for (const asset of ["icon", "theme"]) {
  test(`theme validation rejects a missing manifest ${asset}`, async (t) => {
    /** Fixture paths and source values used by the validation scenario. */
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
  /** Fixture paths and source values used by the validation scenario. */
  const { root, manifest } = await createPreviewProject(t);
  manifest.contributes.themes[0].uiTheme = "hc-black";
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await assert.rejects(checkThemes(root), /uiTheme does not match theme type dark/);
});

test("theme validation rejects duplicate labels and unregistered prod files", async (t) => {
  /** Fixture paths and source values used by the validation scenario. */
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
  /** Fixture paths and source values used by the validation scenario. */
  const { root, manifest } = await createPreviewProject(t);
  manifest.contributes.themes[0].path = "preview/themes/cassidy-dark-color-theme-test.json";
  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await assert.rejects(checkThemes(root), /Invalid or duplicate prod theme path/);
});

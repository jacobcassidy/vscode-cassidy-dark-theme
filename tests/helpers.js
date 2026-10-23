import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createProject(t) {
  const directory = await mkdtemp(join(tmpdir(), "cassidy-theme-test-"));

  t.after(() => rm(directory, { recursive: true, force: true }));

  const root = join(directory, "project");
  const extensionDirectory = join(directory, "extension");

  const manifest = {
    name: "cassidy-dark",
    displayName: "Cassidy Dark Theme",
    publisher: "jacobcassidy",
    version: "1.2.1",
    icon: "images/icon.png",
    contributes: {
      themes: [{ label: "Cassidy Dark", uiTheme: "vs-dark", path: "themes/theme.json" }],
    },
    __metadata: { id: "installed-extension" },
  };

  for (const path of ["themes", "dev/themes", "images"]) {
    await mkdir(join(root, path), { recursive: true });
  }

  const theme = '{ // Theme files allow comments and trailing commas.\n"colors": {}, "tokenColors": [], }';

  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, "themes/theme.json"), theme);
  await writeFile(join(root, "dev/themes/cassidy-dark-color-theme-test.json"), theme);
  await writeFile(join(root, "images/icon.png"), "fixture");

  return { root, extensionDirectory, manifest, theme };
}

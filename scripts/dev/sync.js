import { readFile, writeFile, mkdir, lstat, readdir, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export async function syncDev({
  root = fileURLToPath(new URL("../../", import.meta.url)),
  extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
} = {}) {
  const target = join(extensionDirectory, "package.json");
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  manifest.name = "cassidy-dark-dev";
  manifest.displayName = "Cassidy Dark Dev";
  // Do not inherit the published extension identity.
  delete manifest.__metadata;

  const devThemes = (await readdir(join(root, "dev/themes"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  manifest.contributes ??= {};
  manifest.contributes.themes = [
    ...(manifest.contributes.themes ?? []).map((theme) => ({
      ...theme,
      label: `${theme.label} Dev`,
      _watch: true,
    })),
    ...devThemes.map((file) => {
      const name = file
        .replace(/\.json$/, "")
        .replace(/^cassidy-dark-color-theme-/, "")
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      return {
        label: `Cassidy Dark Dev (${name})`,
        uiTheme: "vs-dark",
        path: `./dev/themes/${file}`,
        _watch: true,
      };
    }),
  ];

  // Keep the generated manifest separate from the source checkout.
  const extensionInfo = await statIfPresent(extensionDirectory);

  if (extensionInfo?.isSymbolicLink()) {
    throw new Error(`Dev extension folder must be a regular directory: ${extensionDirectory}`);
  }

  await mkdir(extensionDirectory, { recursive: true });

  // Refuse to overwrite the source through a linked dev manifest.
  const targetInfo = await statIfPresent(target);

  if (targetInfo?.isSymbolicLink()) {
    throw new Error(`Dev manifest is a symlink; replace it with a regular file: ${target}`);
  }

  // Link assets directly to the checkout so edits appear without copying files.
  for (const directory of ["themes", "dev", "images"]) {
    const sourceDirectory = join(root, directory);
    const sourceRealPath = await realpath(sourceDirectory);
    const link = join(extensionDirectory, directory);
    const linkInfo = await statIfPresent(link);

    if (!linkInfo) {
      await symlink(sourceDirectory, link, "dir");
    } else if (!linkInfo.isSymbolicLink() || (await realpath(link)) !== sourceRealPath) {
      throw new Error(`Expected a symlink to ${sourceDirectory}: ${link}`);
    }
  }

  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);

  return target;
}

async function statIfPresent(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

if (import.meta.main) {
  console.log(`Synced dev manifest: ${await syncDev()}`);
  console.log("Run Developer: Reload Window in VS Code, then select a Cassidy Dark Dev theme.");
}

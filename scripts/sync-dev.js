import { readFile, writeFile, mkdir, lstat, readdir, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../package.json", import.meta.url));
const target = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev/package.json");

const manifest = JSON.parse(await readFile(source, "utf8"));
manifest.name = "cassidy-dark-dev";
manifest.displayName = "Cassidy Dark Dev";
// Do not inherit the published extension identity.
delete manifest.__metadata;

// Change this to "" to keep the default theme's original label.
const defaultThemeSuffix = " Dev";
const devDirectory = fileURLToPath(new URL("../dev/", import.meta.url));
const devThemes = (await readdir(join(devDirectory, "themes"), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();

manifest.contributes ??= {};
manifest.contributes.themes = [
  ...(manifest.contributes.themes ?? []).map((theme) => ({
    ...theme,
    label: `${theme.label}${defaultThemeSuffix}`,
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
const extensionDirectory = dirname(target);
const extensionInfo = await lstat(extensionDirectory).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (extensionInfo?.isSymbolicLink()) {
  throw new Error(`Dev extension folder must be a regular directory: ${extensionDirectory}`);
}
await mkdir(extensionDirectory, { recursive: true });

// Refuse to overwrite the source through a linked dev manifest.
const targetInfo = await lstat(target).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (targetInfo?.isSymbolicLink()) {
  throw new Error(`Dev manifest is a symlink; replace it with a regular file: ${target}`);
}

// Link assets directly to the checkout so edits appear without copying files.
for (const directory of ["themes", "dev", "images"]) {
  const sourceDirectory = fileURLToPath(new URL(`../${directory}/`, import.meta.url));
  const sourceRealPath = await realpath(sourceDirectory);
  const link = join(extensionDirectory, directory);
  const linkInfo = await lstat(link).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (!linkInfo) {
    await symlink(sourceDirectory, link, "dir");
  } else if (!linkInfo.isSymbolicLink() || (await realpath(link)) !== sourceRealPath) {
    throw new Error(`Expected a symlink to ${sourceDirectory}: ${link}`);
  }
}

await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Synced dev manifest: ${target}`);

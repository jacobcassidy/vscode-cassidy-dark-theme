import { readFile, writeFile, lstat, readdir, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../package.json", import.meta.url));
const target = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev/package.json");

const manifest = JSON.parse(await readFile(source, "utf8"));
manifest.name = "cassidy-dark-dev";
manifest.displayName = "Cassidy Dark Dev";

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
    };
  }),
];

// Refuse to overwrite the source through a linked dev manifest.
const targetInfo = await lstat(target).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (targetInfo?.isSymbolicLink()) {
  throw new Error(`Dev manifest is a symlink; replace it with a regular file: ${target}`);
}

// Make the generated development theme paths resolve inside the extension.
const devLink = join(dirname(target), "dev");
const devLinkInfo = await lstat(devLink).catch((error) => {
  if (error.code !== "ENOENT") throw error;
  return null;
});
if (!devLinkInfo) {
  await symlink(devDirectory, devLink, "dir");
} else if ((await realpath(devLink)) !== (await realpath(devDirectory))) {
  throw new Error(`Dev directory must link to ${devDirectory}: ${devLink}`);
}

await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Synced dev manifest: ${target}`);

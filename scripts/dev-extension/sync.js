import { readFile, writeFile, mkdir, lstat, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "../lib/jsonc-validation.js";
import { listFiles, themeUiType } from "../lib/theme-source-inputs.js";

export async function syncDevExtension({
  root = fileURLToPath(new URL("../../", import.meta.url)),
  extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
} = {}) {
  const target = join(extensionDirectory, "package.json");
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  manifest.name = "cassidy-dark-dev";
  manifest.displayName = "Cassidy Dark Dev";
  // Do not inherit the published extension identity.
  delete manifest.__metadata;

  const generatedThemes = (await listFiles(join(root, "dev/themes"))).filter((file) => file.endsWith(".json"));

  manifest.contributes ??= {};
  manifest.contributes.themes = [
    ...(await Promise.all(
      (manifest.contributes.themes ?? []).map(async (theme) => {
        const metadata = parseJsonc(await readFile(join(root, theme.path), "utf8"), theme.path).value;

        if (theme.uiTheme !== themeUiType(metadata, theme.path)) {
          throw new Error(`${theme.path}: manifest uiTheme does not match theme type ${metadata.type}`);
        }

        return { ...theme, label: `${theme.label} Dev`, _watch: true };
      }),
    )),
    ...(await Promise.all(
      generatedThemes.map(async (file) => {
        const name = file
          .replace(/\.json$/, "")
          .replace(/^cassidy-dark-color-theme-/, "")
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        const path = `dev/themes/${file}`;
        const metadata = parseJsonc(await readFile(join(root, path), "utf8"), path).value;

        return {
          label: `${metadata.name} Dev (${name})`,
          uiTheme: themeUiType(metadata, path),
          path: `./dev/themes/${file}`,
          _watch: true,
        };
      }),
    )),
    ...(await Promise.all(
      (await listFiles(join(root, "dev/snapshots")))
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const path = `dev/snapshots/${file}`;
          const metadata = parseJsonc(await readFile(join(root, path), "utf8"), path).value;

          return {
            label: `Cassidy Dark Snapshot (${file.replace(/^cassidy-dark-color-theme-/, "").replace(/\.json$/, "")})`,
            uiTheme: themeUiType(metadata, path),
            path: `./${path}`,
            _watch: true,
          };
        }),
    )),
  ];

  const labels = manifest.contributes.themes.map((theme) => theme.label);

  if (new Set(labels).size !== labels.length) throw new Error("Preview theme labels must be unique");

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
  console.log(`Synced dev manifest: ${await syncDevExtension()}`);
  console.log("Run Developer: Reload Window in VS Code, then select a Cassidy Dark Dev theme.");
}

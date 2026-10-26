/**
 * Development extension synchronization.
 * @file Build a separate preview manifest and link checkout assets into the local development extension.
 */

import { readFile, writeFile, mkdir, lstat, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "../lib/jsonc-validation.js";
import { listFiles, themeUiType } from "../lib/theme-source-inputs.js";

/**
 * Refresh the preview manifest and asset links without overwriting source files.
 *
 * @param [options] - Options passed to this operation.
 * @param [options.root] - Repository or fixture root; defaults to this checkout.
 * @param [options.extensionDirectory] - Separate preview extension directory; defaults to the local VS Code extension path.
 * @returns Path to the generated development extension manifest.
 */
export async function syncDevExtension({
  root = fileURLToPath(new URL("../../", import.meta.url)),
  extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
} = {}) {
  /** Destination path of the separate development manifest. */
  const target = join(extensionDirectory, "package.json");

  /** Source manifest copied and adapted for the development extension. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  manifest.name = "cassidy-dark-dev";
  manifest.displayName = "Cassidy Dark Dev";
  // Do not inherit the published extension identity.
  delete manifest.__metadata;

  /** Generated development theme filenames to register for preview. */
  const generatedThemes = (await listFiles(join(root, "dev-extension/themes"))).filter((file) =>
    file.endsWith(".json"),
  );

  manifest.contributes ??= {};
  manifest.contributes.themes = [
    ...(await Promise.all(
      (manifest.contributes.themes ?? []).map(async (theme) => {
        /** Parsed theme metadata used for preview labels and UI types. */
        const metadata = parseJsonc(await readFile(join(root, theme.path), "utf8"), theme.path).value;

        if (theme.uiTheme !== themeUiType(metadata, theme.path)) {
          throw new Error(`${theme.path}: manifest uiTheme does not match theme type ${metadata.type}`);
        }

        return { ...theme, label: `${theme.label} Dev`, _watch: true };
      }),
    )),
    ...(await Promise.all(
      generatedThemes.map(async (file) => {
        /** Human-readable suffix derived from the generated theme filename. */
        const name = file
          .replace(/\.json$/, "")
          .replace(/^cassidy-dark-color-theme-/, "")
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        /** Checkout-relative theme path used by the preview registration. */
        const path = `dev-extension/themes/${file}`;

        /** Parsed theme metadata used for preview labels and UI types. */
        const metadata = parseJsonc(await readFile(join(root, path), "utf8"), path).value;

        return {
          label: `${metadata.name} Dev (${name})`,
          uiTheme: themeUiType(metadata, path),
          path: `./dev-extension/themes/${file}`,
          _watch: true,
        };
      }),
    )),
    ...(await Promise.all(
      (await listFiles(join(root, "dev-extension/static-snapshots")))
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          /** Checkout-relative theme path used by the preview registration. */
          const path = `dev-extension/static-snapshots/${file}`;

          /** Parsed theme metadata used for preview labels and UI types. */
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

  /** Preview registration labels checked for collisions. */
  const labels = manifest.contributes.themes.map((theme) => theme.label);

  if (new Set(labels).size !== labels.length) throw new Error("Preview theme labels must be unique");

  // Keep the generated manifest separate from the source checkout.

  /** Existing extension-directory entry inspected without following links. */
  const extensionInfo = await statIfPresent(extensionDirectory);

  if (extensionInfo?.isSymbolicLink()) {
    throw new Error(`Dev extension folder must be a regular directory: ${extensionDirectory}`);
  }

  await mkdir(extensionDirectory, { recursive: true });

  // Refuse to overwrite the source through a linked dev manifest.

  /** Existing manifest entry checked before writing the preview manifest. */
  const targetInfo = await statIfPresent(target);

  if (targetInfo?.isSymbolicLink()) {
    throw new Error(`Dev manifest is a symlink; replace it with a regular file: ${target}`);
  }

  // Link assets directly to the checkout so edits appear without copying files.
  for (const directory of ["themes", "dev-extension", "images"]) {
    /** Checkout asset directory to expose through the preview extension. */
    const sourceDirectory = join(root, directory);

    /** Canonical checkout path expected behind an existing asset link. */
    const sourceRealPath = await realpath(sourceDirectory);

    /** Destination asset-link path inside the development extension. */
    const link = join(extensionDirectory, directory);

    /** Existing asset entry inspected before creating or accepting a symlink. */
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

/**
 * Inspect a path without following symlinks, returning null when it is absent.
 *
 * @param path - Path to the file, directory, or configuration value being processed.
 * @returns Filesystem information, or null when the path is absent.
 */
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

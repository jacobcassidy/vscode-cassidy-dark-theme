/**
 * Development extension synchronization.
 * @file Build a separate preview manifest and link checkout assets into the local development extension.
 */

import { readFile, writeFile, mkdir, lstat, realpath, symlink } from "node:fs/promises";
import { assertFresh, capturePaths, requireStable, withGuards, observeWriter } from "../shared/transactions.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { repositoryRoot } from "../shared/paths.js";
import { canonicalJson } from "../shared/serialization.js";
import { formatMessage } from "../shared/terminal-output.js";
import { parseJsonc } from "../shared/jsonc.js";
import { listFiles, readOptional, themeUiType } from "../themes/inputs.js";

/**
 * Compare preview identity and registrations independently of formatting and ordering.
 * @param source - Existing or generated preview manifest JSON text.
 * @returns Stable registration snapshot, or undefined for an absent or invalid manifest.
 */
function previewRegistrations(source) {
  try {
    /** Parsed preview manifest whose registrations determine reload requirements. */
    const manifest = JSON.parse(source);

    if (!Array.isArray(manifest.contributes?.themes)) return undefined;

    if (
      manifest.contributes.themes.some(
        (theme) => !theme || typeof theme.path !== "string" || typeof theme.uiTheme !== "string",
      )
    )
      return undefined;

    return canonicalJson({
      name: manifest.name,
      publisher: manifest.publisher ?? null,
      themes: manifest.contributes.themes.map(canonicalJson).sort(),
    });
  } catch {
    return undefined;
  }
}

/**
 * Print the shared magenta instruction after a reload-requiring preview update.
 * @param [logger] - Logger receiving the reminder.
 */
export function logReloadReminder(logger = console) {
  logger.log(
    formatMessage("Run Developer: Reload Window in VS Code, then select a Cassidy Dark Preview theme.", "action"),
  );
}

/**
 * Refresh the preview manifest and asset links without overwriting source files.
 *
 * @param [options] - Options passed to this operation.
 * @param [options.root] - Repository or fixture root; defaults to this checkout.
 * @param [options.extensionDirectory] - Separate preview extension directory; defaults to the local VS Code extension path.
 * @returns Generated manifest path and whether the applied preview changes require a window reload.
 */
export async function syncDevExtension({
  root = repositoryRoot,
  extensionDirectory = join(homedir(), ".vscode/extensions/jacobcassidy.cassidy-dark-dev"),
} = {}) {
  await requireStable(root);

  /** Registration sources and installed entries frozen before preparation. */
  const expected = await capturePaths([
    join(root, "package.json"),
    join(root, "themes"),
    join(root, "dev/preview"),
    extensionDirectory,
  ]);

  /** Destination path of the separate development manifest. */
  const target = join(extensionDirectory, "package.json");

  /** Source manifest copied and adapted for the development extension. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  manifest.name = "cassidy-dark-dev";
  manifest.displayName = "Cassidy Dark Preview";
  // Do not inherit the published extension identity.
  delete manifest.__metadata;

  /** Generated development theme filenames to register for preview. */
  const generatedThemes = (await listFiles(join(root, "dev/preview/themes"))).filter((file) => file.endsWith(".json"));

  manifest.contributes ??= {};
  manifest.contributes.themes = [
    ...(await Promise.all(
      (manifest.contributes.themes ?? []).map(async (theme) => {
        /** Generated production theme text required for preview registration. */
        const source = await readOptional(join(root, theme.path));

        if (source === undefined) throw new Error(`Missing generated theme ${theme.path}. Run npm run build.`);

        /** Generated production metadata used to derive the preview registration. */
        const metadata = parseJsonc(source, theme.path).value;

        if (theme.uiTheme !== themeUiType(metadata, theme.path)) {
          throw new Error(`${theme.path}: manifest uiTheme does not match theme type ${metadata.type}`);
        }

        /** Existing target suffix, absent for the default production theme. */
        const suffix =
          theme.label.startsWith(`${metadata.name} (`) && theme.label.endsWith(")")
            ? theme.label.slice(metadata.name.length + 2, -1)
            : undefined;

        /** Preview label preserving the base name and any existing target suffix. */
        const label =
          suffix === undefined
            ? `${theme.label} Preview`
            : `${metadata.name} Preview (${metadata.previewName?.trim() ?? suffix})`;
        return { ...theme, label, _watch: true };
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
        const path = `dev/preview/themes/${file}`;

        /** Parsed theme metadata used for preview labels and UI types. */
        const metadata = parseJsonc(await readFile(join(root, path), "utf8"), path).value;

        /** VS Code theme type after validating the optional preview name. */
        const uiTheme = themeUiType(metadata, path);

        return {
          label: `${metadata.name} Preview (${metadata.previewName?.trim() ?? name})`,
          uiTheme,
          path: `./preview/themes/${file}`,
          _watch: true,
        };
      }),
    )),
    ...(await Promise.all(
      (await listFiles(join(root, "dev/preview/snapshots")))
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          /** Checkout-relative theme path used by the preview registration. */
          const path = `dev/preview/snapshots/${file}`;

          /** Parsed theme metadata used for preview labels and UI types. */
          const metadata = parseJsonc(await readFile(join(root, path), "utf8"), path).value;

          /** VS Code theme type after validating the optional preview name. */
          const uiTheme = themeUiType(metadata, path);

          /** Snapshot suffix preserving the filename unless an override is supplied. */
          const name =
            metadata.previewName?.trim() ?? file.replace(/^cassidy-dark-color-theme-/, "").replace(/\.json$/, "");

          return {
            label: `Cassidy Dark Snapshot (${name})`,
            uiTheme,
            path: `./preview/snapshots/${file}`,
            _watch: true,
          };
        }),
    )),
  ];

  /** Preview registration labels checked for collisions. */
  const labels = manifest.contributes.themes.map((theme) => theme.label);

  if (new Set(labels).size !== labels.length) throw new Error("Preview theme labels must be unique");

  return withGuards([root, extensionDirectory], async () => {
    await requireStablePreview();
    await assertFresh(expected);

    // Keep the generated manifest separate from the source checkout.

    /** Existing extension-directory entry inspected without following links. */
    const extensionInfo = await statIfPresent(extensionDirectory);

    if (extensionInfo?.isSymbolicLink()) {
      throw new Error(`Dev extension folder must be a regular directory: ${extensionDirectory}`);
    }

    await mkdir(join(root, "dev/preview"), { recursive: true });
    await mkdir(extensionDirectory, { recursive: true });

    // Refuse to overwrite the source through a linked dev manifest.

    /** Existing manifest entry checked before writing the preview manifest. */
    const targetInfo = await statIfPresent(target);

    if (targetInfo?.isSymbolicLink()) {
      throw new Error(`Dev manifest is a symlink; replace it with a regular file: ${target}`);
    }

    /** Previous preview manifest retained for change detection and write avoidance. */
    const previous = await readOptional(target);

    /** New preview manifest text, including unrelated source metadata updates. */
    const current = `${JSON.stringify(manifest, null, 2)}\n`;

    /** Whether registrations or repaired preview assets require VS Code to reload. */
    let reloadRequired = previewRegistrations(previous) !== previewRegistrations(current);

    // Link assets directly to the checkout so edits appear without copying files.
    for (const [directory, source] of [
      ["themes", "themes"],
      ["preview", "dev/preview"],
      ["images", "images"],
    ]) {
      /** Checkout asset directory to expose through the preview extension. */
      const sourceDirectory = join(root, source);

      /** Canonical checkout path expected behind an existing asset link. */
      const sourceRealPath = await realpath(sourceDirectory).catch((error) => {
        if (error.code === "ENOENT" && directory === "themes") {
          throw new Error("Missing generated themes directory. Run npm run build.", { cause: error });
        }

        throw error;
      });

      /** Destination asset-link path inside the development extension. */
      const link = join(extensionDirectory, directory);

      /** Existing asset entry inspected before creating or accepting a symlink. */
      const linkInfo = await statIfPresent(link);

      if (!linkInfo) {
        await symlink(sourceDirectory, link, "dir");
        reloadRequired = true;
      } else {
        if (!linkInfo.isSymbolicLink() || (await realpath(link).catch(() => null)) !== sourceRealPath) {
          throw new Error(`Expected a symlink to ${sourceDirectory}: ${link}`);
        }
      }
    }

    if (previous !== current) await writeFile(target, current);

    return { manifestPath: target, reloadRequired };
  });

  /** Verify incomplete checkout state while retaining our own root guard. */
  async function requireStablePreview() {
    // Input freshness covers completed generations; interrupted markers remain fatal.

    /** Existing writer state, observed without releasing destination ownership. */
    const { marker } = await observeWriter(root);

    if (marker)
      throw Object.assign(new Error(`Incomplete generation ${marker.id}; run ${marker.recovery}.`), {
        code: "INCOMPLETE_GENERATION",
      });
  }
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

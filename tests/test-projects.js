/**
 * Temporary test projects.
 * @file Create isolated theme and extension fixtures and read their generated outputs for assertions.
 */

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTree } from "jsonc-parser";
import { assembleThemeTemplate } from "../scripts/themes/build.js";

/** Create a small palette configuration with chromatic families and neutral endpoints. */
export function createPaletteConfig() {
  return {
    chroma: { strength: 0.5, gamutFraction: 0.9 },
    families: { yellow: { hue: 90, lightness: 0.9, baseChroma: 0.075 }, blue: { hue: 255, lightness: 0.75 } },
    neutrals: { 900: 0.26, "000": 0.98, white: 1, black: 0 },
    overrides: {},
  };
}

/** Comment-bearing theme fixture with references in each supported color section. */
export const themeTemplate = `{
  "name": "Fixture",
  "type": "dark",
  "colors": {
    // Keep comments, including disabled {missing.reference} examples.
    "editor.background": "{surface.editor}", "editor.foreground": "{syntax.string}"
  },
  "semanticHighlighting": true,
  "semanticTokenColors": {
    "variable": "{syntax.string}",
    "function": { "foreground": "{syntax.string}", "italic": true }
  },
  "tokenColors": [{
    "name": "Ordered scopes", "scope": ["second", "first"],
    "settings": { "foreground": "{syntax.string}", "background": "{surface.editor}", "fontStyle": "bold italic" }
  }]
}`;

/** Ordered metadata and token-section names written by fixture builders. */
export const themePartNames = ["metadata", "tokens/ui", "tokens/semantic", "tokens/syntax"];

/** Top-level theme properties assigned to each fixture source section. */
const themePartGroups = {
  metadata: ["$schema", "name", "type", "author"],
  "tokens/ui": ["colors"],
  "tokens/semantic": ["semanticHighlighting", "semanticTokenColors"],
  "tokens/syntax": ["tokenColors"],
};

/**
 * Split a fixture template into source section files while preserving property source text.
 *
 * @param directory - Source or fixture directory to read or populate.
 * @param source - Source text to parse, inspect, or transform.
 */
async function writeThemeParts(directory, source) {
  /** Fixture template syntax tree used to retain property source slices. */
  const tree = parseTree(source);

  /** Original template properties indexed by their authored names. */
  const properties = new Map(
    (tree.children ?? []).map((property) => {
      /** Property-name node paired with its original authored source text. */
      const [key] = property.children;

      return [key.value, source.slice(property.offset, property.offset + property.length)];
    }),
  );

  await mkdir(join(directory, "tokens"), { recursive: true });

  for (const name of themePartNames) {
    /** Property source slices included in the current fixture section. */
    const part = themePartGroups[name].map((key) => properties.get(key)).filter(Boolean);

    await writeFile(join(directory, `${name}.jsonc`), `{\n${part.join(",\n")}\n}\n`);
  }
}

/**
 * Read a fixture’s metadata and token sections and assemble them into one theme template.
 *
 * @param directory - Source or fixture directory to read or populate.
 */
export async function readThemeParts(directory) {
  /** Normalized fixture source path or recursively visited output path. */
  const path = directory instanceof URL ? fileURLToPath(directory) : directory;

  /** Fixture section source texts read in assembly order. */
  const parts = await Promise.all(themePartNames.map((name) => readFile(join(path, `${name}.jsonc`), "utf8")));

  return assembleThemeTemplate(parts);
}

/** Create the minimal variable groups referenced by the shared fixture template. */
export function createVariables() {
  return {
    surface: { editor: { color: "palette.gray.900", alpha: 1 } },
    syntax: { string: { color: "palette.yellow.400", alpha: 1 } },
  };
}

/**
 * Create a temporary theme source project and return its root directory.
 *
 * @param t - Node.js test context used to register fixture cleanup.
 * @returns Root directory of the temporary source project.
 */
export async function createBuildProject(t) {
  /** Temporary project root containing source inputs and generated outputs. */
  const root = await mkdtemp(join(tmpdir(), "cassidy-build-"));

  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src/themes/prod/default/colors"), { recursive: true });
  await writeFile(join(root, "src/themes/prod/default/colors/palette.jsonc"), JSON.stringify(createPaletteConfig()));

  await writeFile(join(root, "src/themes/prod/default/colors/variables.jsonc"), JSON.stringify(createVariables()));

  await writeThemeParts(join(root, "src/themes/prod/default"), themeTemplate);
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      contributes: { themes: [] },
      extra: { preserved: true },
    }),
  );

  return root;
}

/**
 * Snapshot the manifest and generated files into a map for deterministic-output assertions.
 *
 * @param root - Repository or isolated project root directory.
 * @returns Generated file contents indexed by relative path.
 */
export async function readBuildOutputs(root) {
  /** Snapshot of manifest and generated artifact contents. */
  const files = new Map([["package.json", await readFile(join(root, "package.json"), "utf8")]]);

  /**
   * Recursively collect generated files, tolerating output directories that do not exist yet.
   *
   * @param relative - Path relative to the theme source or fixture root.
   */
  async function visit(relative) {
    /** Filesystem entries in the currently visited output directory. */
    let entries;

    try {
      entries = await readdir(join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;

      throw error;
    }

    for (const entry of entries) {
      /** Normalized fixture source path or recursively visited output path. */
      const path = `${relative}/${entry.name}`;

      if (entry.isDirectory()) {
        await visit(path);
      } else {
        files.set(path, await readFile(join(root, path), "utf8"));
      }
    }
  }

  for (const directory of ["themes", "dev-extension/generated-themes", "docs/palettes"]) await visit(directory);

  return files;
}

/**
 * Create generated themes and a separate destination for preview extension tests.
 *
 * @param t - Node.js test context used to register fixture cleanup.
 * @returns Project and extension paths with the source manifest and theme fixture.
 */
export async function createPreviewProject(t) {
  /** Temporary parent directory shared by the project and preview destination. */
  const directory = await mkdtemp(join(tmpdir(), "cassidy-theme-test-"));

  t.after(() => rm(directory, { recursive: true, force: true }));

  /** Temporary project root containing source inputs and generated outputs. */
  const root = join(directory, "project");

  /** Separate development-extension destination used by the fixture. */
  const extensionDirectory = join(directory, "extension");

  /** Minimal extension manifest with an installation identity to test removal. */
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

  for (const path of ["themes", "dev-extension/generated-themes", "dev-extension/static-snapshots", "images"]) {
    await mkdir(join(root, path), { recursive: true });
  }

  /** JSONC theme fixture with a comment and trailing comma. */
  const theme =
    '{ // Theme files allow comments and trailing commas.\n"name": "Cassidy Dark", "type": "dark", "colors": {}, "tokenColors": [], }';

  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, "themes/theme.json"), theme);
  await writeFile(join(root, "dev-extension/generated-themes/cassidy-dark-color-theme-test.json"), theme);
  await writeFile(join(root, "images/icon.png"), "fixture");

  return { root, extensionDirectory, manifest, theme };
}

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTree } from "jsonc-parser";
import { assembleThemeTemplate } from "../scripts/themes/build.js";

export function createPaletteConfig() {
  return {
    chroma: { strength: 0.5, gamutFraction: 0.9 },
    families: { yellow: { hue: 90, lightness: 0.9, baseChroma: 0.075 }, blue: { hue: 255, lightness: 0.75 } },
    neutrals: { 900: 0.26, "000": 0.98, white: 1, black: 0 },
    overrides: {},
  };
}

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

export const themePartNames = ["metadata", "tokens/ui", "tokens/semantic", "tokens/syntax"];

const themePartGroups = {
  metadata: ["$schema", "name", "type", "author"],
  "tokens/ui": ["colors"],
  "tokens/semantic": ["semanticHighlighting", "semanticTokenColors"],
  "tokens/syntax": ["tokenColors"],
};

async function writeThemeParts(directory, source) {
  const tree = parseTree(source);

  const properties = new Map(
    (tree.children ?? []).map((property) => {
      const [key] = property.children;

      return [key.value, source.slice(property.offset, property.offset + property.length)];
    }),
  );

  await mkdir(join(directory, "tokens"), { recursive: true });

  for (const name of themePartNames) {
    const part = themePartGroups[name].map((key) => properties.get(key)).filter(Boolean);

    await writeFile(join(directory, `${name}.jsonc`), `{\n${part.join(",\n")}\n}\n`);
  }
}

export async function readThemeParts(directory) {
  const path = directory instanceof URL ? fileURLToPath(directory) : directory;
  const parts = await Promise.all(themePartNames.map((name) => readFile(join(path, `${name}.jsonc`), "utf8")));

  return assembleThemeTemplate(parts);
}

export function createVariables() {
  return {
    surface: { editor: { color: "palette.gray.900", alpha: 1 } },
    syntax: { string: { color: "palette.yellow.400", alpha: 1 } },
  };
}

/** Create a temporary theme source project and return its root directory. */
export async function createBuildProject(t) {
  const root = await mkdtemp(join(tmpdir(), "cassidy-build-"));

  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "src/prod/themes/default/colors"), { recursive: true });
  await writeFile(join(root, "src/prod/themes/default/colors/palette.jsonc"), JSON.stringify(createPaletteConfig()));

  await writeFile(join(root, "src/prod/themes/default/colors/variables.jsonc"), JSON.stringify(createVariables()));

  await writeThemeParts(join(root, "src/prod/themes/default"), themeTemplate);
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

export async function readBuildOutputs(root) {
  const files = new Map([["package.json", await readFile(join(root, "package.json"), "utf8")]]);

  async function visit(relative) {
    let entries;

    try {
      entries = await readdir(join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;

      throw error;
    }

    for (const entry of entries) {
      const path = `${relative}/${entry.name}`;

      if (entry.isDirectory()) {
        await visit(path);
      } else {
        files.set(path, await readFile(join(root, path), "utf8"));
      }
    }
  }

  for (const directory of ["themes", "dev/themes", "docs/palettes"]) await visit(directory);

  return files;
}

/** Create generated themes and a separate destination for preview extension tests. */
export async function createPreviewProject(t) {
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

  for (const path of ["themes", "dev/themes", "dev/snapshots", "images"]) {
    await mkdir(join(root, path), { recursive: true });
  }

  const theme =
    '{ // Theme files allow comments and trailing commas.\n"name": "Cassidy Dark", "type": "dark", "colors": {}, "tokenColors": [], }';

  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, "themes/theme.json"), theme);
  await writeFile(join(root, "dev/themes/cassidy-dark-color-theme-test.json"), theme);
  await writeFile(join(root, "images/icon.png"), "fixture");

  return { root, extensionDirectory, manifest, theme };
}

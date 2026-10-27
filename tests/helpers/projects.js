/**
 * Temporary test projects.
 * @file Create isolated theme and extension fixtures and read their generated outputs for assertions.
 */

import { themeInputPaths } from "../../tooling/shared/paths.js";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { categories, decode } from "../../tooling/tokens/formats.js";
import { emptyFamily, recordPath, editSource } from "../../tooling/generators/source-edits.js";
import { parseJsonc } from "../../tooling/shared/jsonc.js";

/** Create a small palette configuration with chromatic families and neutral endpoints. */
export function createPaletteConfig() {
  return {
    chroma: { strength: 0.5, gamutFraction: 0.9 },
    families: { yellow: { hue: 90, lightness: 0.9, baseChroma: 0.075 }, blue: { hue: 255, lightness: 0.75 } },
    neutrals: { 900: 0.26, "000": 0.98, white: 1, black: 0 },
    overrides: {},
  };
}

/**
 * Create a theme directory with an explicit selection of the default palette.
 * @param directory - Theme source directory to populate.
 */
export async function writeDefaultPaletteConfig(directory) {
  await mkdir(join(directory, "palette"), { recursive: true });
  await writeFile(join(directory, "palette/config.jsonc"), '{"useDefaultPalette":true}\n');
}

/** Required default source paths without the JSONC filename extension. */
export const themePartNames = themeInputPaths.map((path) => path.replace(/\.jsonc$/, ""));

/** Create consolidated tokens exercising references, formatting, backgrounds, and scope order. */
export function createTokens() {
  return {
    variables: { surface: { editor: { color: "palette.gray.900" } } },
    ui: {
      "editor.background": { color: "variables.surface.editor" },
      "editor.foreground": { color: "syntax.string" },
    },
    semantic: {
      variable: { color: "syntax.string" },
      function: { color: "syntax.string", italic: true },
    },
    syntax: [
      {
        id: "string",
        name: "Ordered scopes",
        scope: ["second", "first"],
        color: "palette.yellow.400",
        background: { color: "variables.surface.editor" },
        fontStyle: "bold italic",
      },
    ],
  };
}

/** Create independent empty documentation sections. */
export function createDetails() {
  return { variables: {}, ui: {}, semantic: {}, syntax: {} };
}

/**
 * Read all effective authored inputs from a complete fixture or default theme directory.
 * @param directory - Source directory path or URL.
 * @returns Metadata, token sections, and separate documentation sections.
 */
export async function readThemeParts(directory) {
  /** Normalized source directory path. */
  const path = directory instanceof URL ? fileURLToPath(directory) : directory;

  /** Independently parsed metadata, tokens, and documentation. */
  const parts = { tokens: {}, details: {} };

  for (const name of themePartNames) {
    /** Parsed authored input with duplicate-key validation. */
    const value = parseJsonc(await readFile(join(path, `${name}.jsonc`), "utf8"), name).value;

    if (name === "metadata") {
      parts.metadata = JSON.parse(JSON.stringify(value));
    } else {
      /** Section group and name associated with this authored input. */
      const [group, section, kind] = name.split("/");
      parts[kind === "details" ? "details" : group][section] = JSON.parse(
        JSON.stringify(decode({ value, label: name }, section, kind).value),
      );
    }
  }

  return parts;
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
  /** Complete default inputs required by all full-theme fixture builds. */
  const inputs = {
    metadata: { name: "Fixture", type: "dark", semanticHighlighting: true },
    tokens: createTokens(),
    details: {
      variables: { "surface.editor": { description: "Shared editor surface." } },
      ui: {
        "editor.background": { description: "Editor background." },
        "editor.foreground": { description: "Editor foreground." },
      },
      semantic: {
        variable: { description: "Semantic variables." },
        function: { description: "Semantic functions." },
      },
      syntax: { string: { description: "Ordered string scopes." } },
    },
  };

  for (const directory of ["palette", "tokens", "details"]) {
    await mkdir(join(root, "src/themes/prod/default", directory), { recursive: true });
  }

  await writeFile(join(root, "src/themes/prod/default/palette/config.jsonc"), JSON.stringify(createPaletteConfig()));

  for (const name of themePartNames) {
    /** Group and section used to select the fixture input. */
    const [group, section, kind] = name.split("/");

    await mkdir(join(root, "src/themes/prod/default", name, ".."), { recursive: true });
    await writeFile(
      join(root, "src/themes/prod/default", `${name}.jsonc`),
      fixtureSource(
        join(root, "src/themes/prod/default", `${name}.jsonc`),
        JSON.stringify(section ? inputs[kind === "details" ? "details" : group][section] : inputs[group]),
      ),
    );
  }

  for (const family of ["ui", "semantic", "syntax"]) {
    for (const kind of family === "syntax" ? ["details"] : ["definitions", "details"]) {
      await writeFixture(
        join(root, `src/token-data/${family}/${kind}.jsonc`),
        JSON.stringify(emptyFamily(family, kind)),
      );
    }
  }

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
      } else if (
        !path.startsWith("src/") ||
        path.includes("/palette/generated/") ||
        path.endsWith("/palette/default-palette.txt")
      ) {
        files.set(path, await readFile(join(root, path), "utf8"));
      }
    }
  }

  for (const directory of ["themes", "preview/themes", "src/themes", "docs/references/palettes"])
    await visit(directory);

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

  for (const path of ["themes", "preview/themes", "preview/snapshots", "images"]) {
    await mkdir(join(root, path), { recursive: true });
  }

  /** JSONC theme fixture with a comment and trailing comma. */
  const theme =
    '{ // Theme files allow comments and trailing commas.\n"name": "Cassidy Dark", "type": "dark", "colors": {}, "tokenColors": [], }';

  await writeFile(join(root, "package.json"), JSON.stringify(manifest));
  await writeFile(join(root, "themes/theme.json"), theme);
  await writeFile(join(root, "preview/themes/cassidy-dark-color-theme-test.json"), theme);
  await writeFile(join(root, "images/icon.png"), "fixture");

  return { root, extensionDirectory, manifest, theme };
}

/**
 * Write fixture text after creating its parent directories.
 * @param path - Fixture destination.
 * @param source - Complete fixture source.
 * @param [options] - Standard filesystem write options.
 */
export async function writeFixture(path, source, options) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, fixtureSource(path, source), options);
}

/**
 * Encode intentionally compact fixture records into the supported categorized source shape.
 * @param path - Final fixture filename identifies family and file role.
 * @param source - Compact test data or deliberately malformed source.
 */
function fixtureSource(path, source) {
  /** Supported fixture family and file role, kept outside production readers. */
  const match = path.match(/\/(?:tokens|token-data)\/(ui|semantic|syntax|variables)\/(definitions|details)\.jsonc$/);

  if (!match || typeof source !== "string") return source;

  /** Compact fixture values; malformed JSONC remains available to negative workflow tests. */
  let parsed;

  try {
    parsed = parseJsonc(source, path);
  } catch {
    return source;
  }

  /** Family context and fixture-only placeholder wrapper. */
  const [, family, kind] = match;
  const value = parsed.value;

  if (family === "variables" || categories.some((category) => Object.hasOwn(value, category))) return source;

  /** Final shape starts with all required empty categories. */
  let output = JSON.stringify(emptyFamily(family, kind));

  if (family === "syntax" && kind === "definitions") {
    if (!Array.isArray(value)) return source;

    return editSource(
      output,
      ["standard", "rules"],
      value.map((rule, order) => ({ ...rule, order })),
    );
  }

  /** Independent fixture authorities use nonStandard for custom test IDs. */
  const records = value.colors ?? value.semanticTokenColors ?? value;

  if (!records || typeof records !== "object" || Array.isArray(records)) return source;

  for (const [id, record] of Object.entries(records)) {
    /** Source metadata is never used as styling; reference values are discovery placeholders. */
    const candidate =
      path.includes("/token-data/") && kind === "definitions"
        ? { color: "#0ff", colorReason: "UNREVIEWED: Added from a token template; choose an intentional color." }
        : record;

    output = editSource(output, recordPath(family, family === "syntax" ? "standard" : "nonStandard", id), candidate);
  }

  return output;
}

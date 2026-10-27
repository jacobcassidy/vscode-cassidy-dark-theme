/**
 * Theme and palette builds.
 * @file Assemble theme inputs, resolve colors, generate reports, and write or check build outputs.
 */

import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { logReloadReminder, syncDevExtension } from "../preview/sync.js";
import { formatMessage } from "../shared/terminal-output.js";
import { fields, object, parseJsonc } from "../shared/jsonc.js";
import { generatePalette } from "../palette/generation.js";
import { compileTokens, renderTheme } from "../tokens/compilation.js";
import { applyArtifacts, assertFresh, capturePaths, requireStable, withGuards } from "../shared/transactions.js";
import { contrastRatio } from "../shared/color-math.js";
import {
  discoverTargets,
  defaultThemeDirectory,
  listDirectories,
  listFiles,
  readOptional,
  readTargetInput,
  paletteInputPath,
  prodThemeContribution,
  themeInputPaths,
  themeSections,
  themeUiType,
} from "./inputs.js";

/** Repository root inferred from the build module’s location. */
const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Load independent whole-file inputs and compile one target’s effective token sections.
 * @param root - Repository or isolated project root directory.
 * @param target - Discovered target and source paths.
 * @param palette - Generated palette records for this target.
 * @param command - Rebuild command included in the output notice.
 * @returns Compiled theme JSONC with all input labels attached to diagnostics.
 */
async function readCompiledTheme(root, target, palette, command, readInput) {
  /** Effective authored inputs indexed by their independent relative paths. */
  const inputs = new Map();

  for (const path of themeInputPaths) {
    inputs.set(path, await readInput(target, path));
  }

  try {
    /** Consolidated token sections in compilation order. */
    const tokens = {};

    /** Independently inherited documentation sections. */
    const details = {};

    for (const section of themeSections) {
      tokens[section] = inputs.get(`tokens/${section}.jsonc`).value;
      details[section] = inputs.get(`details/${section}.jsonc`).value;
    }

    /** Effective metadata validated before compilation and registration. */
    const metadata = inputs.get("metadata.jsonc");

    object(metadata.value, metadata.label);
    themeUiType(metadata.value, metadata.label);

    return renderTheme(
      metadata.value,
      compileTokens(tokens, details, palette, target.directory === defaultThemeDirectory),
      command,
    );
  } catch (error) {
    throw new Error(`${[...inputs.values()].map((input) => input.label).join("; ")}: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Validate the structure and color-bearing fields of a resolved theme.
 *
 * @param theme - Parsed theme object to validate.
 */
function validateTheme(theme) {
  object(theme, "theme");
  object(theme.colors, "theme.colors");

  if (!Array.isArray(theme.tokenColors)) throw new Error("theme.tokenColors must be an array");

  if (theme.semanticHighlighting !== undefined && typeof theme.semanticHighlighting !== "boolean") {
    throw new Error("theme.semanticHighlighting must be a boolean");
  }

  for (const [key, value] of Object.entries(theme.colors)) {
    if (typeof value !== "string") throw new Error(`theme.colors.${key} must be a string`);
  }

  if (theme.semanticTokenColors !== undefined) {
    object(theme.semanticTokenColors, "theme.semanticTokenColors");

    for (const [key, value] of Object.entries(theme.semanticTokenColors)) {
      if (typeof value !== "string") {
        object(value, `semantic token ${key}`);

        if (value.foreground !== undefined && typeof value.foreground !== "string") {
          throw new Error(`semantic token ${key}.foreground must be a string`);
        }
      }
    }
  }

  for (const [index, rule] of theme.tokenColors.entries()) {
    object(rule, `tokenColors[${index}]`);
    object(rule.settings, `tokenColors[${index}].settings`);

    if (
      rule.scope !== undefined &&
      typeof rule.scope !== "string" &&
      !(Array.isArray(rule.scope) && rule.scope.every((scope) => typeof scope === "string"))
    ) {
      throw new Error(`tokenColors[${index}].scope must be a string or array of strings`);
    }

    for (const key of ["foreground", "background"]) {
      if (rule.settings[key] !== undefined && typeof rule.settings[key] !== "string") {
        throw new Error(`tokenColors[${index}].settings.${key} must be a string`);
      }
    }
  }
}

/**
 * Format an OKLCH measurement with stable precision for generated reports.
 *
 * @param color - Color components or value used by this conversion or grammar probe.
 */
function oklch(color) {
  return `oklch(${(color.l * 100).toFixed(3)}% ${color.c.toFixed(6)} ${color.h.toFixed(3)})`;
}

/**
 * Escape text for use in generated SVG text and attribute values.
 *
 * @param text - Text to escape for SVG text nodes and attribute values.
 */
function xml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

/**
 * Create palette JSON measurements, Markdown contrast tables, and SVG swatches with provenance.
 *
 * @param palette - Generated palette records keyed by primitive identifier.
 * @param target - Discovered theme target and its source/output locations.
 * @param input - Parsed input and its source metadata, or the value used by a grammar probe.
 * @param notice - Rebuild command embedded in the generated-file notice.
 * @returns Generated report source indexed by output path.
 */
function reports(palette, target, input, notice) {
  /** Output directory for the target’s generated palette reports. */
  const directory = target.reportDirectory;

  /** Source path, target, fallback status, and rebuild command recorded in reports. */
  const provenance = {
    target: `${target.group}/${target.name}`,
    source: input.path,
    fallback: input.fallback,
    rebuild: notice,
  };

  /** Serializable palette measurements rounded to stable report precision. */
  const primitives = Object.fromEntries(
    [...palette].map(([id, color]) => [
      id,
      {
        ...color,
        target: Object.fromEntries(Object.entries(color.target).map(([key, value]) => [key, Number(value.toFixed(6))])),
        resolved: Object.fromEntries(
          Object.entries(color.resolved).map(([key, value]) => [key, Number(value.toFixed(6))]),
        ),
        exported: Object.fromEntries(
          Object.entries(color.exported).map(([key, value]) => [key, Number(value.toFixed(6))]),
        ),
      },
    ]),
  );

  /** Markdown rows comparing tone 600 colors against the report foreground. */
  const contrastRows = [...palette]
    .filter(([id]) => id.split(".")[1] !== "gray" && id.endsWith(".600"))
    .map(([id, color]) => {
      /** Foreground/background contrast, or null when compositing is required. */
      const ratio = contrastRatio("#f8f8f8", color.hex);
      return `| \`${id}\` | \`${color.hex}\` | ${ratio === null ? "Needs backdrop" : `${ratio.toFixed(2)}:1`} |`;
    });

  /** Generated palette reference and contrast report. */
  const markdown = [
    "# Generated palette",
    "",
    `Generated by \`${notice}\` for \`${provenance.target}\`. Source: \`${input.path}\`${input.fallback ? " (default fallback)" : ""}. Edit the palette source and rebuild.`,
    "",
    "![Palette swatches](palette.svg)",
    "",
    "## Tone 600 contrast",
    "",
    "Foreground: `#f8f8f8`. Ratios use [WCAG relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance) from the exported sRGB hex values, rounded to two decimal places. Translucent backgrounds need a backdrop before their contrast can be calculated.",
    "",
    "| Token | Background | Contrast with #f8f8f8 |",
    "| --- | --- | --- |",
    ...contrastRows,
    "",
    "## Full palette",
    "",
    "Target is the requested color; resolved includes gamut limits or overrides; exported is measured from the rounded hex.",
    "",
    "| Token | Target OKLCH | Resolved OKLCH | Hex | Exported OKLCH | Color reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...[...palette].map(
      ([id, color]) =>
        `| \`${id}\` | ${oklch(color.target)} | ${oklch(color.resolved)} | \`${color.hex}\` | ${oklch(color.exported)} | ${(color.colorReason ?? "").replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ")} |`,
    ),
    "",
  ].join("\n");

  /** Palette hex values grouped by family and tone for SVG rendering. */
  const families = new Map();

  for (const [id, color] of palette) {
    /** Family and tone segments extracted from a palette identifier. */
    const [, family, tone] = id.split(".");
    if (!families.has(family)) families.set(family, new Map());
    families.get(family).set(tone, color.hex);
  }

  /** Non-neutral families rendered as labeled SVG rows. */
  const chromatic = [...families].filter(([family]) => family !== "gray");

  /** Neutral tone/hex pairs rendered below the chromatic families. */
  const gray = [...(families.get("gray") ?? [])];

  /** Number of five-column rows required for neutral swatches. */
  const grayRows = Math.ceil(gray.length / 5);

  /** SVG canvas height calculated from the number of palette rows. */
  const height = 74 + chromatic.length * 76 + (grayRows ? 38 + grayRows * 76 : 0);

  /** SVG source fragments accumulated before joining the final report. */
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}" role="img" aria-labelledby="title description">`,
    '<title id="title">Cassidy Dark generated palette</title>',
    `<!-- Generated by ${notice} for ${provenance.target}. Source: ${input.path}${input.fallback ? " (default fallback)" : ""}. -->`,
    '<desc id="description">Rows show each color family with tones 300, 400, 500, 600, and 400-muted, followed by neutral swatches. Every swatch includes its hex value.</desc>',
    `<rect width="760" height="${height}" fill="#242424"/>`,
    '<g font-family="monospace" font-size="13" fill="#f8f8f8">',
    '<text x="20" y="28">Cassidy Dark · Generated palette</text>',
  ];

  for (const [index, tone] of ["300", "400", "500", "600", "400-muted"].entries()) {
    svg.push(`<text x="${132 + index * 122}" y="55">${tone}</text>`);
  }

  for (const [row, [name, colors]] of chromatic.entries()) {
    /** Vertical coordinate of the current SVG swatch row. */
    const y = 70 + row * 76;

    svg.push(`<text x="20" y="${y + 24}">${xml(name)}</text>`);

    for (const [column, tone] of ["300", "400", "500", "600", "400-muted"].entries()) {
      /** Horizontal coordinate of the current SVG swatch. */
      const x = 132 + column * 122;

      /** Resolved hex color for the current reference or swatch. */
      const hex = colors.get(tone);

      svg.push(
        `<rect x="${x}" y="${y}" width="108" height="38" rx="3" fill="${hex}"/><text x="${x}" y="${y + 57}">${hex}</text>`,
      );
    }
  }

  /** Vertical starting position of the neutral section. */
  const start = 86 + chromatic.length * 76;

  if (gray.length) svg.push(`<text x="20" y="${start}">Neutrals</text>`);

  for (const [index, [tone, hex]] of gray.entries()) {
    /** Horizontal coordinate of the current SVG swatch. */
    const x = 20 + (index % 5) * 146;

    /** Vertical coordinate of the current SVG swatch row. */
    const y = start + 16 + Math.floor(index / 5) * 76;

    svg.push(
      `<rect x="${x}" y="${y}" width="132" height="32" rx="3" fill="${hex}"/><text x="${x}" y="${y + 49}">${xml(tone)} ${hex}</text>`,
    );
  }

  svg.push("</g></svg>\n");

  return new Map([
    [`${directory}/palette.json`, `${JSON.stringify({ generated: provenance, primitives }, null, 2)}\n`],
    [`${directory}/palette.md`, markdown],
    [`${directory}/palette.svg`, svg.join("\n")],
  ]);
}

/**
 * Apply repository formatting to generated text, preserving SVG and using JSONC for theme files.
 *
 * @param root - Repository or isolated project root directory.
 * @param path - Output path or JSON property path inspected by the current build helper.
 * @param source - Authored or generated JSONC source text for this build phase.
 */
async function formatted(root, path, source) {
  if (path.endsWith(".svg") || path.endsWith(".txt")) return source;

  /** Absolute output path used to select Prettier configuration. */
  const filepath = join(root, path);

  /** Formatter settings resolved for this output file. */
  const options = await prettier.resolveConfig(filepath);

  /** Whether this output needs JSONC theme formatting. */
  const theme = path.startsWith("themes/") || path.startsWith("dev-extension/themes/");
  return prettier.format(source, { ...options, filepath, ...(theme ? { parser: "jsonc" } : {}) });
}

/**
 * Resolve one target’s palette and optional theme into validated, in-memory output candidates.
 *
 * @param root - Repository or isolated project root directory.
 * @param target - Discovered theme target and its source/output locations.
 * @param paletteOnly - Whether to generate palette reports without compiling token sections.
 * @param [defaultPalette] - Already validated default palette available to other themes.
 */
async function prepareTarget(root, target, paletteOnly, defaultPalette, readInput) {
  /** Required target-local configuration selecting a custom or default palette. */
  const input = await readInput(target, paletteInputPath);

  /** Validated palette generated before compiling theme tokens. */
  let palette;

  try {
    object(input.value, input.label);

    if (Object.hasOwn(input.value, "useDefaultPalette") && typeof input.value.useDefaultPalette !== "boolean") {
      throw new Error("useDefaultPalette must be a boolean");
    }

    if (input.value.useDefaultPalette) {
      fields(input.value, ["useDefaultPalette", "chroma", "families", "neutrals", "overrides"], "palette");

      if (!defaultPalette)
        throw new Error("The default theme must define its own palette; useDefaultPalette cannot reference itself");

      palette = defaultPalette;
    } else {
      /** Complete generation settings, excluding the optional explicit false selection flag. */
      const config = { ...input.value };
      delete config.useDefaultPalette;
      palette = generatePalette(config);
    }
  } catch (error) {
    throw new Error(`${input.label}: ${error.message}`, { cause: error });
  }

  /** Rebuild command used in generated notices and stale-output errors. */
  const command = target.group === "prod" ? "npm run build:prod" : "npm run build:dev";

  /** In-memory artifacts; null values schedule removal of obsolete palette files or directories. */
  const output = input.value.useDefaultPalette
    ? new Map([
        [
          `${target.directory}/palette/default-palette.txt`,
          `No palette is generated for ${target.group}/${target.name} because the default palette is being used.\nDefault palette configuration: ${defaultThemeDirectory}/${paletteInputPath}\nGenerated default palette: ${defaultThemeDirectory}/palette/generated/\n`,
        ],
        [target.reportDirectory, null],
      ])
    : reports(palette, target, input, target.group === "prod" ? "npm run build:palette" : command);

  if (!input.value.useDefaultPalette) {
    output.set(`${target.directory}/palette/default-palette.txt`, null);
    output.set(`${target.reportDirectory}/default.txt`, null);
  }

  /** Resolved theme metadata used to build manifest registrations. */
  let metadata;

  if (!paletteOnly) {
    /** Generated JSONC after validating effective tokens, details, and cross-section aliases. */
    const rendered = await readCompiledTheme(root, target, palette, command, readInput);
    output.set(target.output, rendered);
    metadata = parseJsonc(rendered, target.output).value;
  }

  return { ...target, palette, outputs: output, metadata };
}

/**
 * Update production registrations through source edits while preserving unrelated manifest data.
 *
 * @param root - Repository or isolated project root directory.
 * @param targets - Theme targets participating in the selected build or validation pass.
 */
async function prodManifestOutput(root, targets) {
  /** Production manifest path relative to the repository root. */
  const path = "package.json";

  /** Original manifest text retained for comment-preserving registration edits. */
  const source = await readFile(join(root, path), "utf8");

  /** Parsed production manifest whose unrelated properties are preserved. */
  const manifest = parseJsonc(source, path).value;

  object(manifest, path);

  if (manifest.contributes !== undefined) object(manifest.contributes, "package.json.contributes");

  /** Updated production registrations retaining existing entry metadata. */
  const themes = targets.map((target) => {
    /** Generated registration fields for one production target. */
    const contribution = prodThemeContribution(target, target.metadata);

    /** Existing manifest registration matched by its generated theme path. */
    const existing = manifest.contributes?.themes?.find((entry) => entry.path === contribution.path);
    return { ...existing, ...contribution };
  });

  /** Source labels or display labels checked during this build phase. */
  const labels = themes.map((theme) => theme.label);

  if (new Set(labels).size !== labels.length) throw new Error("Prod theme labels must be unique");

  return applyEdits(source, modify(source, ["contributes", "themes"], themes, {}));
}

/**
 * Identify header-verified stale theme files and reject other unowned generated outputs.
 *
 * @param root - Repository or isolated project root directory.
 * @param targets - Theme targets participating in the selected build or validation pass.
 * @param group - Nested color variable group or selected prod/dev build group.
 * @param paletteOnly - Whether to generate palette reports without compiling token sections.
 * @returns Stale theme paths verified as generated by the selected build group.
 */
async function staleOutputs(root, targets, group, paletteOnly) {
  /** Targets selected for the current prod or dev build group. */
  const selected = targets.filter((target) => target.group === group);

  /** Theme and palette artifact paths allowed for the selected target group. */
  const expected = new Set(selected.flatMap((target) => [...target.outputs.keys()]));

  /** Generated artifact paths found on disk for stale-output checks. */
  const actual = [];

  /** Generated theme directory belonging to the selected build group. */
  const themeDirectory = group === "prod" ? "themes" : "dev-extension/themes";

  if (!paletteOnly) {
    for (const file of await listFiles(join(root, themeDirectory))) {
      if (file.endsWith(".json")) actual.push(`${themeDirectory}/${file}`);
    }
  }

  /** Source directory containing reports for the selected target group. */
  const sourceDirectory = `src/themes/${group}`;

  for (const name of await listDirectories(join(root, sourceDirectory), group === "dev")) {
    for (const file of await listFiles(join(root, sourceDirectory, name, "palette", "generated"))) {
      actual.push(`${sourceDirectory}/${name}/palette/generated/${file}`);
    }
  }

  /** Existing output paths that no current selected target owns. */
  const stale = actual.filter(
    (path) =>
      !expected.has(path) &&
      !selected.some(
        (target) =>
          target.outputs.get(target.reportDirectory) === null && path.startsWith(`${target.reportDirectory}/`),
      ),
  );

  /** Exact ownership marker emitted by the selected group's theme renderer. */
  const header = `// Generated by npm run build:${group}. Edit the corresponding inputs and rebuild.`;

  /** Stale theme files whose matching header permits automatic cleanup. */
  const removable = [];

  /** Files lacking a matching theme header, including unexpected palette artifacts. */
  const protectedFiles = [];

  for (const path of stale) {
    if (path.startsWith(`${themeDirectory}/`)) {
      /** First line normalized for an optional UTF-8 BOM and CRLF line endings. */
      const firstLine = (await readFile(join(root, path), "utf8")).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];

      if (firstLine === header) {
        removable.push(path);

        continue;
      }
    }

    protectedFiles.push(path);
  }

  if (protectedFiles.length) {
    throw new Error(
      `Stale generated outputs: ${protectedFiles.join(", ")}. Remove them explicitly or restore their theme sources.`,
    );
  }

  return removable;
}

/**
 * Check whether an artifact exists, including empty directories and dangling symlinks.
 * @param path - Absolute artifact path to inspect without following symlinks.
 * @returns Whether the path exists.
 */
async function artifactExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * Format and validate all output candidates before checking or atomically replacing changed files.
 *
 * @param root - Repository or isolated project root directory.
 * @param output - Output path-to-source map, with null marking obsolete files or palette directories for removal.
 * @param check - Whether to report stale artifacts without writing files.
 * @param command - Rebuild command included in stale-output diagnostics.
 */
async function checkOutputs(root, output, check, command) {
  for (const [path, source] of output) {
    if (source === null) continue;

    /** Formatted generated source ready for validation and comparison. */
    const text = await formatted(root, path, source);

    if (path.startsWith("themes/") || path.startsWith("dev-extension/themes/")) {
      validateTheme(parseJsonc(text, path).value);
    }

    output.set(path, text);
  }

  /** Generated output paths whose contents differ from the prepared result. */
  const changed = [];

  for (const [path, text] of output) {
    /** Existence of scheduled removals or contents of files to replace, checked before any writes. */
    const existing = text === null ? await artifactExists(join(root, path)) : await readOptional(join(root, path));
    if (text === null ? existing : existing !== text) changed.push(path);
  }

  if (check && changed.length) {
    /** Scheduled removals described without changing the filesystem in check mode. */
    const removed = changed.filter((path) => output.get(path) === null);

    throw new Error(
      `Generated output is missing or stale: ${changed.join(", ")}.${removed.length ? ` Pending removals: ${removed.join(", ")}.` : ""} Run ${command}.`,
    );
  }

  if (check) return changed;

  return changed;
}

/**
 * Prepare both selected groups once, retaining one stable input snapshot and artifact map.
 * @param [options] - Preparation options.
 * @param [options.root] - Isolated project or checkout root.
 * @param [options.mode] - all, prod, dev, or palette.
 */
export async function prepareBuild({ root = defaultRoot, mode = "all" } = {}) {
  if (!["all", "prod", "dev", "palette"].includes(mode)) throw new Error(`Unknown build mode: ${mode}`);

  /** Read-only boundary check and complete dependency fingerprints. */
  const generation = await requireStable(root);
  const expected = await capturePaths([
    join(root, "src"),
    join(root, "package.json"),
    join(root, "themes"),
    join(root, "dev-extension"),
  ]);
  const targets = await discoverTargets(root);
  const defaultTarget = targets.find((target) => target.directory === defaultThemeDirectory);
  const cache = new Map();

  /**
   * Reuse independently inherited parsed files throughout this pass.
   * @param target - Current target.
   * @param path - Independent family or palette input.
   */
  async function readInput(target, path) {
    /** Target/path cache identity includes fallback diagnostics. */
    const key = `${target.directory}/${path}`;

    if (!cache.has(key)) cache.set(key, readTargetInput(root, target, path));

    return cache.get(key);
  }

  /** Default work is shared by prod and dev targets in a combined pass. */
  const paletteOnly = mode === "palette";
  const baseline = await prepareTarget(root, defaultTarget, paletteOnly, undefined, readInput);
  const selected = [],
    output = new Map();

  for (const target of targets.filter(
    (candidate) => mode === "all" || candidate.group === (mode === "palette" ? "prod" : mode),
  )) {
    /** Each required target compiles at most once. */
    const prepared =
      target === defaultTarget ? baseline : await prepareTarget(root, target, paletteOnly, baseline.palette, readInput);

    selected.push(prepared);

    for (const [path, text] of prepared.outputs) output.set(path, text);
  }

  if ((mode === "all" || mode === "prod") && !paletteOnly)
    output.set(
      "package.json",
      await prodManifestOutput(
        root,
        selected.filter((target) => target.group === "prod"),
      ),
    );

  for (const group of ["prod", "dev"].filter((group) => mode === "all" || group === (paletteOnly ? "prod" : mode))) {
    for (const path of await staleOutputs(root, selected, group, paletteOnly)) output.set(path, null);
  }

  await checkOutputs(root, output, false, "npm run build");
  await assertFresh(expected);

  if (JSON.stringify(await requireStable(root)) !== JSON.stringify(generation))
    throw Object.assign(new Error("Stale application generation; retry the build."), { code: "STALE_INPUT" });

  return { root, mode, output, expected, selected, palette: baseline.palette };
}

/**
 * Check or apply the same completely prepared map without recompiling.
 * @param prepared - Stable result of prepareBuild.
 * @param [options] - Application options.
 * @param [options.check] - Read-only comparison mode.
 * @param [options.operations] - Narrow filesystem adapter for failure tests.
 */
export async function applyBuild(prepared, { check = false, operations } = {}) {
  /** Validated immutable preparation data. */
  const { root, output, expected, selected, palette } = prepared;

  /** Changed paths returned by comparison or coordinated application. */
  const changed = check
    ? await checkOutputs(root, output, true, "npm run build")
    : await withGuards([root], async ([owner]) => applyArtifacts({ root, output, expected, owner, operations }));

  return {
    changed,
    removed: changed.filter((path) => output.get(path) === null),
    palette,
    targets: selected.map((target) => ({
      name: target.name,
      group: target.group,
      output: target.output,
      palette: target.palette,
      changed: changed.filter((path) => target.outputs.has(path)),
    })),
  };
}

/**
 * Prepare and apply a selected build pass without preview side effects.
 * @param [options] - Build options including root, mode, and check.
 */
export async function buildThemes(options = {}) {
  return applyBuild(await prepareBuild(options), options);
}

/**
 * Build the production group through the common prepared workflow.
 * @param [options] - Build options including paletteOnly.
 */
export async function buildProdThemes(options = {}) {
  return buildThemes({ ...options, mode: options.paletteOnly ? "palette" : "prod" });
}

/**
 * Build the development group through the common prepared workflow.
 * @param [options] - Build options.
 */
export async function buildDevThemeSummary(options = {}) {
  return buildThemes({ ...options, mode: "dev" });
}

/**
 * Return development target summaries for existing programmatic consumers.
 * @param [options] - Build options.
 */
export async function buildDevThemes(options = {}) {
  return (await buildDevThemeSummary(options)).targets;
}

/**
 * Print a build summary and its changed files, separating target groups and following summaries.
 *
 * @param summary - Summary line to print before the generated paths.
 * @param targets - Theme targets and their changed output paths.
 * @param changedFiles - All changed output paths counted in the summary.
 * @param removedFiles - Removed output paths labeled explicitly in the listing.
 * @param hasFollowingSummary - Whether another build summary follows this one.
 * @param logger - Logger receiving build progress and generated paths.
 */
function logSummary(summary, targets, changedFiles, removedFiles, hasFollowingSummary, logger) {
  logger.log(formatMessage(summary, "success"));

  /** Removed artifacts distinguished from rewritten outputs. */
  const removed = new Set(removedFiles);

  /** Changed output paths assigned to a specific theme target. */
  const assigned = new Set(targets.flatMap((target) => target.changed));

  for (const target of targets) {
    for (const path of target.changed) {
      logger.log(formatMessage(`  ${path}${removed.has(path) ? " (removed)" : ""}`, "file"));
    }
  }

  for (const path of changedFiles) {
    if (!assigned.has(path)) logger.log(formatMessage(`  ${path}${removed.has(path) ? " (removed)" : ""}`, "file"));
  }

  if (hasFollowingSummary) logger.log();
}

/**
 * Run a command-line build workflow and synchronize previews after successful theme builds.
 * @param [options] - Build selection and isolated preview options.
 * @param [options.root] - Repository or fixture root; defaults to this checkout.
 * @param [options.extensionDirectory] - Preview destination; defaults to the standard VS Code extension directory.
 * @param [options.mode] - Build selection: all, prod, dev, or palette.
 * @param [options.check] - Whether to validate generated outputs without synchronizing previews.
 * @param [options.logger] - Logger receiving progress, changed paths, and reload reminders.
 * @returns Preview synchronization result, or undefined for checks and palette-only builds.
 */
export async function runBuild({
  root = defaultRoot,
  extensionDirectory,
  mode = "all",
  check = false,
  logger = console,
} = {}) {
  if (!["all", "prod", "dev", "palette"].includes(mode)) throw new Error(`Unknown build mode: ${mode}`);

  logger.log(formatMessage(`${check ? "Checking" : "Building"} ${mode} themes...`, "heading"));

  /** Both groups validate before the first replacement. */
  const result = await buildThemes({ root, mode, check });

  logSummary(
    `${check ? "Validated" : "Built"} ${result.targets.length} themes; ${result.changed.length - result.removed.length} generated files updated${result.removed.length ? `; ${result.removed.length} generated output${result.removed.length === 1 ? "" : "s"} removed` : ""}.`,
    result.targets,
    result.changed,
    result.removed,
    false,
    logger,
  );

  if (check || mode === "palette") return;

  /** Applied preview changes and their reload requirement. */
  let preview;

  try {
    preview = await syncDevExtension({ root, extensionDirectory });
  } catch (error) {
    throw Object.assign(
      new Error(`Build completed; preview synchronization failed: ${error.message}. Retry npm run sync:preview.`, {
        cause: error,
      }),
      { code: "PREVIEW_SYNC_FAILED" },
    );
  }

  logger.log(formatMessage(`Synced dev manifest: ${preview.manifestPath}`, "success"));

  if (preview.reloadRequired) logReloadReminder(logger);

  return preview;
}

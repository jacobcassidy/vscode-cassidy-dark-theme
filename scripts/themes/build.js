/**
 * Theme and palette builds.
 * @file Assemble theme inputs, resolve colors, generate reports, and write or check build outputs.
 */

import { readFile, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify, parseTree } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { object, parseJsonc } from "../lib/jsonc-validation.js";
import { generatePalette } from "../lib/palette-generation.js";
import { resolveTokens } from "../lib/color-variable-resolution.js";
import { contrastRatio, validateHex } from "../lib/color-math.js";
import {
  discoverTargets,
  listDirectories,
  listFiles,
  readOptional,
  readTargetInput,
  prodThemeContribution,
  themeInputPaths,
  validateThemePart,
} from "../lib/theme-source-inputs.js";

/** Repository root inferred from the build module’s location. */
const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));

/** ANSI styles used to distinguish build status messages in terminal output. */
const styles = {
  yellow: "\u001b[33m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  dim: "\u001b[2m",
  reset: "\u001b[0m",
};

/** Apply an ANSI style to a build message. */
function styled(message, style) {
  return `${style}${message}${styles.reset}`;
}

/** Top-level token sections that must not appear in metadata inputs. */
const themeSections = new Set(["colors", "semanticHighlighting", "semanticTokenColors", "tokenColors"]);

/**
 * Extract top-level properties as source slices so theme comments and formatting survive assembly.
 *
 * @param source - Authored or generated JSONC source text for this build phase.
 * @param label - Human-readable context included in validation diagnostics.
 */
function templateProperties(source, label) {
  /** Parsed syntax tree used to preserve authored property source text. */
  const tree = parseTree(source, [], { allowTrailingComma: true });

  if (tree?.type !== "object") throw new Error(`${label} must contain a JSONC object`);

  return (tree.children ?? []).map((property) => {
    /** Property-name node paired with its original authored source text. */
    const [key] = property.children;

    return { key: key.value, source: source.slice(property.offset, property.offset + property.length) };
  });
}

/**
 * Combine metadata and token sections while rejecting duplicate or misplaced properties.
 *
 * @param parts - Ordered source sections or tagged-template string segments.
 * @param [labels] - Source labels for the corresponding input sections.
 * @returns Combined theme source retaining the authored property text.
 */
export function assembleThemeTemplate(parts, labels = []) {
  /** Ordered property source slices retained during template assembly. */
  const properties = [];

  /** Top-level property names already included in the assembled template. */
  const seen = new Set();

  for (const [index, source] of parts.entries()) {
    /** Diagnostic label for the current input section or color position. */
    const label = labels[index] ?? `theme part ${themeInputPaths[index] ?? index + 1}`;

    parseJsonc(source, label);

    for (const property of templateProperties(source, label)) {
      if (seen.has(property.key)) throw new Error(`${label}: duplicate top-level theme property ${property.key}`);

      if (index === 0 && themeSections.has(property.key)) {
        throw new Error(`${label}: theme section ${property.key} belongs in its section file`);
      }

      seen.add(property.key);
      properties.push(`  ${property.source}`);
    }
  }

  return `{\n${properties.join(",\n")}\n}`;
}

/**
 * Read and validate a target’s effective input sections, then assemble their theme template.
 *
 * @param root - Repository or isolated project root directory.
 * @param target - Discovered theme target and its source/output locations.
 */
async function readThemeTemplate(root, target) {
  /** Authored section source texts in template assembly order. */
  const parts = [];

  /** Source labels or display labels checked during this build phase. */
  const labels = [];

  for (const [index, path] of themeInputPaths.entries()) {
    /** Effective palette or section input with fallback provenance. */
    const input = await readTargetInput(root, target, path);

    validateThemePart(input, index);
    parts.push(input.source);
    labels.push(input.label);
  }

  return { source: assembleThemeTemplate(parts, labels), labels };
}

/**
 * Validate the structure and color-bearing fields of a resolved theme or authored template.
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
 * Identify JSON paths where whole-string color references are allowed.
 *
 * @param path - Output path or JSON property path inspected by the current build helper.
 */
function colorPosition(path) {
  return (
    (path[0] === "colors" && path.length === 2) ||
    (path[0] === "semanticTokenColors" && (path.length === 2 || (path.length === 3 && path[2] === "foreground"))) ||
    (path[0] === "tokenColors" &&
      path.length === 4 &&
      path[2] === "settings" &&
      ["foreground", "background"].includes(path[3]))
  );
}

/**
 * Replace color references through source edits while preserving comments and non-color content.
 *
 * @param source - Authored or generated JSONC source text for this build phase.
 * @param tokens - Resolved named color variables keyed by identifier.
 * @param palette - Generated palette records keyed by primitive identifier.
 * @param [label] - Human-readable context included in validation diagnostics.
 * @param [notice] - Rebuild command embedded in the generated-file notice.
 * @returns Generated JSONC source with resolved color values and a rebuild notice.
 */
export function renderTemplate(source, tokens, palette, label = "theme template", notice = "npm run build:prod") {
  /** Parsed template value and syntax tree used for validation and source edits. */
  const { value, tree } = parseJsonc(source, label);

  validateTheme(value);

  /** Source replacements for resolved color references. */
  const edits = [];

  /**
   * Traverse template nodes and collect edits only for permitted color-reference positions.
   *
   * @param node - JSONC syntax-tree node to inspect recursively.
   * @param [path] - Path to the file, directory, or configuration value being processed.
   */
  function walk(node, path = []) {
    if (node.type === "object") {
      for (const property of node.children ?? []) {
        /** Property name and value nodes visited together during template traversal. */
        const [key, child] = property.children;

        if (/\{[^{}]+\}/.test(key.value)) throw new Error(`Template reference in property name ${key.value}`);

        walk(child, [...path, key.value]);
      }
    } else if (node.type === "array") {
      for (const [index, child] of node.children.entries()) {
        walk(child, [...path, index]);
      }
    } else if (node.type === "string") {
      /** Whole-string color-reference match for the current value node. */
      const reference = /^\{([a-z0-9.-]+)\}$/i.exec(node.value);

      /** Diagnostic label for the current input section or color position. */
      const label = path.join(".");

      if (!colorPosition(path)) {
        if (/\{[^{}]+\}/.test(node.value)) throw new Error(`Template reference outside a color position: ${label}`);

        return;
      }

      if (!reference) {
        validateHex(node.value, label);

        return;
      }

      /** Palette or variable identifier captured from a template reference. */
      const id = reference[1];

      /** Resolved hex color for the current reference or swatch. */
      const hex = tokens.get(id) ?? palette.get(id)?.hex;

      if (!hex) throw new Error(`${label}: unknown template reference ${id}`);

      edits.push({ offset: node.offset, length: node.length, content: JSON.stringify(hex) });
    }
  }

  walk(tree);

  return `// Generated by ${notice}. Edit the corresponding inputs and rebuild.\n${applyEdits(source, edits)}`;
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
    "| Token | Target OKLCH | Resolved OKLCH | Hex | Exported OKLCH | Override reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...[...palette].map(
      ([id, color]) =>
        `| \`${id}\` | ${oklch(color.target)} | ${oklch(color.resolved)} | \`${color.hex}\` | ${oklch(color.exported)} | ${(color.reason ?? "").replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ")} |`,
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
  if (path.endsWith(".svg")) return source;

  /** Absolute output path used to select Prettier configuration. */
  const filepath = join(root, path);

  /** Formatter settings resolved for this output file. */
  const options = await prettier.resolveConfig(filepath);

  /** Whether this output needs JSONC theme formatting. */
  const theme = path.startsWith("themes/") || path.startsWith("dev/extension/generated-themes/");

  return prettier.format(source, { ...options, filepath, ...(theme ? { parser: "jsonc" } : {}) });
}

/**
 * Resolve one target’s palette and optional theme into validated, in-memory output candidates.
 *
 * @param root - Repository or isolated project root directory.
 * @param target - Discovered theme target and its source/output locations.
 * @param paletteOnly - Whether to generate palette reports without resolving theme mappings.
 */
async function prepareTarget(root, target, paletteOnly) {
  /** Effective palette or section input with fallback provenance. */
  const input = await readTargetInput(root, target, "colors/palette.jsonc");

  /** Validated palette generated before resolving theme variables. */
  let palette;

  try {
    palette = generatePalette(input.value);
  } catch (error) {
    throw new Error(`${input.label}: ${error.message}`, { cause: error });
  }

  /** Rebuild command used in generated notices and stale-output errors. */
  const command = target.group === "prod" ? "npm run build:prod" : "npm run build:dev";

  /** In-memory palette reports and optional rendered theme for one target. */
  const output = reports(palette, target, input, target.group === "prod" ? "npm run build:palette" : command);

  /** Resolved theme metadata used to build manifest registrations. */
  let metadata;

  if (!paletteOnly) {
    /** Effective named color variable input with diagnostic provenance. */
    const variables = await readTargetInput(root, target, "colors/variables.jsonc");

    /** Assembled metadata/token source with labels for each input section. */
    const template = await readThemeTemplate(root, target);

    try {
      /** Final hex colors for the target’s named color variables. */
      const resolved = resolveTokens(variables.value, palette);

      /** Generated theme source after replacing all permitted color references. */
      const rendered = renderTemplate(template.source, resolved, palette, target.directory, command);

      output.set(target.output, rendered);
      metadata = parseJsonc(rendered, target.output).value;
    } catch (error) {
      throw new Error(`${variables.label}; ${template.labels.join("; ")}: ${error.message}`, { cause: error });
    }
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
 * Reject generated files that no longer belong to the selected source targets.
 *
 * @param root - Repository or isolated project root directory.
 * @param targets - Theme targets participating in the selected build or validation pass.
 * @param group - Nested color variable group or selected prod/dev build group.
 * @param paletteOnly - Whether to generate palette reports without resolving theme mappings.
 */
async function staleOutputs(root, targets, group, paletteOnly) {
  /** Targets selected for the current prod or dev build group. */
  const selected = targets.filter((target) => target.group === group);

  /** Theme and palette artifact paths allowed for the selected target group. */
  const expected = new Set(
    selected.flatMap((target) => [
      target.output,
      ...["json", "md", "svg"].map((extension) => `${target.reportDirectory}/palette.${extension}`),
    ]),
  );

  /** Generated artifact paths found on disk for stale-output checks. */
  const actual = [];

  /** Generated theme directory belonging to the selected build group. */
  const themeDirectory = group === "prod" ? "themes" : "dev/extension/generated-themes";

  if (!paletteOnly) {
    for (const file of await listFiles(join(root, themeDirectory))) {
      if (file.endsWith(".json")) actual.push(`${themeDirectory}/${file}`);
    }
  }

  /** Source directory containing reports for the selected target group. */
  const sourceDirectory = `src/themes/${group}`;

  for (const name of await listDirectories(join(root, sourceDirectory), group === "dev")) {
    for (const file of await listFiles(join(root, sourceDirectory, name, "colors", "generated-palette"))) {
      if (/^palette\.(json|md|svg)$/.test(file)) {
        actual.push(`${sourceDirectory}/${name}/colors/generated-palette/${file}`);
      }
    }
  }

  /** Existing output paths that no current selected target owns. */
  const stale = actual.filter((path) => !expected.has(path));

  if (stale.length) {
    throw new Error(
      `Stale generated outputs: ${stale.join(", ")}. Remove them explicitly or restore their theme sources.`,
    );
  }
}

/**
 * Format and validate all output candidates before checking or atomically replacing changed files.
 *
 * @param root - Repository or isolated project root directory.
 * @param output - Output path-to-source map prepared before writing any artifacts.
 * @param check - Whether to report stale artifacts without writing files.
 * @param command - Rebuild command included in stale-output diagnostics.
 */
async function stageOutputs(root, output, check, command) {
  for (const [path, source] of output) {
    /** Formatted generated source ready for validation and comparison. */
    const text = await formatted(root, path, source);

    if (path.startsWith("themes/") || path.startsWith("dev/extension/generated-themes/")) {
      validateTheme(parseJsonc(text, path).value);
    }

    output.set(path, text);
  }

  /** Generated output paths whose contents differ from the prepared result. */
  const changed = [];

  for (const [path, text] of output) {
    if ((await readOptional(join(root, path))) !== text) changed.push(path);
  }

  if (check && changed.length) {
    throw new Error(`Generated output is missing or stale: ${changed.join(", ")}. Run ${command}.`);
  }

  if (check) return changed;

  for (const path of changed) {
    /** Final artifact path to replace after successful staging. */
    const destination = join(root, path);

    await mkdir(dirname(destination), { recursive: true });

    /** Sibling staging directory used for an atomic artifact replacement. */
    const temporary = await mkdtemp(join(dirname(destination), ".theme-build-"));

    try {
      /** Temporary file containing the complete replacement artifact. */
      const staged = join(temporary, "output");

      await writeFile(staged, output.get(path));
      await rename(staged, destination);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  return changed;
}

/**
 * Prepare the default and selected target group before validating and staging their combined outputs.
 *
 * @param options - Options passed to this operation.
 * @param options.root - Repository or isolated fixture root selected by the build entry point.
 * @param options.check - Whether to compare generated files without writing them.
 * @param [options.paletteOnly] - Whether to produce only palette reports.
 * @param options.group - Source group to build: prod or dev.
 */
async function buildTargets({ root, check, paletteOnly = false, group }) {
  /** All discovered prod/dev targets used for validation and collision checks. */
  const targets = await discoverTargets(root);

  /** Required default production target that supplies fallback inputs. */
  const defaultTarget = targets.find((target) => target.group === "prod" && target.name === "default");

  /** Prepared default palette and theme used before processing selected targets. */
  const baseline = await prepareTarget(root, defaultTarget, paletteOnly);

  /** Targets selected for the current prod or dev build group. */
  const selected = [];

  /** Combined output candidates validated before any file is written. */
  const output = new Map();

  for (const target of targets.filter((candidate) => candidate.group === group)) {
    /** Validated palette and output candidates for the current target. */
    const prepared = target === defaultTarget ? baseline : await prepareTarget(root, target, paletteOnly);

    selected.push(prepared);

    for (const [path, text] of prepared.outputs) output.set(path, text);
  }

  if (group === "prod" && !paletteOnly) output.set("package.json", await prodManifestOutput(root, selected));

  await staleOutputs(root, targets, group, paletteOnly);

  /** Rebuild command used in generated notices and stale-output errors. */
  const command = group === "dev" ? "npm run build:dev" : paletteOnly ? "npm run build:palette" : "npm run build:prod";

  /** Generated output paths whose contents differ from the prepared result. */
  const changed = await stageOutputs(root, output, check, command);

  return {
    changed,
    palette: baseline.palette,
    targets: selected.map((target) => ({
      name: target.name,
      palette: target.palette,
      changed: changed.filter((path) => target.outputs.has(path)),
    })),
  };
}

/**
 * Build or check production themes and reports, optionally generating only palette artifacts.
 *
 * @param [options] - Options passed to this operation.
 * @param [options.root] - Repository or fixture root; defaults to this checkout.
 * @param [options.check] - Whether to compare generated files without writing them.
 * @param [options.paletteOnly] - Whether to produce only palette reports.
 * @returns Build summary containing changed paths, the default palette, and per-target results.
 */
export async function buildProdThemes({ root = defaultRoot, check = false, paletteOnly = false } = {}) {
  return buildTargets({ root, check, paletteOnly, group: "prod" });
}

/**
 * Build or check development themes and return each target’s palette and changed output paths.
 *
 * @param [options] - Options passed to this operation.
 * @param [options.root] - Repository or fixture root; defaults to this checkout.
 * @param [options.check] - Whether to compare generated files without writing them.
 * @returns Per-target palettes and changed output paths.
 */
export async function buildDevThemes({ root = defaultRoot, check = false } = {}) {
  /** Completed build summary for the selected command or target group. */
  const result = await buildTargets({ root, check, group: "dev" });

  return result.targets;
}

if (import.meta.main) {
  try {
    /** Command-line options validated before selecting a build mode. */
    const flags = process.argv.slice(2);

    if (
      flags.some((flag) => !["--check", "--palette-only", "--dev"].includes(flag)) ||
      (flags.includes("--dev") && flags.includes("--palette-only"))
    ) {
      throw new Error("Usage: node scripts/themes/build.js [--check] [--palette-only | --dev]");
    }

    if (flags.includes("--dev")) {
      const check = flags.includes("--check");

      console.log(styled(`${check ? "Checking" : "Building"} dev themes...`, styles.yellow));

      /** Development target summaries returned to the command-line entry point. */
      const targets = await buildDevThemes({ check });

      /** Changed generated paths from all development targets. */
      const changedFiles = targets.flatMap((target) => target.changed);

      console.log(
        styled(
          `${check ? "Validated" : "Built"} ${targets.length} dev themes; ${changedFiles.length} generated files updated.`,
          styles.green,
        ),
      );

      for (const path of changedFiles) console.log(`  ${path}`);
    } else {
      const paletteOnly = flags.includes("--palette-only");
      const check = flags.includes("--check");

      console.log(
        styled(
          `${check ? "Checking" : "Building"} ${paletteOnly ? "palette reports" : "prod themes"}...`,
          styles.yellow,
        ),
      );

      /** Completed build summary for the selected command or target group. */
      const result = await buildProdThemes({
        check,
        paletteOnly,
      });

      console.log(
        styled(
          `${check ? "Validated" : "Built"} ${result.targets.length} prod themes; ${result.changed.length} generated files updated.`,
          styles.green,
        ),
      );

      for (const path of result.changed) console.log(`  ${path}`);
    }

    console.log();
  } catch (error) {
    console.error(styled(error.message, styles.red));
    process.exitCode = 1;
  }
}

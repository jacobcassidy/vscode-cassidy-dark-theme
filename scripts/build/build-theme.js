import { readFile, readdir, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, parseTree } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { object, parseJsonc } from "../lib/jsonc.js";
import { generatePalette, resolveTokens } from "../lib/palette.js";
import { contrastRatio, validateHex } from "../lib/colors.js";

const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));
const outputTheme = "themes/cassidy-dark-color-theme.json";
const reportDirectory = "palette/reports/production";
const experimentReportDirectory = "palette/reports/experiments";
const paletteInputPath = "palette/source/palette.jsonc";
const themeParts = ["base", "colors", "semantic", "syntax"];
const themeSections = new Set(["colors", "semanticHighlighting", "semanticTokenColors", "tokenColors"]);

function templateProperties(source, label) {
  const tree = parseTree(source, [], { allowTrailingComma: true });

  if (tree?.type !== "object") throw new Error(`${label} must contain a JSONC object`);

  return (tree.children ?? []).map((property) => {
    const [key] = property.children;

    return { key: key.value, source: source.slice(property.offset, property.offset + property.length) };
  });
}

export function assembleThemeTemplate(parts, labels = []) {
  const properties = [];
  const seen = new Set();

  for (const [index, source] of parts.entries()) {
    const label = labels[index] ?? `theme part ${themeParts[index] ?? index + 1}`;

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

async function readThemeTemplate(root, directory, optional = false) {
  const parts = [];
  const labels = [];

  for (const name of themeParts) {
    const path = directory ? `${directory}/${name}.jsonc` : `src/theme/${name}.jsonc`;
    const source = await readOptional(join(root, path));

    if (!source && !optional) throw new Error(`Missing required theme input: ${path}`);

    parts.push(source ?? (await readFile(join(root, `src/theme/${name}.jsonc`), "utf8")));
    labels.push(source ? path : `src/theme/${name}.jsonc`);
  }

  return assembleThemeTemplate(parts, labels);
}

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

export function renderTemplate(source, tokens, palette, label = "src/theme", notice = "npm run build:theme") {
  const { value, tree } = parseJsonc(source, label);

  validateTheme(value);

  const edits = [];

  function walk(node, path = []) {
    if (node.type === "object") {
      for (const property of node.children ?? []) {
        const [key, child] = property.children;

        if (/\{[^{}]+\}/.test(key.value)) throw new Error(`Template reference in property name ${key.value}`);

        walk(child, [...path, key.value]);
      }
    } else if (node.type === "array") {
      for (const [index, child] of node.children.entries()) {
        walk(child, [...path, index]);
      }
    } else if (node.type === "string") {
      const reference = /^\{([a-z0-9.-]+)\}$/i.exec(node.value);
      const label = path.join(".");

      if (!colorPosition(path)) {
        if (/\{[^{}]+\}/.test(node.value)) throw new Error(`Template reference outside a color position: ${label}`);

        return;
      }

      if (!reference) {
        validateHex(node.value, label);

        return;
      }

      const id = reference[1];
      const hex = tokens.get(id) ?? palette.get(id)?.hex;

      if (!hex) throw new Error(`${label}: unknown template reference ${id}`);

      edits.push({ offset: node.offset, length: node.length, content: JSON.stringify(hex) });
    }
  }

  walk(tree);

  return `// Generated by ${notice}. Edit the corresponding inputs and rebuild.\n${applyEdits(source, edits)}`;
}

function oklch(color) {
  return `oklch(${(color.l * 100).toFixed(3)}% ${color.c.toFixed(6)} ${color.h.toFixed(3)})`;
}

function xml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
}

function reports(palette, directory = reportDirectory, notice = "npm run build:palette` or `npm run build:theme") {
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

  const contrastRows = [...palette]
    .filter(([id]) => id.split(".")[1] !== "gray" && id.endsWith(".600"))
    .map(([id, color]) => {
      const ratio = contrastRatio("#f8f8f8", color.hex);

      return `| \`${id}\` | \`${color.hex}\` | ${ratio === null ? "Needs backdrop" : `${ratio.toFixed(2)}:1`} |`;
    });

  const markdown = [
    "# Generated palette",
    "",
    `Generated by \`${notice}\`. Edit the corresponding palette input and rebuild.`,
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

  const families = new Map();

  for (const [id, color] of palette) {
    const [, family, tone] = id.split(".");

    if (!families.has(family)) families.set(family, new Map());

    families.get(family).set(tone, color.hex);
  }

  const chromatic = [...families].filter(([family]) => family !== "gray");
  const gray = [...(families.get("gray") ?? [])];
  const grayRows = Math.ceil(gray.length / 5);
  const height = 74 + chromatic.length * 76 + (grayRows ? 38 + grayRows * 76 : 0);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}" role="img" aria-labelledby="title description">`,
    '<title id="title">Cassidy Dark generated palette</title>',
    '<desc id="description">Rows show each color family with tones 300, 400, 500, 600, and 400-muted, followed by neutral swatches. Every swatch includes its hex value.</desc>',
    `<rect width="760" height="${height}" fill="#242424"/>`,
    '<g font-family="monospace" font-size="13" fill="#f8f8f8">',
    '<text x="20" y="28">Cassidy Dark · Generated palette</text>',
  ];

  for (const [index, tone] of ["300", "400", "500", "600", "400-muted"].entries()) {
    svg.push(`<text x="${132 + index * 122}" y="55">${tone}</text>`);
  }

  for (const [row, [name, colors]] of chromatic.entries()) {
    const y = 70 + row * 76;

    svg.push(`<text x="20" y="${y + 24}">${xml(name)}</text>`);

    for (const [column, tone] of ["300", "400", "500", "600", "400-muted"].entries()) {
      const x = 132 + column * 122;
      const hex = colors.get(tone);

      svg.push(
        `<rect x="${x}" y="${y}" width="108" height="38" rx="3" fill="${hex}"/><text x="${x}" y="${y + 57}">${hex}</text>`,
      );
    }
  }

  const start = 86 + chromatic.length * 76;

  if (gray.length) svg.push(`<text x="20" y="${start}">Neutrals</text>`);

  for (const [index, [tone, hex]] of gray.entries()) {
    const x = 20 + (index % 5) * 146;
    const y = start + 16 + Math.floor(index / 5) * 76;

    svg.push(
      `<rect x="${x}" y="${y}" width="132" height="32" rx="3" fill="${hex}"/><text x="${x}" y="${y + 49}">${xml(tone)} ${hex}</text>`,
    );
  }

  svg.push("</g></svg>\n");

  return new Map([
    [`${directory}/palette.json`, `${JSON.stringify({ primitives }, null, 2)}\n`],
    [`${directory}/palette.md`, markdown],
    [`${directory}/palette.svg`, svg.join("\n")],
  ]);
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;

    throw error;
  }
}

async function formatted(root, path, source) {
  if (path.endsWith(".svg")) return source;

  const filepath = join(root, path);
  const options = await prettier.resolveConfig(filepath);

  return prettier.format(source, { ...options, filepath, ...(path === outputTheme ? { parser: "jsonc" } : {}) });
}

export async function buildTheme({ root = defaultRoot, check = false, paletteOnly = false } = {}) {
  const paletteInput = parseJsonc(await readFile(join(root, paletteInputPath), "utf8"), paletteInputPath).value;
  const palette = generatePalette(paletteInput);
  const output = reports(palette);

  if (!paletteOnly) {
    const input = parseJsonc(await readFile(join(root, "src/tokens.jsonc"), "utf8"), "src/tokens.jsonc").value;
    const tokens = resolveTokens(input, palette);
    const template = await readThemeTemplate(root);

    output.set(outputTheme, renderTemplate(template, tokens, palette));
  }

  // Render and validate every output before touching any destination.
  for (const [path, text] of output) {
    output.set(path, await formatted(root, path, text));
  }

  if (output.has(outputTheme)) {
    validateTheme(parseJsonc(output.get(outputTheme), outputTheme).value);
  }

  const changed = [];

  for (const [path, text] of output) {
    if ((await readOptional(join(root, path))) !== text) changed.push(path);
  }

  if (check && changed.length) {
    throw new Error(`Generated output is missing or stale: ${changed.join(", ")}. Run npm run build:theme.`);
  }

  if (check) return { changed, palette };

  for (const path of changed) {
    const destination = join(root, path);

    await mkdir(dirname(destination), { recursive: true });

    const temporary = await mkdtemp(join(dirname(destination), ".theme-build-"));

    try {
      const staged = join(temporary, "output");

      await writeFile(staged, output.get(path));
      await rename(staged, destination);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  return { changed, palette };
}

function mergeObjects(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override;

  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    result[key] =
      value && typeof value === "object" && !Array.isArray(value) ? mergeObjects(result[key] ?? {}, value) : value;
  }

  return result;
}

function mergeTokenGroups(base, override, path = []) {
  const result = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const id = [...path, key].join(".");

    if (value && typeof value === "object" && !Array.isArray(value) && !Object.hasOwn(value, "color")) {
      result[key] = mergeTokenGroups(result[key] ?? {}, value, [...path, key]);
    } else {
      if (!value || typeof value !== "object" || typeof value.color !== "string") {
        throw new Error(`Experiment token ${id} must be a token leaf with a color`);
      }

      result[key] = value;
    }
  }

  return result;
}

async function stageOutputs(root, output, check, command) {
  for (const [path, text] of output) output.set(path, await formatted(root, path, text));

  for (const [path, text] of output) {
    if (path.startsWith("dev/themes/") || path === outputTheme) validateTheme(parseJsonc(text, path).value);
  }

  const changed = [];

  for (const [path, text] of output) {
    if ((await readOptional(join(root, path))) !== text) changed.push(path);
  }

  if (check && changed.length)
    throw new Error(`Generated output is missing or stale: ${changed.join(", ")}. Run ${command}.`);
  if (check) return changed;

  for (const path of changed) {
    const destination = join(root, path);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = await mkdtemp(join(dirname(destination), ".theme-build-"));

    try {
      const staged = join(temporary, "output");
      await writeFile(staged, output.get(path));
      await rename(staged, destination);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  return changed;
}

export async function buildDev({ root = defaultRoot, check = false } = {}) {
  const directory = join(root, "dev/experiments");
  const targets = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const results = [];
  const expected = new Set();

  for (const name of targets) {
    if (!/^[a-z][a-z0-9.-]*$/.test(name) || name.includes("..") || name.endsWith(".")) {
      throw new Error(`Invalid experiment name: ${name}`);
    }
    const inputDirectory = `dev/experiments/${name}`;
    const paths = ["palette.jsonc", "tokens.jsonc", ...themeParts.map((part) => `${part}.jsonc`)];
    const sources = new Map();

    for (const path of paths) sources.set(path, await readOptional(join(root, inputDirectory, path)));
    if (![...sources.values()].some(Boolean)) throw new Error(`Experiment ${name} has no recognized input files`);

    const paletteBase = parseJsonc(await readFile(join(root, paletteInputPath), "utf8"), paletteInputPath).value;
    const tokenBase = parseJsonc(await readFile(join(root, "src/tokens.jsonc"), "utf8"), "src/tokens.jsonc").value;
    const paletteInput = sources.get("palette.jsonc")
      ? mergeObjects(paletteBase, parseJsonc(sources.get("palette.jsonc"), `${inputDirectory}/palette.jsonc`).value)
      : paletteBase;
    const tokenInput = sources.get("tokens.jsonc")
      ? mergeTokenGroups(tokenBase, parseJsonc(sources.get("tokens.jsonc"), `${inputDirectory}/tokens.jsonc`).value)
      : tokenBase;
    const palette = generatePalette(paletteInput);
    const tokens = resolveTokens(tokenInput, palette);
    const template = await readThemeTemplate(root, inputDirectory, true);
    const output = reports(palette, `${experimentReportDirectory}/${name}`, "npm run build:dev");
    output.set(
      `dev/themes/cassidy-dark-color-theme-${name}.json`,
      renderTemplate(template, tokens, palette, inputDirectory, "npm run build:dev"),
    );
    const changed = await stageOutputs(root, output, check, "npm run build:dev");
    for (const path of output.keys()) expected.add(path);
    results.push({ name, changed, palette });
  }

  const actual = [];
  for (const [directory, recursive] of [
    ["dev/themes", false],
    [experimentReportDirectory, true],
  ]) {
    const entries = await readdir(join(root, directory), { withFileTypes: true });

    for (const entry of entries) {
      const relative = `${directory}/${entry.name}`;

      if (entry.isFile() && entry.name.endsWith(".json") && directory === "dev/themes") actual.push(relative);
      if (entry.isDirectory() && recursive) {
        for (const file of await readdir(join(root, relative))) {
          if (file.startsWith("palette.")) actual.push(`${relative}/${file}`);
        }
      }
    }
  }

  const stale = actual.filter((path) => !expected.has(path));

  if (stale.length)
    throw new Error(`Stale experimental outputs: ${stale.join(", ")}. Remove them or restore their experiment inputs.`);

  return results;
}

if (import.meta.main) {
  try {
    const flags = process.argv.slice(2);

    if (flags.some((flag) => !["--check", "--palette-only", "--dev"].includes(flag))) {
      throw new Error("Usage: node scripts/build/build-theme.js [--check] [--palette-only] [--dev]");
    }

    if (flags.includes("--dev")) {
      const results = await buildDev({ check: flags.includes("--check") });
      console.log(`Validated ${results.length} experiments; generated outputs are current.`);
      process.exit();
    }

    const { changed, palette } = await buildTheme({
      check: flags.includes("--check"),
      paletteOnly: flags.includes("--palette-only"),
    });

    console.log(`Validated ${palette.size} palette colors; ${changed.length} generated files updated.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

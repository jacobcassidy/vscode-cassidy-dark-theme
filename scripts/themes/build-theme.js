import { readFile, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEdits, modify, parseTree } from "jsonc-parser";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";
import { object, parseJsonc } from "../shared/jsonc.js";
import { generatePalette, resolveTokens } from "../shared/palette.js";
import { contrastRatio, validateHex } from "../shared/colors.js";
import {
  discoverTargets,
  listDirectories,
  listFiles,
  readOptional,
  readTargetInput,
  themeContribution,
  themeInputPaths,
  validateThemePart,
} from "../shared/theme-targets.js";

const defaultRoot = fileURLToPath(new URL("../../", import.meta.url));
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

async function readThemeTemplate(root, target) {
  const parts = [];
  const labels = [];

  for (const [index, path] of themeInputPaths.entries()) {
    const input = await readTargetInput(root, target, path);

    validateThemePart(input, index);
    parts.push(input.source);
    labels.push(input.label);
  }

  return { source: assembleThemeTemplate(parts, labels), labels };
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

export function renderTemplate(source, tokens, palette, label = "theme template", notice = "npm run build:theme") {
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

function reports(palette, target, input, notice) {
  const directory = target.reportDirectory;
  const provenance = {
    target: `${target.group}/${target.name}`,
    source: input.path,
    fallback: input.fallback,
    rebuild: notice,
  };
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
    [`${directory}/palette.json`, `${JSON.stringify({ generated: provenance, primitives }, null, 2)}\n`],
    [`${directory}/palette.md`, markdown],
    [`${directory}/palette.svg`, svg.join("\n")],
  ]);
}

async function formatted(root, path, source) {
  if (path.endsWith(".svg")) return source;

  const filepath = join(root, path);
  const options = await prettier.resolveConfig(filepath);
  const theme = path.startsWith("themes/") || path.startsWith("dev/themes/");

  return prettier.format(source, { ...options, filepath, ...(theme ? { parser: "jsonc" } : {}) });
}

async function prepareTarget(root, target, paletteOnly) {
  const input = await readTargetInput(root, target, "colors/palette.jsonc");
  let palette;

  try {
    palette = generatePalette(input.value);
  } catch (error) {
    throw new Error(`${input.label}: ${error.message}`, { cause: error });
  }

  const command = target.group === "production" ? "npm run build:theme" : "npm run build:dev";
  const output = reports(palette, target, input, target.group === "production" ? "npm run build:palette" : command);
  let metadata;

  if (!paletteOnly) {
    const variables = await readTargetInput(root, target, "colors/variables.jsonc");
    const template = await readThemeTemplate(root, target);

    try {
      const resolved = resolveTokens(variables.value, palette);
      const rendered = renderTemplate(template.source, resolved, palette, target.directory, command);

      output.set(target.output, rendered);
      metadata = parseJsonc(rendered, target.output).value;
    } catch (error) {
      throw new Error(`${variables.label}; ${template.labels.join("; ")}: ${error.message}`, { cause: error });
    }
  }

  return { ...target, palette, outputs: output, metadata };
}

async function manifestOutput(root, targets) {
  const path = "package.json";
  const source = await readFile(join(root, path), "utf8");
  const manifest = parseJsonc(source, path).value;

  object(manifest, path);

  if (manifest.contributes !== undefined) object(manifest.contributes, "package.json.contributes");

  const themes = targets.map((target) => {
    const contribution = themeContribution(target, target.metadata);
    const existing = manifest.contributes?.themes?.find((entry) => entry.path === contribution.path);

    return { ...existing, ...contribution };
  });

  const labels = themes.map((theme) => theme.label);

  if (new Set(labels).size !== labels.length) throw new Error("Production theme labels must be unique");

  return applyEdits(source, modify(source, ["contributes", "themes"], themes, {}));
}

async function staleOutputs(root, targets, group, paletteOnly) {
  const selected = targets.filter((target) => target.group === group);
  const expected = new Set(
    selected.flatMap((target) => [
      target.output,
      ...["json", "md", "svg"].map((extension) => `${target.reportDirectory}/palette.${extension}`),
    ]),
  );
  const actual = [];
  const themeDirectory = group === "production" ? "themes" : "dev/themes";

  if (!paletteOnly) {
    for (const file of await listFiles(join(root, themeDirectory))) {
      if (file.endsWith(".json")) actual.push(`${themeDirectory}/${file}`);
    }
  }

  const reportsRoot = "docs/palettes/generated-reports";
  const otherNames = new Set(targets.filter((target) => target.group !== group).map((target) => target.name));

  for (const name of await listDirectories(join(root, reportsRoot), true)) {
    if (otherNames.has(name)) continue;

    for (const file of await listFiles(join(root, reportsRoot, name))) {
      if (/^palette\.(json|md|svg)$/.test(file)) actual.push(`${reportsRoot}/${name}/${file}`);
    }
  }

  const stale = actual.filter((path) => !expected.has(path));

  if (stale.length) {
    throw new Error(
      `Stale generated outputs: ${stale.join(", ")}. Remove them explicitly or restore their theme sources.`,
    );
  }
}

async function stageOutputs(root, output, check, command) {
  for (const [path, source] of output) {
    const text = await formatted(root, path, source);

    if (path.startsWith("themes/") || path.startsWith("dev/themes/")) {
      validateTheme(parseJsonc(text, path).value);
    }

    output.set(path, text);
  }

  const changed = [];

  for (const [path, text] of output) {
    if ((await readOptional(join(root, path))) !== text) changed.push(path);
  }

  if (check && changed.length) {
    throw new Error(`Generated output is missing or stale: ${changed.join(", ")}. Run ${command}.`);
  }

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

async function buildTargets({ root, check, paletteOnly = false, group }) {
  const targets = await discoverTargets(root);
  const defaultTarget = targets.find((target) => target.group === "production" && target.name === "default");
  const baseline = await prepareTarget(root, defaultTarget, paletteOnly);
  const selected = [];
  const output = new Map();

  for (const target of targets.filter((candidate) => candidate.group === group)) {
    const prepared = target === defaultTarget ? baseline : await prepareTarget(root, target, paletteOnly);

    selected.push(prepared);

    for (const [path, text] of prepared.outputs) output.set(path, text);
  }

  if (group === "production" && !paletteOnly) output.set("package.json", await manifestOutput(root, selected));

  await staleOutputs(root, targets, group, paletteOnly);

  const command =
    group === "local" ? "npm run build:dev" : paletteOnly ? "npm run build:palette" : "npm run build:theme";
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

export async function buildTheme({ root = defaultRoot, check = false, paletteOnly = false } = {}) {
  return buildTargets({ root, check, paletteOnly, group: "production" });
}

export async function buildDev({ root = defaultRoot, check = false } = {}) {
  const result = await buildTargets({ root, check, group: "local" });

  return result.targets;
}

if (import.meta.main) {
  try {
    const flags = process.argv.slice(2);

    if (
      flags.some((flag) => !["--check", "--palette-only", "--dev"].includes(flag)) ||
      (flags.includes("--dev") && flags.includes("--palette-only"))
    ) {
      throw new Error("Usage: node scripts/themes/build-theme.js [--check] [--palette-only | --dev]");
    }

    if (flags.includes("--dev")) {
      const targets = await buildDev({ check: flags.includes("--check") });

      console.log(
        `Validated ${targets.length} local themes; ${targets.reduce((sum, target) => sum + target.changed.length, 0)} generated files updated.`,
      );
    } else {
      const result = await buildTheme({
        check: flags.includes("--check"),
        paletteOnly: flags.includes("--palette-only"),
      });

      console.log(
        `Validated ${result.targets.length} production themes; ${result.changed.length} generated files updated.`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

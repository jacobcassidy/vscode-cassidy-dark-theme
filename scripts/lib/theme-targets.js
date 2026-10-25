import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fields, object, parseJsonc } from "./jsonc.js";

export const defaultThemeDirectory = "src/prod/themes/default";

export const themeInputPaths = ["metadata.jsonc", "tokens/ui.jsonc", "tokens/semantic.jsonc", "tokens/syntax.jsonc"];

const sectionFields = [[], ["colors"], ["semanticHighlighting", "semanticTokenColors"], ["tokenColors"]];
const themeTypes = new Map([
  ["dark", "vs-dark"],
  ["light", "vs"],
  ["hc", "hc-black"],
  ["hcLight", "hc-light"],
]);

export async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;

    throw error;
  }
}

export async function listDirectories(path, optional = false) {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (optional && error.code === "ENOENT") return [];

    throw error;
  }
}

export async function listFiles(path) {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];

    throw error;
  }
}

export async function discoverTargets(root) {
  const targets = [];
  const names = new Set();

  for (const group of ["prod", "dev"]) {
    const directory = `src/${group}/themes`;

    for (const name of await listDirectories(join(root, directory), group === "dev")) {
      if (!/^[a-z][a-z0-9.-]*$/.test(name) || name.includes("..") || name.endsWith(".")) {
        throw new Error(`Invalid theme name: ${group}/${name}`);
      }

      if (names.has(name)) {
        throw new Error(`Duplicate theme name ${name}: prod and dev themes share palette report paths`);
      }

      names.add(name);
      targets.push({
        group,
        name,
        directory: `${directory}/${name}`,
        reportDirectory: `docs/palettes/generated-reports/${name}`,
        output: `${group === "prod" ? "themes" : "dev/themes"}/cassidy-dark-color-theme${group === "prod" && name === "default" ? "" : `-${name}`}.json`,
      });
    }
  }

  if (!targets.some((target) => target.group === "prod" && target.name === "default")) {
    throw new Error(`Missing required default theme: ${defaultThemeDirectory}`);
  }

  return targets;
}

export async function readTargetInput(root, target, relative) {
  const ownPath = `${target.directory}/${relative}`;
  const own = await readOptional(join(root, ownPath));
  const path = own === undefined ? `${defaultThemeDirectory}/${relative}` : ownPath;
  const source = own ?? (await readOptional(join(root, path)));
  const fallback = path !== ownPath;
  const label = `${target.group}/${target.name}: ${path}${fallback ? " (default fallback)" : ""}`;

  if (source === undefined) throw new Error(`${label}: missing required theme input`);

  const parsed = parseJsonc(source, label);

  object(parsed.value, label);

  return { ...parsed, source, path, label, fallback };
}

export function validateThemePart(input, index) {
  if (index === 0) {
    themeUiType(input.value, input.label);

    return;
  }

  fields(input.value, sectionFields[index], input.label);

  if (index === 1) object(input.value.colors, `${input.label}.colors`);

  if (index === 3 && !Array.isArray(input.value.tokenColors)) {
    throw new Error(`${input.label}.tokenColors must be an array`);
  }
}

export function themeUiType(metadata, label) {
  if (typeof metadata.name !== "string" || !metadata.name.trim()) {
    throw new Error(`${label}: theme name must be a nonempty string`);
  }

  if (!themeTypes.has(metadata.type)) {
    throw new Error(`${label}: theme type must be dark, light, hc, or hcLight`);
  }

  return themeTypes.get(metadata.type);
}

export function prodThemeContribution(target, metadata) {
  const name = target.name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const label = target.name === "default" ? metadata.name : `${metadata.name} (${name})`;

  return { label, uiTheme: themeUiType(metadata, target.directory), path: `./${target.output}` };
}

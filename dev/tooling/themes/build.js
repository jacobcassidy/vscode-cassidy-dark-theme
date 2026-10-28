/**
 * Theme and palette builds.
 * @file Assemble theme inputs, resolve colors, generate reports, and write or check build outputs.
 */

import {
  repositoryRoot,
  defaultThemeDirectory,
  paletteInputPath,
  themeSections,
  themeInputPaths,
} from "../shared/paths.js";
import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { applyEdits, modify } from "jsonc-parser";
import { formatSource } from "../shared/formatting.js";
import { logReloadReminder, syncDevExtension } from "../preview/sync.js";
import { formatMessage } from "../shared/terminal-output.js";
import { fields, object, parseJsonc } from "../shared/jsonc.js";
import { generatePalette } from "../palette/generation.js";
import { compileTokens, renderTheme } from "../tokens/compilation.js";
import {
  observeWriter,
  verifyRestored,
  applyArtifacts,
  validateDestination,
  assertFresh,
  capturePaths,
  requireStable,
  withGuards,
} from "../shared/transactions.js";
import { decode } from "../tokens/formats.js";
import { loadTokenData } from "../tokens/data/load.js";
import { validateCategories, validateReferenceScopes } from "../tokens/category-validation.js";
import { paletteReports } from "../palette/reports.js";
import {
  discoverTargets,
  listDirectories,
  listFiles,
  readOptional,
  readTargetInput,
  prodThemeContribution,
  themeUiType,
} from "./inputs.js";

/**
 * Load independent whole-file inputs and compile one target’s effective token sections.
 * @param target - Discovered target and source paths.
 * @param palette - Generated palette records for this target.
 * @param command - Rebuild command included in the output notice.
 * @param readInput - Pass-local cached input reader.
 * @param snapshot - Injected checked-in classification snapshot.
 * @param operations - Narrow compiler/palette adapters.
 * @returns Compiled theme JSONC with all input labels attached to diagnostics.
 */
async function readCompiledTheme(target, palette, command, readInput, snapshot, operations) {
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

    /** Effective categorized inputs retain origins for authority diagnostics. */
    const families = { definitions: {}, details: {} };

    for (const section of themeSections) {
      families.definitions[section] = decode(inputs.get(`tokens/${section}/definitions.jsonc`), section, "definitions");
      families.details[section] = decode(inputs.get(`tokens/${section}/details.jsonc`), section, "details");
      tokens[section] = families.definitions[section].value;
      details[section] = families.details[section].value;
    }

    if (target.directory === defaultThemeDirectory) {
      validateReferenceScopes(snapshot, families.definitions.syntax);
      snapshot.referenceScopes = new Map(
        tokens.syntax
          .filter((rule) => rule.id)
          .map((rule) => [rule.id, rule.scope === undefined ? [] : [rule.scope].flat()]),
      );
    }

    validateCategories(families, snapshot, `${target.group}/${target.name}`);

    /** Effective metadata validated before compilation and registration. */
    const metadata = inputs.get("metadata.jsonc");

    object(metadata.value, metadata.label);
    themeUiType(metadata.value, metadata.label);

    return renderTheme(
      metadata.value,
      (operations.compileTokens ?? compileTokens)(tokens, details, palette, target.directory === defaultThemeDirectory),
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
 * Resolve one target’s palette and optional theme into validated, in-memory output candidates.
 *
 * @param target - Discovered theme target and its source/output locations.
 * @param paletteOnly - Whether to generate palette reports without compiling token sections.
 * @param [defaultPalette] - Already validated default palette available to other themes.
 * @param readInput - Pass-local cached input reader.
 * @param snapshot - Shared classification snapshot.
 * @param operations - Narrow compiler/palette adapters.
 */
async function prepareTarget(target, paletteOnly, defaultPalette, readInput, snapshot, operations) {
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
      palette = (operations.generatePalette ?? generatePalette)(config);
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
    : paletteReports(palette, target, input, target.group === "prod" ? "npm run build:palette" : command);

  if (!input.value.useDefaultPalette) {
    output.set(`${target.directory}/palette/default-palette.txt`, null);
  }

  /** Resolved theme metadata used to build manifest registrations. */
  let metadata;

  if (!paletteOnly) {
    /** Generated JSONC after validating effective tokens, details, and cross-section aliases. */
    const rendered = await readCompiledTheme(target, palette, command, readInput, snapshot, operations);
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
  const themeDirectory = group === "prod" ? "themes" : "dev/preview/themes";

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
 * Format and validate each output candidate once during preparation.
 *
 * @param root - Repository or isolated project root directory.
 * @param output - Output path-to-source map, with null marking obsolete files or palette directories for removal.
 */
async function prepareOutputs(root, output) {
  for (const [path, source] of output) {
    await validateDestination(root, path);

    if (source === null) continue;

    /** Formatted generated source ready for validation and comparison. */
    const text = await formatSource(root, path, source);

    if (path.startsWith("themes/") || path.startsWith("dev/preview/themes/")) {
      validateTheme(parseJsonc(text, path).value);
    }

    output.set(path, text);
  }
}

/**
 * Compare completely prepared bytes without formatting or mutating the candidate map.
 * @param root - Repository or isolated project root.
 * @param output - Prepared output bytes, with null marking removals.
 * @param command - Rebuild command included in stale-output diagnostics.
 */
async function checkOutputs(root, output, command) {
  /** Generated output paths whose contents differ from the prepared result. */
  const changed = [];

  for (const [path, text] of output) {
    /** Existence of scheduled removals or contents of files to replace, checked before any writes. */
    const existing = text === null ? await artifactExists(join(root, path)) : await readOptional(join(root, path));
    if (text === null ? existing : existing !== text) changed.push(path);
  }

  if (changed.length) {
    /** Scheduled removals described without changing the filesystem in check mode. */
    const removed = changed.filter((path) => output.get(path) === null);

    throw new Error(
      `Generated output is missing or stale: ${changed.join(", ")}.${removed.length ? ` Pending removals: ${removed.join(", ")}.` : ""} Run ${command}.`,
    );
  }

  return changed;
}

/**
 * Prepare both selected groups once, retaining one stable input snapshot and artifact map.
 * @param [options] - Preparation options.
 * @param [options.root] - Isolated project or checkout root.
 * @param [options.mode] - all, prod, dev, or palette.
 * @param [options.overrides] - Prepared authored source candidates.
 * @param [options.additionalTargets] - Validated targets being scaffolded.
 * @param [options.snapshot] - Already loaded shared snapshot for generator/watch reuse.
 * @param [options.recoveryOwner] - Explicit restoration-verification guard ownership.
 * @param [options.operations] - Narrow compilation/loading/palette adapters for operation-count verification.
 */
export async function prepareBuild({
  root = repositoryRoot,
  mode = "all",
  overrides = new Map(),
  additionalTargets = [],
  snapshot,
  recoveryOwner,
  operations = {},
} = {}) {
  if (!["all", "prod", "dev", "palette"].includes(mode)) throw new Error(`Unknown build mode: ${mode}`);

  /** Read-only boundary check and complete dependency fingerprints. */
  const generation = recoveryOwner ? undefined : await requireStable(root);

  if (recoveryOwner && (await observeWriter(root)).owner?.token !== recoveryOwner.token)
    throw new Error("Recovery preparation requires the owning checkout guard");

  /** Pre-application fingerprints used to reject stale inputs. */
  const expected = await capturePaths([
    join(root, "src"),
    join(root, "package.json"),
    join(root, "themes"),
    join(root, "dev/preview"),
  ]);

  /** Discovered source targets, including any prepared but unapplied scaffold. */
  const targets = [...(await discoverTargets(root)), ...additionalTargets];

  snapshot ??=
    mode === "palette"
      ? undefined
      : await (operations.loadTokenData ?? loadTokenData)({ root, recovery: Boolean(recoveryOwner) });

  if (snapshot?.expected) await assertFresh(snapshot.expected);

  /** Required production default supplying independent fallback inputs. */
  const defaultTarget = targets.find((target) => target.directory === defaultThemeDirectory);

  /** Pass-local target and file caches, including observed absence. */
  const cache = new Map(),
    fileCache = new Map();

  /**
   * Reuse independently inherited parsed files throughout this pass.
   * @param target - Current target.
   * @param path - Independent family or palette input.
   */
  async function readInput(target, path) {
    /** Target/path cache identity includes fallback diagnostics. */
    const key = `${target.directory}/${path}`;
    if (!cache.has(key)) cache.set(key, readTargetInput(root, target, path, overrides, fileCache));
    return cache.get(key);
  }

  /** Default work is shared by prod and dev targets in a combined pass. */
  const paletteOnly = mode === "palette";

  /** Prepared default palette/theme work reused by selected target groups. */
  const baseline = await prepareTarget(defaultTarget, paletteOnly, undefined, readInput, snapshot, operations);

  /** Selected prepared targets and their combined artifact map. */
  const selected = [],
    output = new Map();

  for (const target of targets.filter(
    (candidate) => mode === "all" || candidate.group === (mode === "palette" ? "prod" : mode),
  )) {
    /** Each required target compiles at most once. */
    const prepared =
      target === defaultTarget
        ? baseline
        : await prepareTarget(target, paletteOnly, baseline.palette, readInput, snapshot, operations);

    selected.push(prepared);

    for (const [path, text] of prepared.outputs) output.set(path, text);
  }

  if (mode === "all" || mode === "prod")
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

  await prepareOutputs(root, output);
  await assertFresh(expected);

  if (snapshot?.expected) await assertFresh(snapshot.expected);

  if (!recoveryOwner && JSON.stringify(await requireStable(root)) !== JSON.stringify(generation))
    throw Object.assign(new Error("Stale application generation; retry the build."), { code: "STALE_INPUT" });

  return { root, output, expected, selected };
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
  const { root, output, expected, selected } = prepared;

  if (check) {
    await requireStable(root);
    await assertFresh(expected);
  }

  /** Changed paths returned by comparison or coordinated application. */
  const changed = check
    ? await checkOutputs(root, output, "npm run build")
    : await withGuards([root], async ([owner]) => applyArtifacts({ root, output, expected, owner, operations }));

  return {
    changed,
    removed: changed.filter((path) => output.get(path) === null),
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
async function buildThemes(options = {}) {
  return applyBuild(await prepareBuild(options), options);
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
 * @param [options.onProgress] - Report the current quiet stage, or clear it before other output.
 * @returns Preview synchronization result, or undefined for checks and palette-only builds.
 */
export async function runBuild({
  root = repositoryRoot,
  extensionDirectory,
  mode = "all",
  check = false,
  logger = console,
  onProgress,
} = {}) {
  if (!["all", "prod", "dev", "palette"].includes(mode)) throw new Error(`Unknown build mode: ${mode}`);

  logger.log(formatMessage(`${check ? "Checking" : "Building"} ${mode} themes...`, "heading"));
  onProgress?.(`${check ? "Checking" : "Building"} ${mode} theme outputs`);

  /** Both groups validate before the first replacement. */
  const result = await buildThemes({ root, mode, check });

  onProgress?.();

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
    onProgress?.("Synchronizing the development preview");
    preview = await syncDevExtension({ root, extensionDirectory });
  } catch (error) {
    throw Object.assign(
      new Error(`Build completed; preview synchronization failed: ${error.message}. Retry npm run build.`, {
        cause: error,
      }),
      { code: "PREVIEW_SYNC_FAILED" },
    );
  }

  onProgress?.();
  logger.log(formatMessage(`Synced dev manifest: ${preview.manifestPath}`, "success"));

  if (preview.reloadRequired) logReloadReminder(logger);

  return preview;
}

/**
 * Verify an exactly restored build or generator generation without replacing outputs.
 * @param [options] - Owning workflow verification options.
 * @param [options.root] - Checkout or fixture root.
 * @param [options.operation] - build, add-properties, or add-theme.
 */
export async function verifyBuildRestored({ root = repositoryRoot, operation = "build" } = {}) {
  return verifyRestored(
    root,
    async (_marker, owner) => {
      await prepareBuild({ root, recoveryOwner: owner });
    },
    operation,
  );
}

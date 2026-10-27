/**
 * Active consumer and reachability audit.
 * @file Detect retired locations/contracts, unreachable owned modules, unused exports, and unresolved dynamic imports without executing workflows.
 */

import { auditModules } from "./reachability.js";
import { readFile, readdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { repositoryRoot } from "../shared/paths.js";
import { requireStable } from "../shared/transactions.js";
import { parseFormat } from "../tokens/formats.js";
import {
  retiredPaths,
  configurationRoots,
  legacyOccurrences,
  testInterfaces,
  historicalFixtures,
} from "./inventory.js";

/**
 * Run repository-wide retired-path/format and executable reachability checks without writes/network/builds.
 * @param [options] - Isolated checker options.
 * @param [options.root] - Checkout or fixture root.
 * @param [options.configuration] - Explicit configuration roots for fixture audits.
 */
export async function checkLegacy({ root = repositoryRoot, configuration = configurationRoots } = {}) {
  await requireStable(root);

  /** Recursive path inventory excludes dependencies, Git metadata, and ignored caches. */
  const paths = [];

  /**
   * Read the active checkout inventory without traversing symlink directories.
   * @param directory - Repository-relative directory.
   */
  async function visit(directory) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if ([".git", "node_modules", ".cache", "dist", ".agents", ".codex"].includes(entry.name)) continue;

      /** Normalized active path used by exact inventory checks. */
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      paths.push(path);
      if (entry.isDirectory()) await visit(path);
    }
  }

  await visit("");

  /** Accumulated findings remain read-only; no compatibility fallback is attempted. */
  const failures = [],
    sources = new Map();

  /** Parsed command configuration supplying explicit executable roots. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  /** Supported runtime and configuration entry-point filenames. */
  const roots = [...configuration];

  for (const command of Object.values(manifest.scripts ?? {})) {
    for (const match of command.matchAll(/(?:^|\s)node\s+([^\s]+\.js)(?:\s|$)/g)) roots.push(match[1]);
  }

  for (const path of paths) {
    if (
      retiredPaths.some((retired) => path === retired || path.startsWith(`${retired}/`) || path.endsWith(`/${retired}`))
    )
      failures.push(`Retired path exists: ${path}`);

    if (/^src\/themes\/[^/]+\/[^/]+\/details(?:\/|$)/.test(path))
      failures.push(`Retired theme details path exists: ${path}`);

    /** Historical data and plans remain evidence, while active code/configuration/docs are scanned. */
    const historical =
      historicalFixtures.some((prefix) => path.startsWith(prefix)) ||
      path.startsWith("docs/plans/") ||
      path.startsWith("preview/snapshots/") ||
      path === "CHANGELOG.md" ||
      path.startsWith("docs/references/comparisons/") ||
      path.startsWith("docs/references/palettes/") ||
      path === "docs/references/refactor-2b/checkpoints.md";

    /** Whether this owned file belongs in the executable module graph. */
    const executable =
      path.endsWith(".js") && (/^(?:tooling|scripts|tests)\//.test(path) || !path.includes("/")) && !historical;

    if (executable) sources.set(path, await readFile(join(root, path), "utf8"));

    if (historical || path === "tooling/maintenance/inventory.js" || !/\.(?:js|json|jsonc|md|yml|yaml|sh)$/.test(path))
      continue;

    if (!(await lstat(join(root, path))).isFile()) continue;

    /** Active maintained text checked against exact retained legacy-occurrence allowances. */
    const source = await readFile(join(root, path), "utf8");

    if (/src\/themes\/(?:prod|dev)\/[^/\s"'`]+\/details(?:[/"'`]|$)/.test(source))
      failures.push(`${path}: retired active theme details path`);

    for (const retired of retiredPaths) {
      /** Literal occurrences are path contracts, not generic source/for words. */
      const count = source.split(retired).length - 1;

      /** Exact reviewed exception for this active occurrence or transition. */
      const exception = legacyOccurrences.find(
        (entry) => entry.path === path && entry.text === retired && entry.reason,
      );

      if (count && (!exception || count > exception.maximum))
        failures.push(`${path}: retired active reference ${retired} (${count} occurrence(s))`);
    }

    /** Schema-specific traversal rejects retired category/detail spellings without banning ordinary text. */
    const match = path.match(
      /^src\/(?:themes\/[^/]+\/[^/]+\/tokens|token-data)\/(variables|ui|semantic|syntax)\/(definitions|details)\.jsonc$/,
    );

    if (match) {
      try {
        parseFormat(source, path, match[1], match[2], { shared: path.startsWith("src/token-data/") });
      } catch (error) {
        failures.push(error.message);
      }
    }
  }

  // Configuration-driven JavaScript commands must resolve even when they are not imports.
  for (const path of paths.filter(
    (path) =>
      /\.(?:json|jsonc|yml|yaml|sh)$/.test(path) &&
      !historicalFixtures.some((prefix) => path.startsWith(prefix)) &&
      !path.startsWith("docs/") &&
      !path.startsWith("preview/snapshots/") &&
      !path.startsWith("samples/"),
  )) {
    if (!(await lstat(join(root, path))).isFile()) continue;

    /** Concrete subprocess/configuration references are executable graph roots. */
    const source = await readFile(join(root, path), "utf8");

    for (const match of source.matchAll(/(?:^|[\s"'])node\s+((?:scripts|tooling)\/[^\s"']+\.js)/g))
      roots.push(match[1]);
  }

  failures.push(
    ...auditModules({
      sources,
      roots: [...new Set(roots)],
      testRoots: [...sources.keys()].filter((path) => path.startsWith("tests/") && path.endsWith(".test.js")),
      interfaces: testInterfaces,
    }),
  );

  if (failures.length) throw new Error(failures.join("\n"));

  return { modules: sources.size, roots: new Set(roots).size };
}

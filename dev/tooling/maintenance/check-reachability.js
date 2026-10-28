/**
 * Repository executable reachability audit.
 * @file Discover current commands and configuration roots, then reject unreachable modules, unused exports, and unresolved references.
 */

import { auditModules } from "./reachability.js";
import { readFile, readdir, lstat } from "node:fs/promises";
import { join } from "node:path";
import { repositoryRoot } from "../shared/paths.js";
import { requireStable } from "../shared/transactions.js";
import { configurationRoots, testInterfaces } from "./inventory.js";

/**
 * Audit current executable consumers without writes, network access, or builds.
 * @param [options] - Isolated checker options.
 * @param [options.root] - Checkout or fixture root.
 * @param [options.configuration] - Explicit configuration roots for fixture audits.
 * @returns Audited executable module and unique entry-point counts.
 */
export async function checkReachability({ root = repositoryRoot, configuration = configurationRoots } = {}) {
  await requireStable(root);

  /** Checkout paths omit dependencies, metadata, caches, and upstream extraction data. */
  const paths = [];

  /**
   * Inventory maintained files without following directory symlinks.
   * @param directory - Repository-relative directory.
   */
  async function visit(directory) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if ([".git", "node_modules", ".cache", "dist", ".agents", ".codex"].includes(entry.name)) continue;

      /** Normalized checkout path used for module and configuration discovery. */
      const path = directory ? `${directory}/${entry.name}` : entry.name;

      if (path === "dev/tests/fixtures/upstream") continue;

      paths.push(path);

      if (entry.isDirectory()) await visit(path);
    }
  }

  await visit("");

  /** Owned JavaScript source modules and supported command/configuration entry points. */
  const sources = new Map(),
    roots = [...configuration];

  /** Package commands declare supported executables independently of imports. */
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

  for (const command of Object.values(manifest.scripts ?? {})) {
    for (const match of command.matchAll(/(?:^|\s)node\s+([^\s]+\.js)(?:\s|$)/g)) roots.push(match[1]);
  }

  for (const path of paths) {
    if (path.endsWith(".js") && (/^dev\/(?:tooling|scripts|tests)\//.test(path) || !path.includes("/")))
      sources.set(path, await readFile(join(root, path), "utf8"));

    if (
      !/\.(?:json|jsonc|yml|yaml|sh)$/.test(path) ||
      /^dev\/(?:docs|preview|samples)\//.test(path) ||
      !(await lstat(join(root, path))).isFile()
    )
      continue;

    /** Concrete subprocess/configuration references are executable graph roots. */
    const source = await readFile(join(root, path), "utf8");

    for (const match of source.matchAll(/(?:^|[\s"'])node\s+(dev\/(?:scripts|tooling)\/[^\s"']+\.js)/g))
      roots.push(match[1]);
  }

  /** Graph findings are collected before reporting a single actionable failure. */
  const failures = auditModules({
    sources,
    roots: [...new Set(roots)],
    testRoots: [...sources.keys()].filter((path) => path.startsWith("dev/tests/") && path.endsWith(".test.js")),
    interfaces: testInterfaces,
  });

  if (failures.length) throw new Error(failures.join("\n"));

  return { modules: sources.size, roots: new Set(roots).size };
}

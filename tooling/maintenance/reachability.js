/**
 * Executable graph analysis.
 * @file Resolve static imports, dynamic literal imports, module URLs, and explicit subprocess/configuration entry points.
 */

import { parse } from "acorn";
import { dirname, relative, resolve } from "node:path";

/**
 * Visit actual syntax nodes, excluding arbitrary strings/comments from graph inference.
 * @param node - Parsed JavaScript node.
 * @param visit - Syntax-node visitor.
 * @param [ancestors] - Parent nodes used to distinguish executable references from fixture data creation.
 */
function walk(node, visit, ancestors = []) {
  if (!node || typeof node !== "object") return;

  if (typeof node.type === "string") visit(node, ancestors);

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, [...ancestors, node]);
    } else if (value && typeof value === "object") walk(value, visit, [...ancestors, node]);
  }
}

/**
 * Analyze a supplied executable graph with explicit runtime/configuration and test roots.
 * @param options - Graph inputs.
 * @param options.sources - Owned module source map using root-relative paths.
 * @param options.roots - Supported runtime/configuration roots.
 * @param [options.testRoots] - Independently discovered executable suites.
 * @param [options.interfaces] - Narrow justified test-only production exports.
 */
export function auditModules({ sources, roots, testRoots = [], interfaces = [] }) {
  /** Graph edges retain imported symbols rather than treating any text mention as a consumer. */
  const graph = new Map(),
    failures = [];

  for (const [path, source] of sources) {
    /** Each module's import/reference edges and declared public surface. */
    const edges = [],
      exports = new Set();

    /** Parsed JavaScript syntax tree used for concrete reference analysis. */
    const tree = parse(source, { ecmaVersion: "latest", sourceType: "module", allowHashBang: true, locations: true });

    /**
     * Resolve a concrete import/module-URL/subprocess filename, rejecting missing owned targets.
     * @param specifier - Literal module reference.
     * @param symbols - Imported public names or star for a namespace/executable root.
     * @param [fromRoot] - Whether a configured command path is root-relative.
     */
    function edge(specifier, symbols, fromRoot = false) {
      if (!fromRoot && !specifier.startsWith(".")) return;

      /** POSIX-normalized owned module identity. */
      const target = relative("/", resolve("/", fromRoot ? "" : dirname(path), specifier));

      if (!sources.has(target)) {
        failures.push(`${path}: missing executable reference ${specifier} (${target})`);
        return;
      }

      edges.push({ target, symbols });
    }

    walk(tree, (node, ancestors) => {
      if (node.type === "ImportDeclaration")
        edge(
          node.source.value,
          node.specifiers.map((specifier) =>
            specifier.type === "ImportNamespaceSpecifier"
              ? "*"
              : specifier.type === "ImportDefaultSpecifier"
                ? "default"
                : specifier.imported.name,
          ),
        );

      if (node.type === "ImportExpression") {
        if (node.source.type === "Literal" && typeof node.source.value === "string") edge(node.source.value, ["*"]);
        else
          failures.push(
            `${path}:${node.loc.start.line}: unresolved dynamic import; declare a concrete reviewed entry point`,
          );
      }

      if (node.type === "ExportDefaultDeclaration") exports.add("default");

      if (node.type === "ExportNamedDeclaration") {
        if (node.source)
          edge(
            node.source.value,
            node.specifiers.map((specifier) => specifier.local.name),
          );

        if (node.declaration?.id) exports.add(node.declaration.id.name);

        for (const declaration of node.declaration?.declarations ?? []) {
          if (declaration.id.type !== "Identifier")
            failures.push(`${path}: exported destructuring needs an explicit reviewed public surface`);
          else exports.add(declaration.id.name);
        }

        for (const specifier of node.specifiers) exports.add(specifier.exported.name);
      }

      if (node.type === "ExportAllDeclaration") edge(node.source.value, ["*"]);

      if (node.type === "NewExpression" && node.callee.name === "URL") {
        /** Static module URLs include independently invoked child-process fixtures. */
        const specifier = node.arguments[0]?.value;
        if (typeof specifier === "string" && specifier.endsWith(".js")) edge(specifier, ["*"]);
      }

      if (
        node.type === "CallExpression" &&
        ["join", "resolve"].includes(node.callee.name) &&
        ancestors.some(
          (parent) =>
            parent.type === "CallExpression" &&
            ["run", "execute", "execFile", "fork", "spawn", "spawnSync", "execFileSync"].includes(
              parent.callee.name ?? parent.callee.property?.name,
            ),
        )
      ) {
        for (const argument of node.arguments) {
          if (typeof argument.value === "string" && /^(?:scripts|tooling)\/.*\.js$/.test(argument.value))
            edge(argument.value, ["*"], true);
        }
      }
    });

    graph.set(path, { edges, exports });
  }

  /**
   * Traverse concrete executable roots, tracking consumed exports along reachable edges.
   * @param entrypoints - Declared supported roots.
   */
  function reachable(entrypoints) {
    /** Visited modules, symbol consumers, and pending module work. */
    const visited = new Set(),
      used = new Map(),
      queue = [...entrypoints];

    for (const root of entrypoints) used.set(root, new Set(["default"]));

    while (queue.length) {
      /** Next owned module or an invalid declared entry point. */
      const path = queue.pop();

      if (visited.has(path)) continue;

      if (!graph.has(path)) {
        failures.push(`Missing declared executable root: ${path}`);
        continue;
      }

      visited.add(path);

      for (const { target, symbols } of graph.get(path).edges) {
        if (!used.has(target)) used.set(target, new Set());
        for (const symbol of symbols) used.get(target).add(symbol);
        queue.push(target);
      }
    }

    return { visited, used };
  }

  /** Runtime/configuration reachability is distinct from test-only reachability. */
  const runtime = reachable(roots),
    tests = reachable(testRoots);

  for (const [path, module] of graph) {
    if (!runtime.visited.has(path) && !tests.visited.has(path)) failures.push(`Unreachable executable module: ${path}`);

    if (!runtime.visited.has(path)) {
      if (path.startsWith("tooling/") || path.startsWith("scripts/"))
        failures.push(`Production module reachable only from tests: ${path}`);

      continue;
    }

    for (const symbol of module.exports) {
      if (runtime.used.get(path)?.has(symbol) || runtime.used.get(path)?.has("*")) continue;

      /** A retained pure test surface needs a concrete consumer and individually stated purpose. */
      const exception = interfaces.find(
        (entry) =>
          entry.path === path &&
          entry.symbol === symbol &&
          entry.reason &&
          tests.visited.has(entry.consumer) &&
          graph.get(entry.consumer)?.edges.some((edge) => edge.target === path && edge.symbols.includes(symbol)),
      );

      if (!exception)
        failures.push(
          `${tests.used.get(path)?.has(symbol) ? "Test-only production export needs review" : "Unused production export"}: ${path}#${symbol}`,
        );
    }
  }

  return failures;
}

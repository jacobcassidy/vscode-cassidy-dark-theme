/**
 * Static upstream extraction.
 * @file Read TypeScript registrations, imported constants, localization messages, and extension manifests without executing upstream code.
 */

import ts from "typescript";
import { dirname, posix } from "node:path";
import { parseJsonc } from "../../shared/jsonc.js";

/**
 * Extract registrations and grammar evidence from one immutable source snapshot.
 * @param source - Verified identity and frozen source-relative file bytes.
 * @param [signal] - Invocation cancellation signal.
 */
export function extractSource(source, signal) {
  /** Parsed modules, resolved registrations, and explicit unresolved diagnostics. */
  const modules = new Map(),
    ui = new Map(),
    types = new Map(),
    modifiers = new Map(),
    scopes = new Map(),
    warnings = [];

  /**
   * Resolve source-relative imports without executing package resolution or code.
   * @param path - Importing module.
   * @param specifier - Literal module specifier.
   */
  function importPath(path, specifier) {
    if (!specifier.startsWith(".")) return undefined;

    /** Source imports often use runtime .js suffixes for TypeScript files. */
    const base = posix.normalize(posix.join(dirname(path), specifier)).replace(/\.js$/, "");

    return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`].find((candidate) =>
      source.files.has(candidate),
    );
  }

  /**
   * Parse a module and index static declarations/imports before evaluating references.
   * @param path - Source-relative module path.
   */
  function module(path) {
    if (modules.has(path)) return modules.get(path);

    /** AST nodes remain data; no upstream module is imported into this process. */
    const tree = ts.createSourceFile(path, source.files.get(path).toString(), ts.ScriptTarget.Latest, true);
    const declarations = new Map(),
      imports = new Map();
    const result = { tree, declarations, imports };

    modules.set(path, result);

    /**
     * Index variables and literal module bindings recursively.
     * @param node - Current AST node.
     */
    function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        declarations.set(node.name.text, node.initializer);
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        /** Relative dependency path belongs to the verified frozen input set. */
        const dependency = importPath(path, node.moduleSpecifier.text),
          clause = node.importClause;

        if (dependency && clause?.name) imports.set(clause.name.text, { path: dependency, name: "default" });
        if (dependency && clause?.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings))
            imports.set(clause.namedBindings.name.text, { path: dependency });
          else {
            for (const element of clause.namedBindings.elements)
              imports.set(element.name.text, {
                path: dependency,
                name: element.propertyName?.text ?? element.name.text,
              });
          }
        }
      }

      if (ts.isExportAssignment(node)) declarations.set("default", node.expression);
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause)
      ) {
        /** Re-exported constants retain their original source module. */
        const dependency = importPath(path, node.moduleSpecifier.text);

        if (dependency) {
          for (const element of node.exportClause.elements)
            imports.set(element.name.text, { path: dependency, name: element.propertyName?.text ?? element.name.text });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(tree);

    return result;
  }

  /**
   * Evaluate only supported static AST expressions, bounded against cycles/deep nesting.
   * @param node - Static expression candidate.
   * @param path - Owning module path.
   * @param [seen] - Active identifier/reference chain.
   */
  function evaluate(node, path, seen = []) {
    if (!node || seen.length > 40) return undefined;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isSatisfiesExpression(node)
    )
      return evaluate(node.expression, path, seen);
    if (ts.isIdentifier(node)) {
      /** Reference identity prevents cycles spanning imported constants. */
      const key = `${path}:${node.text}`,
        binding = module(path).imports.get(node.text);

      if (seen.includes(key)) return undefined;
      if (binding?.name)
        return evaluate(module(binding.path).declarations.get(binding.name), binding.path, [...seen, key]);

      return evaluate(module(path).declarations.get(node.text), path, [...seen, key]);
    }

    if (ts.isPropertyAccessExpression(node)) {
      /** Namespace-import member can be resolved without executing the imported module. */
      const binding = ts.isIdentifier(node.expression) && module(path).imports.get(node.expression.text);

      if (binding && !binding.name)
        return evaluate(module(binding.path).declarations.get(node.name.text), binding.path, [
          ...seen,
          `${path}:${node.getText()}`,
        ]);

      return evaluate(node.expression, path, seen)?.[node.name.text];
    }

    if (ts.isObjectLiteralExpression(node)) {
      /** Static property map, retaining unresolved values rather than running dynamic getters. */
      const value = {};

      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) value[property.name.text] = evaluate(property.initializer, path, seen);
      }

      return value;
    }

    if (ts.isArrayLiteralExpression(node)) return node.elements.map((element) => evaluate(element, path, seen));
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      /** Concatenation is accepted only when both operands are static strings. */
      const left = evaluate(node.left, path, seen),
        right = evaluate(node.right, path, seen);

      return typeof left === "string" && typeof right === "string" ? left + right : undefined;
    }

    if (ts.isTemplateExpression(node)) {
      /** Template spans must all resolve statically. */
      let value = node.head.text;

      for (const span of node.templateSpans) {
        /** Static interpolated text or number. */
        const part = evaluate(span.expression, path, seen);

        if (!["string", "number"].includes(typeof part)) return undefined;

        value += part + span.literal.text;
      }

      return value;
    }

    if (ts.isCallExpression(node) && /(?:^|\.)localize2?$/.test(node.expression.getText()))
      return evaluate(node.arguments[1], path, seen);

    return undefined;
  }

  /**
   * Record a supported static registration with immutable source identity and category evidence.
   * @param collection - Family-specific registration map.
   * @param id - Static canonical registration name.
   * @param description - Static registration description.
   * @param path - Verified source-relative path.
   * @param [deprecated] - Explicit upstream retirement evidence.
   */
  function register(collection, id, description, path, deprecated = false) {
    if (typeof id !== "string" || !id.trim() || typeof description !== "string" || !description.trim()) {
      warnings.push(`${source.identity.id}:${path}: unresolved dynamic registration`);

      return;
    }

    /** Stable-first precedence is applied by the updater across inputs, never by execution order. */
    const category =
      source.identity.kind === "extension"
        ? "nonStandard"
        : deprecated
          ? "deprecated"
          : source.identity.id === "vscode-main"
            ? "sourceCode"
            : "standard";

    if (!collection.has(id))
      collection.set(id, {
        description,
        category,
        inputId: source.identity.id,
        revision: source.identity.revision,
        path,
        ...(source.identity.contributor ? { extensionId: source.identity.contributor } : {}),
      });
  }

  for (const [path, bytes] of source.files) {
    signal?.throwIfAborted();

    if (/\.(?:ts|tsx|js)$/.test(path)) {
      /** Parsed source module visited for supported registration calls only. */
      const parsed = module(path);

      if (parsed.tree.parseDiagnostics.length)
        throw new Error(`${source.identity.id}:${path}: invalid TypeScript extraction input`);

      /**
       * Extract static calls while reporting dynamic forms explicitly.
       * @param node - AST node.
       */
      function visit(node) {
        if (ts.isCallExpression(node)) {
          /** Callable leaf name supports namespace/property registrations. */
          const name = ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : ts.isIdentifier(node.expression)
              ? node.expression.text
              : "";

          if (name === "registerColor")
            register(
              ui,
              evaluate(node.arguments[0], path),
              evaluate(node.arguments[2], path),
              path,
              Boolean(evaluate(node.arguments[4], path)),
            );
          if (name === "registerTokenType")
            register(types, evaluate(node.arguments[0], path), evaluate(node.arguments[1], path), path);
          if (name === "registerTokenModifier")
            register(modifiers, evaluate(node.arguments[0], path), evaluate(node.arguments[1], path), path);
        }

        ts.forEachChild(node, visit);
      }

      visit(parsed.tree);
    } else if (/(?:^|\/)package\.json$/.test(path)) {
      /** Manifest contributions are parsed as data, with adjacent localization substitution. */
      const manifest = parseJsonc(bytes.toString(), path).value;
      const translations = source.files.get(posix.join(dirname(path), "package.nls.json"));
      const messages = translations ? parseJsonc(translations.toString(), path).value : {};

      /**
       * Resolve literal manifest messages from their verified localization dependency.
       * @param value - Manifest description field.
       */
      function message(value) {
        return typeof value === "string" && /^%.*%$/.test(value) ? messages[value.slice(1, -1)] : value;
      }

      for (const color of manifest.contributes?.colors ?? []) register(ui, color.id, message(color.description), path);
      for (const type of manifest.contributes?.semanticTokenTypes ?? [])
        register(types, type.id, message(type.description), path);
      for (const modifier of manifest.contributes?.semanticTokenModifiers ?? [])
        register(modifiers, modifier.id, message(modifier.description), path);
    } else if (/\.(?:json|jsonc)$/.test(path) && /(?:syntaxes\/|tmLanguage)/.test(path)) {
      /** Exact grammar scope names provide evidence, never substring-expanded selectors. */
      const grammar = parseJsonc(bytes.toString(), path).value;

      /**
       * Collect exact grammar names/coverage from static JSON structures.
       * @param value - Current grammar node.
       */
      function grammarScopes(value) {
        if (!value || typeof value !== "object") return;

        for (const key of ["scopeName", "name", "contentName"]) {
          if (typeof value[key] === "string" && value[key].trim())
            scopes.set(value[key], {
              selector: value[key],
              category:
                source.identity.kind === "extension"
                  ? "nonStandard"
                  : source.identity.id === "vscode-main"
                    ? "sourceCode"
                    : "standard",
              inputId: source.identity.id,
              revision: source.identity.revision,
              path,
              ...(source.identity.contributor ? { extensionId: source.identity.contributor } : {}),
            });
        }

        for (const child of Object.values(value)) grammarScopes(child);
      }

      grammarScopes(grammar);
    }
  }

  return { identity: source.identity, ui, types, modifiers, scopes, warnings };
}

/**
 * Describe a supported exact semantic type/modifier combination without inventing provider behavior.
 * @param selector - Exact authored selector.
 * @param types - Stable-first extracted type registrations.
 * @param modifiers - Stable-first extracted modifier registrations.
 */
export function semanticDescription(selector, types, modifiers) {
  /** Exact type/modifier sequence, retaining language qualifiers as context. */
  const [bare, language] = selector.split(":"),
    [type, ...suffixes] = bare.split(".");
  const base = type === "*" ? { description: "Symbols of any semantic token type." } : types.get(type);
  const records = suffixes.map((modifier) => modifiers.get(modifier));

  if (!base || records.some((record) => !record)) return undefined;

  /** Description origin is a concrete contributing registration when one exists. */
  const origin = types.get(type) ?? records[0];

  if (!origin) return undefined;

  return {
    ...origin,
    description: [
      base.description,
      ...records.map((record) => record.description),
      ...(language ? [`Language: ${language}.`] : []),
    ].join(" "),
    category: [base, ...records].some((record) => record.category === "nonStandard") ? "nonStandard" : origin.category,
  };
}

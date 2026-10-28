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
export async function extractSource(source, signal) {
  /** Parsed modules, resolved registrations, and explicit unresolved diagnostics. */
  const modules = new Map(),
    ui = new Map(),
    types = new Map(),
    modifiers = new Map(),
    scopes = new Map(),
    scopeDescriptions = new Map(),
    uiDefaults = new Map(),
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

    /** Static declarations and imported bindings indexed for reference resolution. */
    const declarations = new Map(),
      imports = new Map(),
      stars = [];

    /** Parsed module with its static declaration and import indexes. */
    const result = { tree, declarations, imports, stars };

    modules.set(path, result);

    /**
     * Index variables and literal module bindings recursively.
     * @param node - Current AST node.
     */
    function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.parent?.parent?.parent === tree)
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

      if (
        ts.isExportDeclaration(node) &&
        !node.exportClause &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        /** Wildcard re-exports are resolved only through verified relative dependencies. */
        const dependency = importPath(path, node.moduleSpecifier.text);
        if (dependency) stars.push(dependency);
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
   * Follow static imported/re-exported bindings through the frozen module index.
   * @param path - Owning source-relative module.
   * @param name - Exact declared or imported binding name.
   * @param seen - Active reference chain used to reject cycles.
   */
  function reference(path, name, seen) {
    /** Module/name identity bounds cyclic re-exports without executing source code. */
    const key = `${path}:${name}`,
      data = module(path),
      binding = data.imports.get(name);

    if (seen.includes(key) || seen.length > 40) return undefined;

    if (data.declarations.has(name)) return evaluate(data.declarations.get(name), path, [...seen, key]);

    if (binding?.name) return reference(binding.path, binding.name, [...seen, key]);

    /** Conflicting wildcard exports stay unresolved instead of receiving arbitrary precedence. */
    const values =
      name === "default"
        ? []
        : data.stars
            .map((dependency) => reference(dependency, name, [...seen, key]))
            .filter((value) => value !== undefined);

    return values.length && values.every((value) => JSON.stringify(value) === JSON.stringify(values[0]))
      ? values[0]
      : undefined;
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
      /** Lexical scopes prevent unrelated local bindings from masquerading as global registrations. */
      let parent = node.parent;

      while (parent && !ts.isSourceFile(parent)) {
        if (ts.isBlock(parent) || ts.isModuleBlock(parent)) {
          for (const statement of parent.statements) {
            if (!ts.isVariableStatement(statement)) continue;

            for (const declaration of statement.declarationList.declarations) {
              if (ts.isIdentifier(declaration.name) && declaration.name.text === node.text) {
                /** Local reference identity also bounds initializer cycles. */
                const key = `${path}:${declaration.pos}:${node.text}`;
                return seen.includes(key) ? undefined : evaluate(declaration.initializer, path, [...seen, key]);
              }
            }
          }
        }

        if (
          ts.isFunctionLike(parent) &&
          parent.parameters.some((parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === node.text)
        )
          return undefined;

        parent = parent.parent;
      }

      return reference(path, node.text, seen);
    }

    if (ts.isPropertyAccessExpression(node)) {
      /** Namespace-import member can be resolved without executing the imported module. */
      const binding = ts.isIdentifier(node.expression) && module(path).imports.get(node.expression.text);

      if (binding && !binding.name) return reference(binding.path, node.name.text, seen);

      /** Localize2 exposes value/original on a statically known message. */
      const value = evaluate(node.expression, path, seen);

      return typeof value === "string" && ["value", "original"].includes(node.name.text)
        ? value
        : value?.[node.name.text];
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

    if (ts.isCallExpression(node) && /(?:^|\.)registerColor$/.test(node.expression.getText()))
      return evaluate(node.arguments[0], path, seen);

    if (ts.isCallExpression(node) && /(?:^|\.)localize2?$/.test(node.expression.getText()))
      return evaluate(node.arguments[1], path, seen);

    return undefined;
  }

  /**
   * Follow default-color references and supported transforms without executing source code.
   * @param node - Default expression or referenced initializer.
   * @param path - Source-relative owning module.
   * @param [seen] - Binding identities already visited on this reference path.
   * @returns Candidate color IDs, filtered against registrations after extraction.
   */
  function colorReferences(node, path, seen = []) {
    if (!node || seen.length > 40) return [];

    /** Statically resolved color identifiers include constants returned by registerColor. */
    const value = evaluate(node, path);

    if (typeof value === "string") return [value];

    if (ts.isIdentifier(node)) {
      /** Module binding identity bounds cyclic default expressions. */
      const key = `${path}:${node.text}`;

      if (seen.includes(key)) return [];

      /** Initializer or imported binding to inspect when its transform is not a literal value. */
      const data = module(path),
        binding = data.imports.get(node.text);

      if (data.declarations.has(node.text))
        return colorReferences(data.declarations.get(node.text), path, [...seen, key]);

      if (binding?.name)
        return colorReferences(module(binding.path).declarations.get(binding.name), binding.path, [...seen, key]);
    }

    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
      return colorReferences(node.expression, path, seen);

    if (ts.isObjectLiteralExpression(node))
      return node.properties.flatMap((property) =>
        ts.isPropertyAssignment(property) ? colorReferences(property.initializer, path, seen) : [],
      );

    if (ts.isConditionalExpression(node))
      return [...colorReferences(node.whenTrue, path, seen), ...colorReferences(node.whenFalse, path, seen)];

    if (ts.isCallExpression(node)) {
      /** Only known color transformations provide evidence of fallback color dependencies. */
      const name = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : node.expression.getText();

      if (["transparent", "darken", "lighten", "oneOf", "lessProminent", "opaque", "ifDefinedThenElse"].includes(name))
        return [...node.arguments]
          .slice(name === "ifDefinedThenElse" ? 1 : 0)
          .flatMap((argument) => colorReferences(argument, path, seen));
    }

    return [];
  }

  /**
   * Record a supported static registration with immutable source identity and category evidence.
   * @param collection - Family-specific registration map.
   * @param id - Static canonical registration name.
   * @param description - Static registration description.
   * @param path - Verified source-relative path.
   * @param [deprecated] - Explicit upstream retirement evidence.
   * @param [context] - Source expression and position for an unresolved registration.
   * @param [context.name] - Registration API name.
   * @param [context.expression] - Source expression passed as the registration ID.
   * @param [context.position] - One-based source line and column.
   * @param [defaults] - UI default-color expression retained for inheritance extraction.
   */
  function register(collection, id, description, path, deprecated = false, context, defaults) {
    if (typeof id !== "string" || !id.trim()) {
      const registration = context ?? {
        name: "registration",
        expression: "<unavailable>",
        position: "unknown location",
      };

      warnings.push(
        `${source.identity.id}\t${path}\t${registration.position}\t${registration.name} ID expression ${JSON.stringify(registration.expression)}: unresolved dynamic registration`,
      );

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

    if (!collection.has(id)) {
      if (collection === ui && defaults) uiDefaults.set(id, { node: defaults, path });

      collection.set(id, {
        description: typeof description === "string" && description.trim() ? description : undefined,
        category,
        inputId: source.identity.id,
        revision: source.identity.revision,
        path,
        ...(source.identity.contributor ? { extensionId: source.identity.contributor } : {}),
      });
    }
  }

  for (const [path, bytes] of source.files) {
    await new Promise(setImmediate);
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
        if (
          ts.isPropertyAssignment(node) &&
          ts.isStringLiteral(node.name) &&
          /^terminal\.ansi[A-Z]/.test(node.name.text)
        )
          register(ui, node.name.text, undefined, path);

        if (ts.isCallExpression(node)) {
          /** Callable leaf name supports namespace/property registrations. */
          const name = ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : ts.isIdentifier(node.expression)
              ? node.expression.text
              : "";

          if (["registerColor", "registerTokenType", "registerTokenModifier"].includes(name)) {
            /** Exact unresolved registration argument and one-based source position for terminal review. */
            const context = {
              name,
              expression: node.arguments[0]?.getText(parsed.tree).replaceAll(/\s+/g, " ") ?? "<missing ID argument>",
              position: (() => {
                const { line, character } = parsed.tree.getLineAndCharacterOfPosition(node.getStart(parsed.tree));
                return `${line + 1}:${character + 1}`;
              })(),
            };

            if (name === "registerColor")
              register(
                ui,
                evaluate(node.arguments[0], path),
                evaluate(node.arguments[2], path),
                path,
                Boolean(evaluate(node.arguments[4], path)),
                context,
                node.arguments[1],
              );

            if (name === "registerTokenType")
              register(
                types,
                evaluate(node.arguments[0], path),
                evaluate(node.arguments[1], path),
                path,
                false,
                context,
              );

            if (name === "registerTokenModifier")
              register(
                modifiers,
                evaluate(node.arguments[0], path),
                evaluate(node.arguments[1], path),
                path,
                false,
                context,
              );
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(parsed.tree);
    } else if (/(?:^|\/)package\.json$/.test(path)) {
      /** Manifest contributions are parsed as data, with adjacent localization substitution. */
      const manifest = parseJsonc(bytes.toString(), path).value;

      /** Verified adjacent localization bytes, when supplied by the contributor. */
      const translations = source.files.get(posix.join(dirname(path), "package.nls.json"));

      /** Parsed localization messages available for static manifest substitution. */
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
       * @param [root] - Whether this is the grammar root with a human-readable name.
       */
      function grammarScopes(value, root = false) {
        if (!value || typeof value !== "object") return;

        for (const key of root ? ["scopeName"] : ["name", "contentName"]) {
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

      if (typeof grammar.scopeName === "string" && typeof grammar.name === "string" && grammar.name.trim())
        scopeDescriptions.set(grammar.scopeName, grammar.name);

      grammarScopes(grammar, true);
    }
  }

  for (const [id, { node, path }] of uiDefaults) {
    /** Ordered unique upstream fallbacks; literals and unknown strings are excluded. */
    const inherits = [...new Set(colorReferences(node, path))].filter((parent) => parent !== id && ui.has(parent));

    if (inherits.length) ui.get(id).inherits = inherits;
  }

  return { identity: source.identity, ui, types, modifiers, scopes, scopeDescriptions, warnings };
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

  /** Registered semantic type description, or the wildcard type description. */
  const base = type === "*" ? { description: "Symbols of any semantic token type." } : types.get(type);

  /** Ordered modifier registrations used to describe the exact selector. */
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
    category: [base, ...records].some((record) => record.category === "nonStandard")
      ? "nonStandard"
      : [base, ...records].some((record) => record.category === "sourceCode")
        ? "sourceCode"
        : origin.category,
  };
}

# Development guide

Cassidy Dark is a declarative Visual Studio Code color theme. VS Code loads a generated JSON-with-comments theme file. A Node.js build resolves palette inputs and named color variables into that file; there is no extension runtime or bundler. The release build packages the generated theme and extension metadata into a `.vsix` archive.

Run the commands in this guide from the repository root unless stated otherwise.

## Project structure

| Path                                                            | Purpose                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`package.json`](../../../package.json)                         | Prod extension manifest, dependencies, commands, and generated prod theme registrations.                           |
| [`package-lock.json`](../../../package-lock.json)               | Locked development dependencies.                                                                                   |
| [`src/themes/prod/default/`](../../../src/themes/prod/default/) | The six required default input files.                                                                              |
| [`src/themes/prod/`](../../../src/themes/prod/)                 | Prod targets; additional named themes can omit input files to inherit the default.                                 |
| [`src/themes/dev/`](../../../src/themes/dev/)                   | Dev targets, including `test` and `v1.3`, with the same input layout and default fallback.                         |
| [`themes/`](../../../themes/)                                   | Committed generated prod themes shipped in the VSIX.                                                               |
| [`docs/palettes/archive/`](../../palettes/archive/)             | Preserved palette documentation and previous versions.                                                             |
| [`docs/references/generated/`](./)                              | Development guides and reference material.                                                                         |
| [`docs/plans/`](../../plans/)                                   | Implementation plans, including the completed [restructuring plan 1b](../../plans/archive/restructure-1b-plan.md). |
| [`scripts/themes/`](../../../scripts/themes/)                   | Builds and checks prod and dev palettes/themes.                                                                    |
| [`scripts/dev-extension/`](../../../scripts/dev-extension/)     | Creates and refreshes the dev preview extension's manifest and asset links.                                        |
| [`scripts/lib/`](../../../scripts/lib/)                         | Shared color calculations, palette and variable resolution, JSONC parsing, and target discovery.                   |
| [`scripts/release/`](../../../scripts/release/)                 | VSIX packaging, release notes, pipeline submission, and GitHub publishing.                                         |
| [`tests/`](../../../tests/)                                     | Automated tests and isolated fixtures.                                                                             |

`dev-extension/generated-themes/` contains generated dev themes loaded by the local extension. `dev-extension/static-snapshots/` contains fixed comparison themes that are not regenerated.

Generated palette reports live in each theme source directory’s `colors/generated-palette/` folder.
| [`docs/grammar-samples/`](../grammar-samples/) | Programming, markup, stylesheet, configuration, and log files for inspecting syntax highlighting. |
| [`images/`](../../../images/) | Extension icons and the README screenshot. |
| [`azure-pipelines.yml`](../../../azure-pipelines.yml) | Manual packaging and publication pipeline. |
| [`.vscodeignore`](../../../.vscodeignore) | VSIX exclusions. |
| [`CHANGELOG.md`](../../../CHANGELOG.md) | Versioned release notes used for GitHub releases. |

Shared modules in `scripts/lib/` are named for their responsibilities:

| Module                                                                              | Purpose                                                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`color-math.js`](../../../scripts/lib/color-math.js)                               | Color conversion and validation, gamut limits, hex normalization, alpha handling, and contrast calculations.        |
| [`jsonc-validation.js`](../../../scripts/lib/jsonc-validation.js)                   | JSONC parsing, duplicate-key detection, and object, field, and number validation.                                   |
| [`palette-generation.js`](../../../scripts/lib/palette-generation.js)               | Palette input validation, tone generation, gamut limiting, and documented overrides.                                |
| [`color-variable-resolution.js`](../../../scripts/lib/color-variable-resolution.js) | Named color variable collection, metadata validation, reference resolution, cycle detection, and alpha application. |
| [`theme-source-inputs.js`](../../../scripts/lib/theme-source-inputs.js)             | Theme discovery, filesystem reads, default input fallback, section validation, and theme registration metadata.     |

The published extension ID is `jacobcassidy.cassidy-dark`, combining the manifest's `publisher` and `name`. Its theme picker label is **Cassidy Dark**, with `uiTheme: "vs-dark"`. The manifest declares VS Code compatibility as `^1.64.2`.

The shipped theme has three main sections:

- `colors`: workbench and editor UI colors.
- `semanticTokenColors`: colors for semantic tokens supplied by language tooling; `semanticHighlighting` is enabled.
- `tokenColors`: TextMate scope rules for syntax highlighting.

Although the theme filename ends in `.json`, it includes comments. Preserve this JSON-with-comments format when editing it.

## Local setup and preview

Use VS Code, Git, and Node.js 24 with npm. `.nvmrc` records the Node.js major version, and Azure Pipelines explicitly selects the same major version. If you use nvm, run `nvm use` before installing dependencies.

Install the locked development dependencies:

```bash
npm ci
```

The repository uses ES modules (`"type": "module"`). Its npm dependencies support development tooling; the theme has no production npm dependencies.

### Create and refresh the dev extension

```bash
npm run dev:sync
```

This command runs `npm run build`, which runs `build:prod` for prod targets followed by `build:dev` for dev targets. Then [`scripts/dev-extension/sync.js`](../../../scripts/dev-extension/sync.js) creates or refreshes a separate extension directory at:

```text
~/.vscode/extensions/jacobcassidy.cassidy-dark-dev/
```

The script writes a generated `package.json` there with the name `cassidy-dark-dev` and display name **Cassidy Dark Dev**, and removes the published manifest's `__metadata`. It links the checkout's `themes/`, `dev-extension/`, and `images/` directories into that extension directory. The checkout's `dev-extension/generated-themes/` and `dev-extension/static-snapshots/` directories therefore provide the local extension's generated themes and fixed comparison themes. The source manifest stays in the checkout; the generated dev manifest is a separate file.

The dev manifest registers:

- Every prod theme, including the default as **Cassidy Dark Dev**. Additional prod labels include their target names.
- Every generated dev theme, such as **Cassidy Dark Dev (Test)** and **Cassidy Dark Dev (V1.3)**.
- Every historical comparison with a **Cassidy Dark Snapshot (...)** label.

Theme types are read from generated metadata and mapped to the matching VS Code `uiTheme`. The synchronization script reads prod files to register them but writes only the separate dev extension manifest and asset links. It does not build themes or edit prod inputs.

Run **Developer: Reload Window** in VS Code, then open **Preferences: Color Theme** and select a Cassidy Dark Dev theme. The dev identity allows it to coexist with the Marketplace extension.

Rebuild after changing palette, variable, metadata, or token mapping inputs. The generated theme is linked directly into the dev extension. Theme entries include `_watch: true`; reload the VS Code window if an edit is not reflected. Open the files in `docs/grammar-samples/` and representative files from other languages to inspect highlighting. **Developer: Inspect Editor Tokens and Scopes** helps identify which TextMate or semantic token rules apply.

After changing manifest metadata or adding or removing dev theme files, run `npm run dev:sync` again to refresh the dev manifest and reload VS Code.

The command prints a reload reminder after synchronization. Importing the sync module does not install or change an extension. The function accepts an alternate repository root and extension directory for isolated testing. `dev:sync` exits after synchronization; use `npm run watch` for continuous rebuilding and preview synchronization. The CLI defaults to the standard `~/.vscode/extensions` location; it does not discover custom extension directories or alternate VS Code editions.

For safety, the sync script refuses to use a symlink for the dev extension directory or its generated manifest. Existing asset links must point to this checkout. If the checkout moves, inspect and repair those dev links before running setup again.

### Watch theme changes

```bash
npm run watch
```

[`scripts/themes/watch.js`](../../../scripts/themes/watch.js) builds prod themes, builds dev themes, and syncs the dev extension on startup. It then watches `src/themes/prod/` and `src/themes/dev/` recursively and repeats those steps when you save source changes. You do not need to run `dev:sync` first. Prod defaults are watched because dev themes inherit omitted input files. Creating a dev source tree after startup is supported.

After the initial setup, run **Developer: Reload Window** and select a **Cassidy Dark Dev** theme. Saving source inputs rebuilds the generated JSON; the extension's `_watch: true` entries tell VS Code to reload the selected theme's colors. The command prints another reload reminder when theme registrations change, such as after adding a theme or changing its metadata name or type. Reload VS Code to pick up those registration changes.

The watcher groups saves within 150 ms and runs one build at a time. Edits received during a build queue another pass. Generated themes, palette reports, and the dev extension manifest are outside the watched source trees, so rebuilding does not trigger a loop. Validation or sync errors are printed, remaining steps for that cycle are skipped, and watching continues so the next source edit can retry.

Press **Ctrl+C** to stop. Shutdown closes the file watcher and cancels pending rebuilds while allowing an active build and sync cycle to finish. A native file-watcher failure prints an error and stops the command with a failing exit status.

Restart the command after changing build scripts, formatter configuration, root manifest metadata, or historical snapshots. After deliberately removing or renaming a target, explicitly remove its obsolete generated theme and palette report files, then save a theme source again or restart the command. Existing stale-output checks remain active; the watcher does not delete generated files automatically.

The watcher uses Node.js 24's native file watching without an additional dependency. Its `watchThemes()` function accepts alternate repository and extension directories for isolated use and returns `ready` (the first cycle's completion), `close()` (graceful shutdown), and `closed` (shutdown completion, carrying a native watcher error if one occurred). Importing the module does not start watching or install an extension. Like `dev:sync`, the CLI uses the standard VS Code extensions directory.

### Syntax samples

The files in `docs/grammar-samples/` are source examples for visual inspection; no execution is required.

| Sample                                         | Coverage                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [JavaScript](../grammar-samples/javascript.js) | ES modules, JSDoc types and tags, literals and escapes, regex groups and assertions, Unicode regex sets, templates, destructuring, private and static class members, operators, control flow, generators, and async code. Uses modern JavaScript supported by Node.js 24. |
| [TypeScript](../grammar-samples/typescript.ts) | TypeScript 5.4+ annotations, unions and intersections, conditional and mapped types, infer and template literal types, generics, assertions, overloads, decorators, declaration merging, ambient declarations, resource management, and runtime syntax.                   |
| [Python](../grammar-samples/python.py)         | Python 3.12+ literals and string prefixes, f-strings, regexes, annotations and generic type parameters, decorators, protocols and data classes, comprehensions, pattern matching, exception groups, generators, context managers, and async code.                         |
| [PHP](../grammar-samples/php.php)              | PHP 8.2+ property type probes, PHPDoc, namespace imports, attributes, enums, traits, readonly and anonymous classes, literals and interpolation, regex strings, operators, closures, generators, exceptions, and embedded PHP/HTML with alternative control syntax.       |
| [HTML](../grammar-samples/html.html)           | Tags, attributes, entities, semantic elements, forms, tables, media, templates, custom elements, SVG, MathML, and embedded CSS, JavaScript, and JSON.                                                                                                                     |
| [Markdown](../grammar-samples/markdown.md)     | ATX and Setext headings, emphasis styles, escapes, entities, links and references, images, lists, tasks, quotations, tables, code fences, embedded languages, HTML, footnotes, and math.                                                                                  |
| [CSS](../grammar-samples/css.css)              | Selectors, combinators, attribute operators, pseudo-classes and pseudo-elements, custom properties, colors, units, functions, nesting, layers, keyframes, media/support/container queries, scopes, and paged media.                                                       |
| [SCSS](../grammar-samples/scss.scss)           | Sass modules, variables, interpolation, lists and maps, functions, mixins, content blocks, placeholders, extension, nesting, loops, conditionals, operators, and diagnostics.                                                                                             |
| [JSON](../grammar-samples/json.json)           | Strict JSON strings and escapes, Unicode, numeric forms, booleans, null, unusual keys, nested objects, arrays, and structural punctuation.                                                                                                                                |
| [YAML](../grammar-samples/yaml.yml)            | Directives, multiple documents, quoted and block scalars, numeric forms, tags, explicit keys, anchors, aliases, and block/flow collections.                                                                                                                               |
| [TOML](../grammar-samples/toml.toml)           | TOML 1.0 bare, quoted, and dotted keys; basic, literal, and multiline strings; numeric bases; special floats; dates and times; tables; inline tables; and arrays of tables.                                                                                               |
| [Log](../grammar-samples/log.log)              | Synthetic severity levels, timestamps, syslog and HTTP access lines, paths, URLs, addresses, values, JSON records, stack traces, and diffs.                                                                                                                               |
| [NEON](../grammar-samples/neon.neon)           | Scalars, alternate separators, multiline strings, dates, collections, entities, entity chains, and illustrative Nette DI parameter/service references.                                                                                                                    |
| [Ruby](../grammar-samples/ruby.rb)             | Ruby 3.2+ literals, percent strings, heredocs, interpolation, regexes, symbols, modules, refinements, classes, methods, operators, forwarding, pattern matching, blocks, exceptions, and data sections.                                                                   |
| [XML](../grammar-samples/xml.xml)              | XML declarations, an internal DTD, entity and notation declarations, parameter entities, namespaces, attributes, character references, mixed content, CDATA, processing instructions, and SVG.                                                                            |
| [Go](../grammar-samples/go.go)                 | Go 1.23+ literals, runes, raw strings, struct tags, aliases, generic constraints, interfaces, methods, pointers, collections, operators, type switches, labels, closures, iterators, channels, goroutines, select, defer, panic, and recover.                             |
| [Rust](../grammar-samples/rust.rs)             | Rust 1.77+ with edition 2021: doc comments, attributes, literals and C strings, lifetimes, traits, generics, macros, raw identifiers, ownership and borrowing, patterns, closures, errors, async/await, raw pointers, unions, and C ABI declarations.                     |
| [JSX](../grammar-samples/jsx.jsx)              | Components, member-expression tags, fragments, children, props, spreads, event handlers, conditional rendering, list rendering, entities, custom elements, SVG, and embedded JavaScript.                                                                                  |
| [TSX](../grammar-samples/tsx.tsx)              | JSX with local type declarations, typed props and children, generic components, generic arrow functions, template literal types, discriminated unions, narrowing, assertions, and satisfies.                                                                              |
| [Bash](../grammar-samples/bash.sh)             | Bash 4+ quoting, ANSI strings, parameter and command expansion, indexed and associative arrays, arithmetic, regex tests, functions, loops, case/select, heredocs, process substitution, redirections, traps, and jobs.                                                    |
| [Zsh](../grammar-samples/zsh.zsh)              | Zsh 5+ parameter flags, array and map subscripts, path modifiers, prompt escapes, extended globs and qualifiers, arithmetic, repeat/select, always blocks, heredocs, and streams.                                                                                         |
| [SQL](../grammar-samples/sql.sql)              | SQLite 3.38+ schema definitions, constraints, generated columns, indexes, views, triggers, literals, joins, CTEs, recursion, window functions, aggregates, JSON operators, parameters, upserts, returning, and transactions.                                              |
| [C](../grammar-samples/c.c)                    | C17 preprocessing, macros, comments, literals, structs, unions, enums, bit fields, pointers, function pointers, qualifiers, atomics, alignment, generic selection, designated initializers, varargs, and control flow.                                                    |
| [C++](../grammar-samples/cpp.cpp)              | C++20 namespaces, templates, concepts, requires, attributes, classes, inheritance, operators, raw strings, numeric separators, literals, structured bindings, lambdas, smart pointers, spans, constexpr/consteval, and exceptions.                                        |
| [C#](../grammar-samples/csharp.cs)             | C# 12 / .NET 8 namespaces, XML docs, attributes, records, generics, properties, indexers, events, patterns, raw and interpolated strings, spans, collections, LINQ, iterators, async/await, and preprocessing.                                                            |
| [Vue](../grammar-samples/vue.vue)              | Vue 3.4+ script setup, TypeScript, props/emits/model/slots macros, reactivity, directives, modifiers, conditional/list rendering, scoped slots, dynamic components, transitions, teleport, and scoped/deep/slotted CSS.                                                   |
| [Svelte](../grammar-samples/svelte.svelte)     | Svelte 5 TypeScript, runes, snippets and render tags, bindings, actions, event handlers, each/if/key/await blocks, const/html tags, transitions, animations, special elements, and scoped/global CSS.                                                                     |

Use the matching VS Code language mode. Inspect both a declaration and its references with **Developer: Inspect Editor Tokens and Scopes**. Compare the same text with semantic highlighting enabled and disabled in workspace settings; language tooling can refine the colors beyond the TextMate grammar. Python semantic highlighting depends on the installed Python language tooling. The JavaScript file uses the JavaScript grammar; JSX and TypeScript require their respective language modes and syntax.

The TypeScript sample imports the sibling JavaScript fixture for module and usage-site highlighting. The [samples-only TypeScript configuration](../grammar-samples/tsconfig.json) checks `typescript.ts` and `tsx.tsx`, enabling strict checking, ESNext libraries, NodeNext modules, standard decorators, JavaScript imports, and preserved JSX. The configuration retains its conventional filename so VS Code discovers it automatically. It emits no JavaScript and requires no changes to extension packaging. If a TypeScript compiler is available, run `tsc --project docs/grammar-samples/tsconfig.json` to check it; the repository does not install TypeScript or include that check in `npm run check`. JSX and TSX use framework-independent components; the TSX file declares a minimal local JSX contract without requiring React.

The PHP sample retains its original property type regression probes. It also includes a labeled legacy backtick command-string example for grammar coverage; PHP 8.5 reports that syntax as deprecated during `php -l`. The sample is intended for source inspection, and linting does not execute its examples.

The samples use illustrative URLs and asset references. The SCSS sample uses built-in Sass modules. Ruby command-string examples are wrapped in uncalled lambdas, and the log sample mixes synthetic formats rather than representing one application's output. Markdown lint exceptions and Prettier ignore comments preserve intentional syntax variants in that fixture.

The Go and Rust files use only their standard libraries. With the matching toolchains installed, check them individually using `go build -o /tmp/cassidy-go-sample.a docs/grammar-samples/go.go` and `rustc --edition=2021 --crate-type=lib --emit=metadata -o /tmp/cassidy-rust-sample.rmeta docs/grammar-samples/rust.rs`. These commands compile without running the samples and are separate from `npm run check`. Use `gofmt` for the Go file and `rustfmt --edition 2021` for the Rust file. Semantic highlighting requires the corresponding language tooling and may require opening the sample in a Go module or Cargo project.

Use an installed language extension for NEON or TOML if VS Code does not offer the matching mode. Log highlighting depends on the selected grammar; Output Colorizer can provide additional scopes used by the theme. Markdown footnotes, math, and alerts, along with newer CSS constructs, may receive different scopes depending on grammar and extension support. The NEON sample follows the [NEON format reference](https://doc.nette.org/en/neon/format); its service section illustrates Nette configuration strings without requiring a Nette project.

The shell samples contain uncalled functions; use `bash -n docs/grammar-samples/bash.sh` and `zsh -n docs/grammar-samples/zsh.zsh` for syntax checks. Bash expansion examples require Bash 4+ when executed. Check the C and C++ translation units without linking using `clang -std=c17 -fsyntax-only docs/grammar-samples/c.c` and `clang++ -std=c++20 -fsyntax-only docs/grammar-samples/cpp.cpp`. Validate SQL with `sqlite3 :memory: < docs/grammar-samples/sql.sql`; it creates sample data in memory and rolls back its transaction. C# needs a C# 12 / .NET 8 toolchain for compilation.

Vue and Svelte samples require their respective VS Code language extensions for full embedded-language support. They illustrate [Vue script setup](https://vuejs.org/api/sfc-script-setup.html) and Svelte 5 [state runes](https://svelte.dev/docs/svelte/$state) and [snippets](https://svelte.dev/docs/svelte/snippet). Framework compilers and runtimes are not repository dependencies; the samples are intended for source inspection. The Svelte fixture is explicitly ignored by Prettier because this project does not install a Svelte parser plugin; use the Svelte compiler to check its syntax.

### Editing theme inputs

The prod default lives under `src/themes/prod/default/` and requires these six files:

| Relative input path      | Purpose                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors/palette.jsonc`   | Hue/lightness anchors, optional `baseChroma`, shared chroma settings, neutrals, and documented primitive overrides.                                           |
| `colors/variables.jsonc` | Named color variables with `color`, optional `alpha` below 1, and optional [`details` metadata](token-details.md). Literal hex exceptions require a `reason`. |
| `metadata.jsonc`         | Root properties such as `$schema`, `name`, `type`, and `author`.                                                                                              |
| `tokens/ui.jsonc`        | VS Code `colors` mappings for workbench and editor UI.                                                                                                        |
| `tokens/semantic.jsonc`  | `semanticHighlighting` and `semanticTokenColors` mappings.                                                                                                    |
| `tokens/syntax.jsonc`    | Ordered TextMate `tokenColors` scope rules, styles, and color references.                                                                                     |

Variables resolve by their nested paths. A `color` of `palette.yellow.400` selects a primitive generated from `colors/palette.jsonc`. A `color` of `diagnostic.error.foreground` selects the variable at `diagnostic.error.foreground` in the effective `colors/variables.jsonc`, recursively resolving its own `color`. Token mapping files use whole-string references such as `{diagnostic.error.foreground}` to insert the resolved hex value. See [color variable details](token-details.md#variable-references) for an example of the complete chain.

`details.inherits` documents upstream VS Code behavior; it does not control variable resolution or theme file fallback. Dotted semantic selectors such as `function.defaultLibrary` stay together as keys under `semantic` in the variable file.

### Adding prod or dev themes

Add a directory under `src/themes/prod/<name>/` for a shipped theme, or `src/themes/dev/<name>/` for a dev preview. Theme directory names must be lowercase, begin with a letter, and use only letters, digits, periods, and hyphens. Consecutive periods and trailing periods are rejected. Names must be unique across both source groups even though reports are grouped separately.

Each of the six files is optional outside the prod default. An omitted file uses the file at the same relative path in the default directory. A supplied file replaces that entire file; individual missing keys are not merged or inherited. Empty or invalid supplied files fail validation. Missing or invalid default inputs also fail, even when building dev themes. There is no inheritance chain through other named themes.

For example, to try a different yellow palette locally:

1. Create `src/themes/dev/yellow-test/colors/`.
2. Copy the complete default `colors/palette.jsonc` into it and change the yellow parameters.
3. Omit `colors/variables.jsonc`, `metadata.jsonc`, and the `tokens/` files to inherit the default versions.
4. Run `npm run build:dev` to generate `dev-extension/generated-themes/cassidy-dark-color-theme-yellow-test.json` and `src/themes/dev/yellow-test/colors/generated-palette/palette.{json,md,svg}`.
5. Run `npm run dev:sync` and select **Cassidy Dark Dev (Yellow Test)** in VS Code.

The inherited variable and token mapping files resolve against the dev palette. If you supply a variable file instead, include every variable required by the selected mappings and other variables. Copy the complete default file as a starting point. Changes to a default file affect every target inheriting it.

An existing empty target directory can inherit every file. To track that theme in Git, include a complete `metadata.jsonc` with its name and type. Metadata is also replaced as a whole file. Supported types are `dark`, `light`, `hc`, and `hcLight`, mapped to `vs-dark`, `vs`, `hc-black`, and `hc-light`. Prod labels use the resolved metadata name and add the target name for non-default targets. Only the existing default prod theme is included by this restructuring; no example high-contrast theme is created.

### Building and checking outputs

`npm run build:palette` builds reports for all prod targets without requiring variables, metadata, token mappings, or the manifest. `npm run build:prod` generates all prod themes and reports and synchronizes `package.json` theme contributions while preserving unrelated fields. `npm run build:dev` builds all dev themes and their reports without changing prod outputs or the source manifest. `npm run build` runs `build:prod` followed by `build:dev`; if the prod build fails, the dev build does not run.

Reports always live under `src/themes/<prod or dev>/<theme name>/colors/generated-palette/` as `palette.json`, `palette.md`, and `palette.svg`. JSON records measurements and source provenance; Markdown embeds the sibling swatch sheet. A target inheriting the default palette still gets its own reports. Reports and archived documents are never used to discover source themes. Historical themes under `dev-extension/static-snapshots/` and documentation under `docs/palettes/archive/` are excluded from regeneration.

The builder rejects duplicate JSONC keys, invalid settings, malformed details, missing references, alias cycles, and placeholders outside color positions. Details remain documentation only. Comments inside mapping sections and scope order survive generation. All selected targets are validated and formatted before any destination is replaced. Builds write only changed files. Commit source and generated changes together; no automatic watch process runs.

`check:generated` renders prod and dev outputs in memory and compares them with committed files, including prod manifest entries. It never writes files. Missing, stale, or obsolete outputs fail with diagnostics. After deliberately removing or renaming a target, explicitly remove its obsolete generated theme and report files; the builder does not delete them automatically. Keep archives and snapshots intact.

The editor settings in `.vscode/` recommend Prettier, ESLint, Markdown linting, and color inspection tools. Prettier formats on save, using two-space indentation and the repository configuration.

| Command                   | Behavior                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run check`           | Check generated output, formatting, Markdown and JavaScript linting, theme validation, and tests.        |
| `npm run build`           | Generate prod and dev themes and their palette reports.                                                  |
| `npm run build:palette`   | Generate palette reports for all prod themes without variables or mappings.                              |
| `npm run build:prod`      | Generate prod themes/reports and synchronize prod manifest entries.                                      |
| `npm run build:dev`       | Generate dev themes and their palette reports.                                                           |
| `npm run watch`           | Continuously rebuild both groups and sync the dev preview extension on source changes.                   |
| `npm run dev:sync`        | Build both groups and refresh the dev preview extension.                                                 |
| `npm run check:generated` | Fail on stale or missing generated artifacts without rewriting files.                                    |
| `npm run check:prettier`  | Check Prettier formatting across the repository.                                                         |
| `npm run format`          | Rewrite files using Prettier.                                                                            |
| `npm run lint`            | Run both Markdown and JavaScript lint checks.                                                            |
| `npm run lint:md`         | Lint Markdown files, including curated palette references.                                               |
| `npm run lint:md:fix`     | Apply available Markdown lint fixes.                                                                     |
| `npm run lint:es`         | Lint JavaScript with ESLint using Node.js globals.                                                       |
| `npm run lint:es:fix`     | Apply available ESLint fixes.                                                                            |
| `npm run check:theme`     | Parse prod and dev theme JSONC, check basic structure, and verify manifest theme and icon files.         |
| `npm test`                | Run the Node.js tests for validation failures and dev extension protections using temporary directories. |

[`lefthook.yml`](../../../lefthook.yml) defines a pre-commit hook that runs ESLint, Markdown linting, and Prettier in that order against matching staged files. Each command can fix files and stage the fixes. To explicitly install the configured hooks locally, run:

```bash
npx lefthook install
```

The tests cover palette math, variable aliases and alpha, file-level fallback and replacement, independent palettes, required default inputs, target collisions, output isolation, validation before writes, stale artifacts, comment/scope preservation, prod registrations, repeatable preview synchronization, source-manifest preservation during preview sync, symlink protections, and malformed theme inputs. Theme validation checks basic structure rather than the entire VS Code theme schema. Check visual changes in VS Code as well as running `npm run check`; automated checks cannot establish how a theme looks. The publishing pipeline runs the same aggregate check before packaging.

### Test organization

| File                             | Responsibility                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tests/colors.test.js`           | Color conversions, hex export, luminance, and contrast.                                                                |
| `tests/palette.test.js`          | Palette anchors, tone generation, gamut limits, overrides, and parameter validation.                                   |
| `tests/variables.test.js`        | Variable aliases, dotted names, opacity, literal reasons, and details metadata.                                        |
| `tests/theme-build.test.js`      | JSONC parsing, template rendering, authored theme contrast, reports, fallback, registrations, and build output checks. |
| `tests/theme-validation.test.js` | Generated theme structure, manifest assets, registrations, and matching theme types.                                   |
| `tests/theme-watch.test.js`      | Source watching, queued builds, error recovery, registration refresh, and graceful shutdown.                           |
| `tests/dev-extension.test.js`    | Dev preview extension synchronization, theme picker entries, and symlink protections.                                  |
| `tests/test-projects.js`         | Reusable sample inputs and temporary project setup, output snapshots, and cleanup.                                     |

`createBuildProject` returns a temporary source project's root directory. `createPreviewProject` returns the project and extension destination paths, sample manifest, and generated theme text for validation and preview tests. Both project builders register cleanup with the test context.

`npm test` selects only `tests/*.test.js`, so `test-projects.js` is imported as a helper rather than discovered as a test file. To run one suite, use a command such as `node --test tests/variables.test.js`.

## Building the extension

Generate the theme with `npm run build:prod`, then package it using the VS Code extension CLI, `@vscode/vsce`, installed by `npm ci`. There is no extension compilation step or `vscode:prepublish` script.

Validate and package the current checkout:

```bash
npm run build
npm run check
npm run package:vsix
```

[`scripts/release/package-vsix.sh`](../../../scripts/release/package-vsix.sh) checks that all generated artifacts are current, reads the version from `package.json`, creates the destination directory, and invokes the local `vsce` executable. The default output is `dist/cassidy-dark-VERSION.vsix`. To choose another output file, pass its path after `--`:

```bash
npm run package:vsix -- /absolute/path/to/cassidy-dark-VERSION.vsix
```

Relative output paths resolve from the repository root. Packaging does not publish. It checks generated output; run the aggregate `npm run check` for the remaining validation. Stale output is rejected rather than silently rebuilt during packaging. In VS Code, use **Extensions: Install from VSIX...** to install the archive and inspect the packaged theme.

The manifest registers all prod themes from `themes/`; the current checkout ships only `themes/cassidy-dark-color-theme.json`. `.vscodeignore` excludes the `src/` authoring files, dev themes and samples, documentation, scripts, tests, editor settings, agent instructions, the Node.js version file, palette reports, local packages, and the listed tooling configuration files. The package carries the prod theme, manifest, and distributable assets such as the README, changelog, license, and images. `dist/` and generated `*.vsix` archives are ignored by Git.

The pipeline uses the same `npm run package:vsix` entry point with its artifact staging destination. Local development and the pipeline both use `npm ci` and the CLI resolved in `package-lock.json`; neither requires a global `vsce` installation. The manifest's `allowScripts` entries permit the declared Lefthook, resolver, and VSIX signing helper installation scripts when using npm versions that enforce that setting.

## Release configuration

Releases are orchestrated by Azure DevOps through [`azure-pipelines.yml`](../../../azure-pipelines.yml). Both `trigger: none` and `pr: none` are set: pushes, pull requests, and tags do not automatically start publication. There is no GitHub Actions release workflow in this repository.

The pipeline and helper scripts refer to these resources:

| Resource                  | Configured value or requirement                                            |
| ------------------------- | -------------------------------------------------------------------------- |
| Azure DevOps organization | `https://dev.azure.com/jacobcassidy`                                       |
| Azure DevOps project      | `Cassidy Dark Theme`                                                       |
| Azure pipeline name       | `jacobcassidy.vscode-cassidy-dark-theme`                                   |
| Release branch            | `main`                                                                     |
| Hosted agent              | `ubuntu-latest`                                                            |
| Azure service connection  | `vscode_publishing_connection`                                             |
| Marketplace publisher     | `jacobcassidy`                                                             |
| GitHub repository         | `jacobcassidy/vscode-cassidy-dark-theme`                                   |
| GitHub authentication     | Secret pipeline variable `GH_TOKEN` with repository Contents write access. |

Marketplace publication uses `vsce publish --azure-credential` inside an `AzureCLI@3` task authenticated through `vscode_publishing_connection`. The task is labeled as using managed identity. That service connection and the corresponding identity's authorization to publish under `jacobcassidy` must already be configured outside this repository. The YAML references the connection; it does not create the identity or grant its permissions.

GitHub publication uses the separate `GH_TOKEN` secret, passed to the relevant pipeline steps. The GitHub CLI (`gh`) must be available on the agent; the YAML checks its authentication but does not install it. The pipeline installs its locked Node.js tools with `npm ci`.

To submit a run from your computer, the Azure CLI must be installed, authenticated for this organization, and have the Azure DevOps extension available for `az pipelines run`. Your Azure DevOps account must be allowed to queue the pipeline. Local GitHub or Marketplace credentials are not used by the submission script; publication uses the pipeline's credentials.

## Publishing a release

### Prepare the release commit

1. Finish the theme changes and inspect them using the dev extension or a local VSIX.
2. Set the intended release version in `package.json`. Keep the lockfile's root package metadata aligned when updating the version. The packaging and release scripts read the version from `package.json`.
3. Add a matching, nonempty version section to `CHANGELOG.md`, for example `## [1.2.2] - YYYY-MM-DD`. Move the relevant entries from `[Unreleased]` into that section.
4. Run the local checks and inspect the extracted GitHub release notes:

   ```bash
   npm run check
   bash scripts/release/publish/get-changelog-notes.sh
   ```

5. Commit the release changes and push them to `main` on the remote used by the Azure pipeline. Confirm the intended release commit is on that branch before starting publication.

[`scripts/release/publish/get-changelog-notes.sh`](../../../scripts/release/publish/get-changelog-notes.sh) reads the manifest version and extracts the body below the matching `## [VERSION]` heading, stopping at the next level-two heading. It fails if that section is missing or empty. Entries under `[Unreleased]` do not become release notes automatically.

### Start the pipeline

From a local checkout on `main`, run:

```bash
npm run release:publish
```

[`scripts/release/publish/run-azure-pipeline.sh`](../../../scripts/release/publish/run-azure-pipeline.sh) rejects any branch other than `main`, including detached HEAD, then submits:

```bash
az pipelines run \
  --organization 'https://dev.azure.com/jacobcassidy' \
  --project 'Cassidy Dark Theme' \
  --name 'jacobcassidy.vscode-cassidy-dark-theme' \
  --branch main \
  --open
```

The command queues the remote `main` branch and opens the run in the browser. It does not commit, push, upload local changes, increment the version, or create a local Git tag. You can also manually queue the Azure pipeline against `main`; its own branch check still applies.

The queued pipeline publishes the VSIX to both the VS Code Marketplace and GitHub. The Marketplace step runs first, followed by GitHub release creation.

### Pipeline execution

The pipeline performs these steps in order:

1. **Checkout and preflight.** Check out the source, select Node.js 24, require `BUILD_SOURCEBRANCH` to equal `refs/heads/main`, require `GH_TOKEN`, validate the version's changelog notes, and check GitHub authentication and repository access. This preflight does not verify Marketplace publisher permissions.
2. **Install and validate.** Run `npm ci` to install the locked development and packaging tools, then run `npm run check`. A failed check stops publication.
3. **Package once.** Read `package.json.version` and call `npm run package:vsix` to write `cassidy-dark-VERSION.vsix` into `BUILD_ARTIFACTSTAGINGDIRECTORY`. Save the path in the pipeline variable `ExtensionVsix`.
4. **Preserve the VSIX.** Upload it as the Azure pipeline artifact `extension-vsix` before either publication step.
5. **Publish to the VS Code Marketplace.** Authenticate through `vscode_publishing_connection` and run the local CLI with `publish --azure-credential --packagePath "$EXTENSION_VSIX"`.
6. **Publish the GitHub release.** Run `scripts/release/publish/create-github-release.sh` with that same VSIX, using `GH_TOKEN`.

Both destinations receive the same packaged file. Marketplace publication runs first; if it fails, the subsequent GitHub step does not run under the pipeline's default success conditions. If GitHub publication fails afterward, the Marketplace version can already be live.

### GitHub release behavior

[`scripts/release/publish/create-github-release.sh`](../../../scripts/release/publish/create-github-release.sh) derives the tag and release title as `vVERSION` from `package.json`, and supplies the matching changelog body as release notes. For a new release, it targets `BUILD_SOURCEVERSION` in Azure Pipelines, or the current `git rev-parse HEAD` when run locally. The GitHub CLI creates the tag if needed as part of release creation; no separate tag push is scripted.

For an existing release, the helper checks the VSIX asset's filename. It uploads the file if that name is missing, or skips it if the name is already present. It does not compare file contents, replace existing assets, update existing release notes, or retarget an existing tag. The release helper itself has no branch guard; the normal submission script and pipeline enforce `main`.

After a successful run, verify the version on the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=jacobcassidy.cassidy-dark) and check the tag, notes, and VSIX attachment on the [GitHub releases page](https://github.com/jacobcassidy/vscode-cassidy-dark-theme/releases).

## Recovering a partial release

Use the pipeline logs to identify the failed step. Because the VSIX is archived before publication, the `extension-vsix` artifact provides the original package for recovery.

If Marketplace publication succeeded and only GitHub publication failed:

1. Download the VSIX from that run's `extension-vsix` artifact.
2. Use a local checkout of the exact release commit, so the manifest version and changelog match the downloaded package.
3. Make `gh` available and set `GH_TOKEN` securely in your shell to a token with repository Contents write access.
4. Run the GitHub helper with the absolute path to the downloaded VSIX:

   ```bash
   npm run release:github-recover -- /absolute/path/to/cassidy-dark-VERSION.vsix
   ```

This runs only GitHub publication and can fill in a missing release or missing asset. It still validates the changelog and token even when an asset already exists. For an incorrect existing asset, release description, or tag target, review and correct that GitHub resource explicitly; the helper leaves it in place.

Rerunning the whole pipeline repeats Marketplace publication as well as packaging. The YAML has no check that skips a version already published to the Marketplace, so use the GitHub-only recovery path when that is the remaining failed step.

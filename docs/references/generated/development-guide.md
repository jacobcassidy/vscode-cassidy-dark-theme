# Development guide

Cassidy Dark is a declarative Visual Studio Code color theme. VS Code loads a generated JSON-with-comments theme file. A Node.js build resolves palette inputs and named color variables into that file; there is no extension runtime or bundler. The release build packages the generated theme and extension metadata into a `.vsix` archive.

Run the commands in this guide from the repository root unless stated otherwise.

## Project structure

| Path                                                                        | Purpose                                                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`package.json`](../../../package.json)                                     | Production extension manifest, dependencies, commands, and generated production theme registrations.               |
| [`package-lock.json`](../../../package-lock.json)                           | Locked development dependencies.                                                                                   |
| [`src/production/themes/default/`](../../../src/production/themes/default/) | The six required default input files.                                                                              |
| [`src/production/themes/`](../../../src/production/themes/)                 | Production targets; additional named themes can omit input files to inherit the default.                           |
| [`src/local/themes/`](../../../src/local/themes/)                           | Local targets, including `test` and `v1.3`, with the same input layout and default fallback.                       |
| [`themes/`](../../../themes/)                                               | Committed generated production themes shipped in the VSIX.                                                         |
| [`dev/themes/`](../../../dev/themes/)                                       | Committed generated local previews.                                                                                |
| [`dev/snapshots/`](../../../dev/snapshots/)                                 | Historical comparison themes, excluded from regeneration.                                                          |
| [`docs/palettes/generated-reports/`](../../palettes/generated-reports/)     | Generated JSON, Markdown, and SVG palette reports grouped by theme directory name.                                 |
| [`docs/palettes/archive/`](../../palettes/archive/)                         | Preserved palette documentation and previous versions.                                                             |
| [`docs/references/generated/`](./)                                          | Development guides and reference material.                                                                         |
| [`docs/plans/`](../../plans/)                                               | Implementation plans, including the completed [restructuring plan 1b](../../plans/archive/restructure-1b-plan.md). |
| [`scripts/themes/`](../../../scripts/themes/)                               | Builds and checks production and local palettes/themes.                                                            |
| [`scripts/local-extension/`](../../../scripts/local-extension/)             | Creates and refreshes the local preview extension's manifest and asset links.                                      |
| [`scripts/lib/`](../../../scripts/lib/)                                     | Shared color calculations, palette and variable resolution, JSONC parsing, and target discovery.                   |
| [`scripts/release/`](../../../scripts/release/)                             | VSIX packaging, release notes, pipeline submission, and GitHub publishing.                                         |
| [`tests/`](../../../tests/)                                                 | Automated tests and isolated fixtures.                                                                             |
| [`dev/samples/`](../../../dev/samples/)                                     | Programming, markup, stylesheet, configuration, and log files for inspecting syntax highlighting.                  |
| [`images/`](../../../images/)                                               | Extension icons and the README screenshot.                                                                         |
| [`azure-pipelines.yml`](../../../azure-pipelines.yml)                       | Manual packaging and publication pipeline.                                                                         |
| [`.vscodeignore`](../../../.vscodeignore)                                   | VSIX exclusions.                                                                                                   |
| [`CHANGELOG.md`](../../../CHANGELOG.md)                                     | Versioned release notes used for GitHub releases.                                                                  |

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

### Create and refresh the local development extension

```bash
npm run dev:sync
```

This command runs `npm run build`, which runs `build:prod` for production targets followed by `build:dev` for local targets. Then [`scripts/local-extension/sync.js`](../../../scripts/local-extension/sync.js) creates or refreshes a separate extension directory at:

```text
~/.vscode/extensions/jacobcassidy.cassidy-dark-dev/
```

The script writes a generated `package.json` there with the name `cassidy-dark-dev` and display name **Cassidy Dark Dev**, and removes the published manifest's `__metadata`. It links the checkout's `themes/`, `dev/`, and `images/` directories into that extension directory. The source manifest stays in the checkout; the generated development manifest is a separate file.

The development manifest registers:

- Every production theme, including the default as **Cassidy Dark Dev**. Additional production labels include their target names.
- Every generated local theme, such as **Cassidy Dark Dev (Test)** and **Cassidy Dark Dev (V1.3)**.
- Every historical comparison with a **Cassidy Dark Snapshot (...)** label.

Theme types are read from generated metadata and mapped to the matching VS Code `uiTheme`. The synchronization script reads production files to register them but writes only the separate local extension manifest and asset links. It does not build themes or edit production inputs.

Run **Developer: Reload Window** in VS Code, then open **Preferences: Color Theme** and select a Cassidy Dark Dev theme. The development identity allows it to coexist with the Marketplace extension.

Rebuild after changing palette, variable, metadata, or token mapping inputs. The generated theme is linked directly into the development extension. Theme entries include `_watch: true`; reload the VS Code window if an edit is not reflected. Open the files in `dev/samples/` and representative files from other languages to inspect highlighting. **Developer: Inspect Editor Tokens and Scopes** helps identify which TextMate or semantic token rules apply.

After changing manifest metadata or adding or removing development theme files, run `npm run dev:sync` again to refresh the development manifest and reload VS Code.

The command prints a reload reminder after synchronization. Importing the sync module does not install or change an extension. The function accepts an alternate repository root and extension directory for isolated testing. There is no file-watching process that continually regenerates the manifest. The CLI defaults to the standard `~/.vscode/extensions` location; it does not discover custom extension directories or alternate VS Code editions.

For safety, the sync script refuses to use a symlink for the development extension directory or its generated manifest. Existing asset links must point to this checkout. If the checkout moves, inspect and repair those development links before running setup again.

### Syntax samples

The files in `dev/samples/` are source examples for visual inspection; no execution is required.

| Sample                                                          | Coverage                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [JavaScript](../../../dev/samples/javascript-grammar-sample.js) | ES modules, JSDoc types and tags, literals and escapes, regex groups and assertions, Unicode regex sets, templates, destructuring, private and static class members, operators, control flow, generators, and async code. Uses modern JavaScript supported by Node.js 24. |
| [TypeScript](../../../dev/samples/typescript-grammar-sample.ts) | TypeScript 5.4+ annotations, unions and intersections, conditional and mapped types, infer and template literal types, generics, assertions, overloads, decorators, declaration merging, ambient declarations, resource management, and runtime syntax.                   |
| [Python](../../../dev/samples/python-grammar-sample.py)         | Python 3.12+ literals and string prefixes, f-strings, regexes, annotations and generic type parameters, decorators, protocols and data classes, comprehensions, pattern matching, exception groups, generators, context managers, and async code.                         |
| [PHP](../../../dev/samples/php-grammar-sample.php)              | PHP 8.2+ property type probes, PHPDoc, namespace imports, attributes, enums, traits, readonly and anonymous classes, literals and interpolation, regex strings, operators, closures, generators, exceptions, and embedded PHP/HTML with alternative control syntax.       |
| [HTML](../../../dev/samples/html-grammar-sample.html)           | Tags, attributes, entities, semantic elements, forms, tables, media, templates, custom elements, SVG, MathML, and embedded CSS, JavaScript, and JSON.                                                                                                                     |
| [Markdown](../../../dev/samples/markdown-grammar-sample.md)     | ATX and Setext headings, emphasis styles, escapes, entities, links and references, images, lists, tasks, quotations, tables, code fences, embedded languages, HTML, footnotes, and math.                                                                                  |
| [CSS](../../../dev/samples/css-grammar-sample.css)              | Selectors, combinators, attribute operators, pseudo-classes and pseudo-elements, custom properties, colors, units, functions, nesting, layers, keyframes, media/support/container queries, scopes, and paged media.                                                       |
| [SCSS](../../../dev/samples/scss-grammar-sample.scss)           | Sass modules, variables, interpolation, lists and maps, functions, mixins, content blocks, placeholders, extension, nesting, loops, conditionals, operators, and diagnostics.                                                                                             |
| [JSON](../../../dev/samples/json-grammar-sample.json)           | Strict JSON strings and escapes, Unicode, numeric forms, booleans, null, unusual keys, nested objects, arrays, and structural punctuation.                                                                                                                                |
| [YAML](../../../dev/samples/yaml-grammar-sample.yml)            | Directives, multiple documents, quoted and block scalars, numeric forms, tags, explicit keys, anchors, aliases, and block/flow collections.                                                                                                                               |
| [TOML](../../../dev/samples/toml-grammar-sample.toml)           | TOML 1.0 bare, quoted, and dotted keys; basic, literal, and multiline strings; numeric bases; special floats; dates and times; tables; inline tables; and arrays of tables.                                                                                               |
| [Log](../../../dev/samples/log-grammar-sample.log)              | Synthetic severity levels, timestamps, syslog and HTTP access lines, paths, URLs, addresses, values, JSON records, stack traces, and diffs.                                                                                                                               |
| [NEON](../../../dev/samples/neon-grammar-sample.neon)           | Scalars, alternate separators, multiline strings, dates, collections, entities, entity chains, and illustrative Nette DI parameter/service references.                                                                                                                    |
| [Ruby](../../../dev/samples/ruby-grammar-sample.rb)             | Ruby 3.2+ literals, percent strings, heredocs, interpolation, regexes, symbols, modules, refinements, classes, methods, operators, forwarding, pattern matching, blocks, exceptions, and data sections.                                                                   |
| [XML](../../../dev/samples/xml-grammar-sample.xml)              | XML declarations, an internal DTD, entity and notation declarations, parameter entities, namespaces, attributes, character references, mixed content, CDATA, processing instructions, and SVG.                                                                            |

Use the matching VS Code language mode. Inspect both a declaration and its references with **Developer: Inspect Editor Tokens and Scopes**. Compare the same text with semantic highlighting enabled and disabled in workspace settings; language tooling can refine the colors beyond the TextMate grammar. Python semantic highlighting depends on the installed Python language tooling. The JavaScript file uses the JavaScript grammar; JSX and TypeScript require their respective language modes and syntax.

The TypeScript sample imports the sibling JavaScript fixture for module and usage-site highlighting. Its [samples-only TypeScript configuration](../../../dev/samples/tsconfig.json) enables strict checking, ESNext libraries, NodeNext modules, standard decorators, and JavaScript imports. VS Code discovers that configuration automatically. It emits no JavaScript and requires no changes to extension packaging. If a TypeScript compiler is available, run `tsc --project dev/samples/tsconfig.json` to check it; the repository does not install TypeScript or include that check in `npm run check`.

The PHP sample retains its original property type regression probes. It also includes a labeled legacy backtick command-string example for grammar coverage; PHP 8.5 reports that syntax as deprecated during `php -l`. The sample is intended for source inspection, and linting does not execute its examples.

The samples use illustrative URLs and asset references. The SCSS sample uses built-in Sass modules. Ruby command-string examples are wrapped in uncalled lambdas, and the log sample mixes synthetic formats rather than representing one application's output. Markdown lint exceptions and Prettier ignore comments preserve intentional syntax variants in that fixture.

Use an installed language extension for NEON or TOML if VS Code does not offer the matching mode. Log highlighting depends on the selected grammar; Output Colorizer can provide additional scopes used by the theme. Markdown footnotes, math, and alerts, along with newer CSS constructs, may receive different scopes depending on grammar and extension support. The NEON sample follows the [NEON format reference](https://doc.nette.org/en/neon/format); its service section illustrates Nette configuration strings without requiring a Nette project.

### Editing theme inputs

The production default lives under `src/production/themes/default/` and requires these six files:

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

### Adding production or local themes

Add a directory under `src/production/themes/<name>/` for a shipped theme, or `src/local/themes/<name>/` for a local preview. Theme directory names must be lowercase, begin with a letter, and use only letters, digits, periods, and hyphens. Consecutive periods and trailing periods are rejected. Names must be unique across both source groups because they share the report destination.

Each of the six files is optional outside the production default. An omitted file uses the file at the same relative path in the default directory. A supplied file replaces that entire file; individual missing keys are not merged or inherited. Empty or invalid supplied files fail validation. Missing or invalid default inputs also fail, even when building local themes. There is no inheritance chain through other named themes.

For example, to try a different yellow palette locally:

1. Create `src/local/themes/yellow-test/colors/`.
2. Copy the complete default `colors/palette.jsonc` into it and change the yellow parameters.
3. Omit `colors/variables.jsonc`, `metadata.jsonc`, and the `tokens/` files to inherit the default versions.
4. Run `npm run build:dev` to generate `dev/themes/cassidy-dark-color-theme-yellow-test.json` and `docs/palettes/generated-reports/yellow-test/palette.{json,md,svg}`.
5. Run `npm run dev:sync` and select **Cassidy Dark Dev (Yellow Test)** in VS Code.

The inherited variable and token mapping files resolve against the local palette. If you supply a variable file instead, include every variable required by the selected mappings and other variables. Copy the complete default file as a starting point. Changes to a default file affect every target inheriting it.

An existing empty target directory can inherit every file. To track that theme in Git, include a complete `metadata.jsonc` with its name and type. Metadata is also replaced as a whole file. Supported types are `dark`, `light`, `hc`, and `hcLight`, mapped to `vs-dark`, `vs`, `hc-black`, and `hc-light`. Production labels use the resolved metadata name and add the target name for non-default targets. Only the existing default production theme is included by this restructuring; no example high-contrast theme is created.

### Building and checking outputs

`npm run build:palette` builds reports for all production targets without requiring variables, metadata, token mappings, or the manifest. `npm run build:prod` generates all production themes and reports and synchronizes `package.json` theme contributions while preserving unrelated fields. `npm run build:dev` builds all local themes and their reports without changing production outputs or the source manifest. `npm run build` runs `build:prod` followed by `build:dev`; if the production build fails, the local build does not run.

Reports always live under `docs/palettes/generated-reports/<theme name>/` as `palette.json`, `palette.md`, and `palette.svg`. JSON records measurements and source provenance; Markdown embeds the sibling swatch sheet. A target inheriting the default palette still gets its own reports. Reports and archived documents are never used to discover source themes. Historical themes under `dev/snapshots/` and documentation under `docs/palettes/archive/` are excluded from regeneration.

The builder rejects duplicate JSONC keys, invalid settings, malformed details, missing references, alias cycles, and placeholders outside color positions. Details remain documentation only. Comments inside mapping sections and scope order survive generation. All selected targets are validated and formatted before any destination is replaced. Builds write only changed files. Commit source and generated changes together; no automatic watch process runs.

`check:generated` renders production and local outputs in memory and compares them with committed files, including production manifest entries. It never writes files. Missing, stale, or obsolete outputs fail with diagnostics. After deliberately removing or renaming a target, explicitly remove its obsolete generated theme and report files; the builder does not delete them automatically. Keep archives and snapshots intact.

The editor settings in `.vscode/` recommend Prettier, ESLint, Markdown linting, and color inspection tools. Prettier formats on save, using two-space indentation and the repository configuration.

| Command                   | Behavior                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run check`           | Check generated output, formatting, Markdown and JavaScript linting, theme validation, and tests.                |
| `npm run build`           | Generate production and local themes and their palette reports.                                                  |
| `npm run build:palette`   | Generate palette reports for all production themes without variables or mappings.                                |
| `npm run build:prod`      | Generate production themes/reports and synchronize production manifest entries.                                  |
| `npm run build:dev`       | Generate local themes and their palette reports.                                                                 |
| `npm run dev:sync`        | Build both groups and refresh the local preview extension.                                                       |
| `npm run check:generated` | Fail on stale or missing generated artifacts without rewriting files.                                            |
| `npm run check:prettier`  | Check Prettier formatting across the repository.                                                                 |
| `npm run format`          | Rewrite files using Prettier.                                                                                    |
| `npm run lint`            | Run both Markdown and JavaScript lint checks.                                                                    |
| `npm run lint:md`         | Lint Markdown files, including curated palette references.                                                       |
| `npm run lint:md:fix`     | Apply available Markdown lint fixes.                                                                             |
| `npm run lint:es`         | Lint JavaScript with ESLint using Node.js globals.                                                               |
| `npm run lint:es:fix`     | Apply available ESLint fixes.                                                                                    |
| `npm run check:theme`     | Parse production and development theme JSONC, check basic structure, and verify manifest theme and icon files.   |
| `npm test`                | Run the Node.js tests for validation failures and development extension protections using temporary directories. |

[`lefthook.yml`](../../../lefthook.yml) defines a pre-commit hook that runs ESLint, Markdown linting, and Prettier in that order against matching staged files. Each command can fix files and stage the fixes. To explicitly install the configured hooks locally, run:

```bash
npx lefthook install
```

The tests cover palette math, variable aliases and alpha, file-level fallback and replacement, independent palettes, required default inputs, target collisions, output isolation, validation before writes, stale artifacts, comment/scope preservation, production registrations, repeatable preview synchronization, source-manifest preservation during preview sync, symlink protections, and malformed theme inputs. Theme validation checks basic structure rather than the entire VS Code theme schema. Check visual changes in VS Code as well as running `npm run check`; automated checks cannot establish how a theme looks. The publishing pipeline runs the same aggregate check before packaging.

### Test organization

| File                             | Responsibility                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tests/colors.test.js`           | Color conversions, hex export, luminance, and contrast.                                                                |
| `tests/palette.test.js`          | Palette anchors, tone generation, gamut limits, overrides, and parameter validation.                                   |
| `tests/variables.test.js`        | Variable aliases, dotted names, opacity, literal reasons, and details metadata.                                        |
| `tests/theme-build.test.js`      | JSONC parsing, template rendering, authored theme contrast, reports, fallback, registrations, and build output checks. |
| `tests/theme-validation.test.js` | Generated theme structure, manifest assets, registrations, and matching theme types.                                   |
| `tests/local-extension.test.js`  | Local preview extension synchronization, theme picker entries, and symlink protections.                                |
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

[`scripts/release/package.sh`](../../../scripts/release/package.sh) checks that all generated artifacts are current, reads the version from `package.json`, creates the destination directory, and invokes the local `vsce` executable. The default output is `dist/cassidy-dark-VERSION.vsix`. To choose another output file, pass its path after `--`:

```bash
npm run package:vsix -- /absolute/path/to/cassidy-dark-VERSION.vsix
```

Relative output paths resolve from the repository root. Packaging does not publish. It checks generated output; run the aggregate `npm run check` for the remaining validation. Stale output is rejected rather than silently rebuilt during packaging. In VS Code, use **Extensions: Install from VSIX...** to install the archive and inspect the packaged theme.

The manifest registers all production themes from `themes/`; the current checkout ships only `themes/cassidy-dark-color-theme.json`. `.vscodeignore` excludes the `src/` authoring files, development themes and samples, documentation, scripts, tests, editor settings, agent instructions, the Node.js version file, palette reports, local packages, and the listed tooling configuration files. The package carries the production theme, manifest, and distributable assets such as the README, changelog, license, and images. `dist/` and generated `*.vsix` archives are ignored by Git.

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

1. Finish the theme changes and inspect them using the development extension or a local VSIX.
2. Set the intended release version in `package.json`. Keep the lockfile's root package metadata aligned when updating the version. The packaging and release scripts read the version from `package.json`.
3. Add a matching, nonempty version section to `CHANGELOG.md`, for example `## [1.2.2] - YYYY-MM-DD`. Move the relevant entries from `[Unreleased]` into that section.
4. Run the local checks and inspect the extracted GitHub release notes:

   ```bash
   npm run check
   bash scripts/release/changelog-notes.sh
   ```

5. Commit the release changes and push them to `main` on the remote used by the Azure pipeline. Confirm the intended release commit is on that branch before starting publication.

[`scripts/release/changelog-notes.sh`](../../../scripts/release/changelog-notes.sh) reads the manifest version and extracts the body below the matching `## [VERSION]` heading, stopping at the next level-two heading. It fails if that section is missing or empty. Entries under `[Unreleased]` do not become release notes automatically.

### Start the pipeline

From a local checkout on `main`, run:

```bash
npm run release:publish
```

[`scripts/release/publish-azure.sh`](../../../scripts/release/publish-azure.sh) rejects any branch other than `main`, including detached HEAD, then submits:

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
6. **Publish the GitHub release.** Run `scripts/release/create-github-release.sh` with that same VSIX, using `GH_TOKEN`.

Both destinations receive the same packaged file. Marketplace publication runs first; if it fails, the subsequent GitHub step does not run under the pipeline's default success conditions. If GitHub publication fails afterward, the Marketplace version can already be live.

### GitHub release behavior

[`scripts/release/create-github-release.sh`](../../../scripts/release/create-github-release.sh) derives the tag and release title as `vVERSION` from `package.json`, and supplies the matching changelog body as release notes. For a new release, it targets `BUILD_SOURCEVERSION` in Azure Pipelines, or the current `git rev-parse HEAD` when run locally. The GitHub CLI creates the tag if needed as part of release creation; no separate tag push is scripted.

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

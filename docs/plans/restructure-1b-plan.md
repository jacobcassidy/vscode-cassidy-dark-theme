# Project restructuring plan 1b

Status: Proposed. This document revises [restructuring plan 1](restructure-1-plan.md). The palette document archive move recorded below is complete; the theme source and report restructuring remains proposed.

## Objective

Organize editable themes under `src/`, with separate production and local targets, an independent palette and named color variables for each theme, and fallback to the production default for omitted input files. Keep generated themes, historical comparisons, palette documentation, and release packages in predictable locations.

Preserve the current default theme and local experiments during migration. Reuse the palette generation, variable resolution, template rendering, validation, and development extension workflows introduced by the original plan.

## Target structure

```text
.vscode/                         # Repository editor settings
dev/
  samples/                       # Files for inspecting syntax highlighting
  snapshots/                     # Historical themes preserved unchanged
  themes/                        # Generated local themes
dist/                            # Local VSIX packages; ignored by Git
docs/
  palettes/
    archive/
      *.md                       # Preserved palette notes and previous versions
    generated-reports/
      default/
        palette.json
        palette.md
        palette.svg
      high-contrast/
        palette.json
        palette.md
        palette.svg
      test/
        palette.json
        palette.md
        palette.svg
      v1.3/
        palette.json
        palette.md
        palette.svg
  plans/
    *-plan.md                    # Restructuring and implementation plans
  references/
    *.md                         # Development guides and reference material
  TODO.md
images/                          # Images shipped with the extension
scripts/
  themes/                        # Production and local palette/theme builds and checks
  local-extension/               # Local preview extension manifests and asset links
  release/                       # Packaging and publishing
  shared/                        # Shared color, palette, and JSONC logic
src/
  local/
    themes/
      test/
        colors/
          palette.jsonc
          variables.jsonc
        tokens/
          semantic.jsonc
          syntax.jsonc
          ui.jsonc
        metadata.jsonc
      v1.3/
        colors/
          palette.jsonc
          variables.jsonc
        tokens/
          semantic.jsonc
          syntax.jsonc
          ui.jsonc
        metadata.jsonc
  production/
    themes/
      default/
        colors/
          palette.jsonc
          variables.jsonc
        tokens/
          semantic.jsonc
          syntax.jsonc
          ui.jsonc
        metadata.jsonc
      high-contrast/
        colors/
          palette.jsonc
          variables.jsonc
        tokens/
          semantic.jsonc
          syntax.jsonc
          ui.jsonc
        metadata.jsonc
tests/                           # Automated tests and test helpers
themes/                          # Generated production themes shipped in VSIX

package.json                     # Production manifest and project commands
package-lock.json
README.md
CHANGELOG.md
LICENSE
```

The tree shows the available source files for each target, not a requirement to duplicate every file. Except for the production default, authored theme files are optional. Palette reports live under `docs/palettes/generated-reports/` and follow the separate output rules below.

The repository root continues to hold formatter, lint, hook, pipeline, and other configuration files. Maintained Markdown references belong directly under `docs/references/`; existing machine-readable reference assets can remain beside them. The existing color system proposal remains a historical design reference; the `*-plan.md` naming applies to implementation plans.

### Script responsibilities

`scripts/themes/` contains palette/theme generation and validation for both production and local targets. Move the existing `build-theme.js` and `check-theme.js` there. The selected target group determines which themes are built; the directory itself is shared by both workflows.

`scripts/local-extension/` contains the local preview extension setup and synchronization script, `sync.js`. It writes the separate development manifest, registers theme picker entries, and links checkout assets so generated themes and snapshots can be selected locally. Theme generation runs through `scripts/themes/`; `npm run dev:sync` orchestrates both builds before invoking extension synchronization.

`scripts/shared/` contains reusable color calculations, palette generation, variable resolution, and JSONC parsing used by the entry scripts. Keep packaging and publishing operations in `scripts/release/`.

## Theme inputs and terminology

Every target uses the same six input paths relative to its theme directory:

| File                     | Responsibility                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `colors/palette.jsonc`   | Palette parameters: hue/lightness anchors, chroma settings, neutrals, and documented primitive overrides.                       |
| `colors/variables.jsonc` | Named color variables, including aliases to palette primitives and other variables, optional alpha, and documentation metadata. |
| `tokens/ui.jsonc`        | VS Code `colors` mappings for workbench and editor UI.                                                                          |
| `tokens/semantic.jsonc`  | VS Code `semanticHighlighting` and `semanticTokenColors` settings.                                                              |
| `tokens/syntax.jsonc`    | VS Code TextMate `tokenColors` rules, preserving scope ordering and styles.                                                     |
| `metadata.jsonc`         | Root theme properties currently held in `base.jsonc`, such as schema, name, type, and author.                                   |

Rename the current `src/tokens.jsonc` to the default theme's `colors/variables.jsonc`. Preserve its nested object structure, variable names, leaf schema, literal-color reasons, and optional `details` metadata. Reserve the `tokens/` directory for the files mapping those variables into VS Code theme settings.

Keep the existing reference syntax. For example, a variable whose `color` is `diagnostic.error.foreground` resolves to that variable's `color` in the effective `variables.jsonc`; a value such as `palette.yellow.400` resolves to a primitive generated from the effective `palette.jsonc`. A template reference such as `{diagnostic.error.foreground}` uses the same resolver. Document this chain with examples in the development guide and variable reference.

## Default-file fallback

Require all six authored files under `src/production/themes/default/`. A missing or invalid default input fails validation; the default has no fallback.

For every other production or local theme, resolve each input independently:

1. Use the target's file if it exists.
2. Otherwise use the file at the same relative path under `src/production/themes/default/`.
3. Validate the selected file and the complete resolved target before writing outputs.

A supplied file replaces the corresponding default file in full. Do not merge individual properties, variable groups, leaves, or arrays with the default. Missing keys inside a supplied file do not trigger fallback. An empty or malformed supplied file must fail normal validation rather than silently selecting the default. There is no fallback through another local theme or through `high-contrast`.

For example, `src/local/themes/test/colors/palette.jsonc` can define a complete independent palette while omitting `colors/variables.jsonc` and all three `tokens/` files. The inherited variables and mappings then resolve against the test palette. Conversely, a supplied `colors/variables.jsonc` must define every variable referenced by the selected mappings and other variables. Unknown references and alias cycles fail the build.

An existing target directory may inherit all six files. Do not require an override merely to create an inherited theme; distinguish discovered target directories from their optional contents. If a fully inherited target needs to be tracked by Git, add an explicit `metadata.jsonc` identifying that theme. Missing local target roots can mean no local themes; a missing production default is an error.

Changing a default file can change targets that inherit it. Building a target with an inherited palette still generates its own reports under `docs/palettes/generated-reports/<theme name>/`. The theme name is the source directory name, such as `default`, `high-contrast`, `test`, or `v1.3`. Reports are never selected as fallback inputs or used to discover targets. Missing generated reports are rebuilt, and check mode reports them as missing.

This replaces the original plan's partial palette and variable override merging with file-level fallback. Independent palettes are complete source files, not patches against the default palette.

## Ownership and packaging

| Location                                                      | Ownership                                       | Git policy                                   | Shipped in the VSIX |
| ------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- | ------------------- |
| `src/production/themes/` and `src/local/themes/`              | Edited theme inputs                             | Committed; non-default inputs may be omitted | No                  |
| `docs/palettes/generated-reports/<theme name>/`               | Generated palette measurements and swatches     | Committed and checked for staleness          | No                  |
| `docs/palettes/archive/`                                      | Preserved palette documentation                 | Committed; retain historical content         | No                  |
| `themes/`                                                     | Generated production themes                     | Committed and checked for staleness          | Yes                 |
| `dev/themes/`                                                 | Generated local themes                          | Committed and checked for staleness          | No                  |
| `dev/snapshots/`                                              | Historical comparison themes                    | Committed; preserve filenames and bytes      | No                  |
| `images/`                                                     | Ready-to-package images                         | Committed                                    | Yes                 |
| `.vscode/`, `dev/samples/`, `docs/`, `scripts/`, and `tests/` | Development material and tooling                | Committed                                    | No                  |
| `dist/`                                                       | Generated release packages and packaging checks | Ignored                                      | No                  |

The `generated-reports/` directory and generated-file notices identify palette reports as outputs. Edit the corresponding theme's `colors/palette.jsonc` and rebuild rather than editing reports directly. Keep archived palette documents separate from regeneration. Keep the production manifest, public README, changelog, license, and images in their current locations. Maintain one production extension manifest and generate the separate development manifest as today.

## Build behavior

### Target discovery and output identity

Discover direct theme directories under `src/production/themes/` and `src/local/themes/` in deterministic order, with the production default required. Validate directory names before deriving paths and reject unsafe names and duplicate output identities. Require theme directory names to be unique across both source groups because they share the report destination `docs/palettes/generated-reports/<theme name>/`. Reject collisions before writing any outputs. Use the source group and directory name as the stable target identity, independently of inherited display metadata.

| Source target                          | Generated theme                                      |
| -------------------------------------- | ---------------------------------------------------- |
| `src/production/themes/default/`       | `themes/cassidy-dark-color-theme.json`               |
| `src/production/themes/high-contrast/` | `themes/cassidy-dark-color-theme-high-contrast.json` |
| `src/local/themes/test/`               | `dev/themes/cassidy-dark-color-theme-test.json`      |
| `src/local/themes/v1.3/`               | `dev/themes/cassidy-dark-color-theme-v1.3.json`      |

Additional production and local targets follow the corresponding named output pattern. Preserve the existing default output path and production picker label. Derive distinct picker labels for other targets from target identity and resolved metadata, including when metadata is inherited. Validate consistency between theme type and manifest `uiTheme` for each registered theme.

Register all production outputs in the production extension manifest. The development manifest includes every production theme, every local theme, and clearly labeled historical snapshots. Keep local and snapshot entries out of the production manifest. Make manifest synchronization deterministic and preserve unrelated manifest fields.

Include `high-contrast` as a production target in the new structure. Initially it can inherit default inputs and have explicit identifying metadata; inheritance alone does not establish a completed high-contrast color design. Any deliberate accessibility or color changes require separate review from the migration's preservation checks.

### Shared generation

Resolve the selected files, generate the effective palette, resolve variables, and render the theme through the same operations for both source groups. Preserve comments, parsed metadata, styles, scope ordering, and historical literal colors during conversion. Errors should identify the target, the selected input file, and whether the file came from the default.

Write palette JSON measurements, Markdown tables, and SVG swatches to `docs/palettes/generated-reports/<theme name>/` using exactly `palette.json`, `palette.md`, and `palette.svg`. The default theme therefore writes to `docs/palettes/generated-reports/default/`, and the test theme writes to `docs/palettes/generated-reports/test/`. Keep the Markdown image reference as `palette.svg` and include the target's palette source, any fallback origin, and the rebuild command in generated-file notices. Keep palette generation independent of variable and theme input validation when running the palette-only command.

Production builds write only production themes and their reports. Local builds write only local themes and their reports, even when reading inherited production inputs. Local source edits never update production source files or outputs automatically. Keep snapshots outside regeneration.

Validate and format all selected targets before replacing generated files so invalid input cannot leave earlier targets partially updated. Preserve deterministic output, skip unchanged writes, and keep check mode read-only. Detect missing, changed, and obsolete generated artifacts, including reports left by renamed or removed targets under `docs/palettes/generated-reports/`. Diagnostics should identify the stale paths and the appropriate rebuild or explicit cleanup action; do not delete source inputs, archived palette documents, or snapshots during output cleanup.

## Migration mapping

Use the current checkout as the baseline; several tooling and snapshot moves from the original plan have already happened.

| Current location                                | Planned location                                       |
| ----------------------------------------------- | ------------------------------------------------------ |
| `palette/source/palette.jsonc`                  | `src/production/themes/default/colors/palette.jsonc`   |
| `src/tokens.jsonc`                              | `src/production/themes/default/colors/variables.jsonc` |
| `src/theme/base.jsonc`                          | `src/production/themes/default/metadata.jsonc`         |
| `src/theme/colors.jsonc`                        | `src/production/themes/default/tokens/ui.jsonc`        |
| `src/theme/semantic.jsonc`                      | `src/production/themes/default/tokens/semantic.jsonc`  |
| `src/theme/syntax.jsonc`                        | `src/production/themes/default/tokens/syntax.jsonc`    |
| `dev/experiments/<name>/base.jsonc`             | `src/local/themes/<name>/metadata.jsonc`               |
| `dev/experiments/<name>/colors.jsonc`           | `src/local/themes/<name>/tokens/ui.jsonc`              |
| `dev/experiments/<name>/semantic.jsonc`         | `src/local/themes/<name>/tokens/semantic.jsonc`        |
| `dev/experiments/<name>/syntax.jsonc`           | `src/local/themes/<name>/tokens/syntax.jsonc`          |
| Optional `dev/experiments/<name>/palette.jsonc` | `src/local/themes/<name>/colors/palette.jsonc`         |
| Optional `dev/experiments/<name>/tokens.jsonc`  | `src/local/themes/<name>/colors/variables.jsonc`       |
| `palette/reports/production/palette.*`          | `docs/palettes/generated-reports/default/palette.*`    |
| `palette/reports/experiments/<name>/palette.*`  | `docs/palettes/generated-reports/<name>/palette.*`     |
| `scripts/build/`                                | `scripts/themes/`                                      |
| `scripts/dev/`                                  | `scripts/local-extension/`                             |
| `scripts/lib/`                                  | `scripts/shared/`                                      |

The current builder already supports optional per-experiment palette and variable overrides. Where such overrides exist, materialize their effective complete files before adopting replacement semantics, so the migration preserves their behavior. For `test` and `v1.3`, preserve their existing literal template colors, including diagnostic marker colors. Do not replace literals with palette references solely because their hex values match.

Existing palette Markdown has been moved from `docs/palettes/*.md` to `docs/palettes/archive/*.md` as part of this plan revision. Keep preserved palette notes there and generate current reports under `docs/palettes/generated-reports/<theme name>/`. Keep development guides and other references under `docs/references/`, implementation plans under `docs/plans/`, and outstanding work in `docs/TODO.md`. Preserve historical reference content when updating active paths and terminology. Remove obsolete `palette/`, `src/theme/`, and `dev/experiments/` directories after migrating their contents and consumers. Group scripts under `scripts/themes/`, `scripts/local-extension/`, `scripts/release/`, and `scripts/shared/` according to the responsibilities above.

## Command responsibilities

| Command                   | Planned behavior                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:palette`   | Generate `docs/palettes/generated-reports/<theme name>/palette.*` for every production theme from its effective palette, without requiring variables or theme mappings. |
| `npm run build:theme`     | Build all production themes and their palette reports; synchronize production theme contributions in the manifest.                                                      |
| `npm run build:dev`       | Build all local themes and their reports using production default fallback.                                                                                             |
| `npm run dev:sync`        | Build production and local themes, then refresh the separate development manifest and asset links.                                                                      |
| `npm run check:generated` | Check every production and local generated theme and report, plus production manifest theme entries, without writing files.                                             |
| `npm run check:theme`     | Validate all generated themes, historical snapshots, theme registrations, and manifest asset paths.                                                                     |
| `npm run check`           | Run generated-output checks, formatting, linting, theme validation, and tests.                                                                                          |
| `npm run package:vsix`    | Require current generated outputs and package every registered production theme with distributable assets.                                                              |

Keep the existing release command names and pipeline publishing behavior. An automatic watch process, automatic promotion of local themes, and image generation remain outside this restructuring.

## Implementation sequence

### 1. Record the baseline

- [ ] Record parsed default and local theme data, palette measurements, output filenames, and picker labels.
- [ ] Record snapshot filenames and bytes and inspect current VSIX contents.
- [ ] Inventory optional experiment palette/variable overrides and any inherited values that must be materialized.
- [ ] Review current manifest synchronization, validation, source references, and development extension symlink protections.

### 2. Migrate the default source and report layout

- [ ] Move the six default inputs according to the migration mapping, including `tokens.jsonc` to `colors/variables.jsonc` and `colors.jsonc` to `tokens/ui.jsonc`.
- [ ] Move default reports to `docs/palettes/generated-reports/default/palette.*` and update generation notices and documentation links; keep the Markdown image reference as `palette.svg`.
- [ ] Rename `scripts/build/` to `scripts/themes/`, `scripts/dev/` to `scripts/local-extension/`, and `scripts/lib/` to `scripts/shared/`.
- [ ] Update npm script paths, relative imports, repository-root resolution, test imports, release/pipeline references, and documentation links for the script directory moves.
- [ ] Update path constants, imports, formatter/linter discovery, tests, and build entry points affected by the layout.
- [ ] Confirm the default rebuild preserves parsed theme data and palette measurements.

### 3. Add shared target resolution and local sources

- [ ] Discover production and local targets deterministically and implement independent fallback for each of the six files.
- [ ] Require every default input and validate provided files without merging them or silently falling back after an error.
- [ ] Move `test` and `v1.3` inputs into `src/local/themes/`, materializing any existing partial palette or variable overrides.
- [ ] Generate each target's reports under `docs/palettes/generated-reports/<theme name>/palette.*`, reject theme-name collisions across production and local sources, and preserve existing local theme output paths and parsed theme behavior.
- [ ] Validate all selected targets before writing, preserve read-only checks, and detect obsolete outputs.

### 4. Support multiple production themes and previews

- [ ] Add the `high-contrast` production target and identifying metadata; explicitly document any initially inherited appearance.
- [ ] Register all production themes and validate their labels, paths, and theme types without changing unrelated manifest fields.
- [ ] Refresh the development manifest with production, local, and historical entries using distinct labels.
- [ ] Preserve the separate development extension identity, linked checkout assets, repeatable synchronization, and symlink protections.
- [ ] Keep `dev/` limited to samples, snapshots, and generated local themes, and exclude snapshots from rebuilding.

### 5. Update documentation and packaging

- [ ] Update the development guide, variable schema/reference documentation, README, command descriptions, project structure tables, and changelog.
- [ ] Document palette primitives, variable aliases, template references, full-file replacement, and effects of changing inherited defaults with examples.
- [x] Move the existing palette documents into `docs/palettes/archive/` and retain their historical content.
- [ ] Consolidate generated palette reports into `docs/palettes/generated-reports/<theme name>/`, keep other active documentation in `docs/plans/`, `docs/references/`, and `docs/TODO.md`, and remove obsolete source/report paths.
- [ ] Keep `.vscode/`, `src/`, `dev/`, `docs/`, `scripts/`, and `tests/` excluded from the VSIX, and keep `dist/` ignored by Git.
- [ ] Package every production output and exclude local themes, snapshots, and all palette reports.

### 6. Verify completion

- [ ] Update existing tests for moved paths and add focused coverage for missing default files, file-level fallback, supplied-file replacement, malformed inputs, unresolved variables, alias cycles, and inherited palette changes.
- [ ] Cover independent palettes, local/production output isolation, optional metadata, fully inherited targets, target naming and shared report-path collisions, manifest registrations, stale outputs, preservation of archived documents during generation, and no output changes after validation failure.
- [ ] Confirm palette-only builds do not require variables or token mappings.
- [ ] Check development manifest synchronization in a temporary extension directory before refreshing the real local extension.
- [ ] Run `npm run check` and confirm a second build makes no changes.
- [ ] Build a validation VSIX under `dist/` and inspect its theme registrations and packaged contents.
- [ ] Preview the default, another production target, a local target, and a historical snapshot using the grammar samples; compare migrated themes with their recorded baselines.
- [ ] Commit completed implementation stages with their source, generated outputs, and documentation together.

## Completion criteria

The restructuring is complete when every theme uses the shared six-file layout, omitted non-default inputs fall back to the default by file, and production and local targets can supply independent complete palettes and variable maps. All generated reports live under `docs/palettes/generated-reports/<theme name>/palette.*`, preserved palette documents live under `docs/palettes/archive/`, production themes ship from `themes/`, local previews remain under `dev/themes/`, and snapshots retain their original bytes.

Builds and checks must reproduce every committed output and manifest registration, report invalid references and stale artifacts without writes in check mode, and preserve existing default and local appearances through the migration. Designing new palettes or establishing a finished high-contrast appearance is separate from moving and resolving the inputs.

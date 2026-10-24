# Project restructuring plan 1

Status: Proposed. This document describes future work; creating this plan does not implement the restructuring.

## Objective

Make production inputs, shipped assets, development experiments, historical snapshots, generated reports, and release packages easy to distinguish. Reuse the palette and token builders for experimental themes while preserving production behavior and historical comparisons.

## Target structure

```text
src/                              # Editable production inputs
  palette.jsonc
  tokens.jsonc
  cassidy-dark-color-theme.jsonc

themes/                           # Generated production theme
  cassidy-dark-color-theme.json

images/                           # Images shipped with the extension

dev/
  experiments/                    # Editable development build inputs
    <name>/
      palette.jsonc               # Optional palette overrides
      tokens.jsonc                # Optional token overrides
      theme.jsonc                 # Optional replacement theme template
  themes/                         # Generated experimental themes
  snapshots/                      # Historical themes preserved unchanged
  generated/
    palette/                      # Generated production palette reports
      palette.json
      palette.md
      palette.svg
      <name>/                     # Reports for an experimental palette
        palette.json
        palette.md
        palette.svg
  samples/                        # Files for inspecting syntax highlighting

scripts/
  build/                          # Palette/theme generation and artifact validation
  dev/                            # Development extension synchronization
  release/                        # Packaging and publishing
  lib/                            # Shared utilities

tests/                            # Automated tests and test helpers
docs/
  development/                    # Maintained development guides
  references/                     # Maintained reference material
  plans/                          # Proposed implementation plans

dist/                             # Local VSIX packages; ignored by Git

package.json                      # Production extension manifest and project commands
package-lock.json
README.md
CHANGELOG.md
LICENSE
```

The repository root continues to hold editor, formatter, lint, hook, and pipeline configuration files.

## Ownership and packaging

| Location                                      | Ownership                                             | Git policy                                 | Shipped in the VSIX |
| --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------ | ------------------- |
| `src/`                                        | Edited production inputs                              | Committed                                  | No                  |
| `themes/`                                     | Generated production theme                            | Committed and checked for staleness        | Yes                 |
| `images/`                                     | Ready-to-package logos and screenshot                 | Committed                                  | Yes                 |
| `dev/experiments/`                            | Edited experimental inputs                            | Committed                                  | No                  |
| `dev/themes/`                                 | Generated experimental themes                         | Committed and checked for staleness        | No                  |
| `dev/snapshots/`                              | Historical comparison themes                          | Committed; migration preserves their bytes | No                  |
| `dev/generated/palette/`                      | Generated palette reports                             | Committed and checked for staleness        | No                  |
| `dev/samples/`, `scripts/`, `tests/`, `docs/` | Development material and tooling                      | Committed                                  | No                  |
| `dist/`                                       | Generated release packages and local packaging checks | Ignored                                    | No                  |

Keep the production manifest, public README, changelog, license, and images in their current locations. Maintain one production extension manifest and generate the separate development manifest as today. Introducing editable image originals or image generation is outside this restructuring.

## Build behavior

### Production

Production builds continue to read the three inputs in `src/` and write `themes/cassidy-dark-color-theme.json`. Preserve the theme's parsed values, metadata, scope ordering, and styles through the restructuring.

Move the generated palette reports as follows:

| Current path                                                | Target path                          |
| ----------------------------------------------------------- | ------------------------------------ |
| `docs/references/palettes/generated/palette.generated.json` | `dev/generated/palette/palette.json` |
| `docs/references/palettes/generated/palette.generated.md`   | `dev/generated/palette/palette.md`   |
| `docs/references/palettes/generated/palette.generated.svg`  | `dev/generated/palette/palette.svg`  |

Remove the redundant `.generated` filename suffix. Update the Markdown report's relative image reference to `palette.svg`, its generated-file notice, and all links to these reports. Keep curated palette notes, proposals, opacity references, and archived reference documents under `docs/references/palettes/`.

### Experiments

Add named development targets under `dev/experiments/<name>/`. Discover targets deterministically and validate names before deriving output paths. Require at least one recognized input file per target. Each target starts from the production inputs:

- An optional `palette.jsonc` overrides supplied palette settings. Merge nested configuration objects by key; replace scalar values and arrays. Validate the complete merged configuration using the existing palette rules.
- An optional `tokens.jsonc` overrides supplied token paths. Merge grouping objects; each override leaf must include `color` and replaces that token leaf in full. This lets an experiment omit an inherited `alpha`, `details`, or literal-color `reason` without accidentally retaining it. Validate the complete merged token map.
- An optional `theme.jsonc` replaces the production template in full. This supports experiments with additional workbench colors or different scope rules while retaining the existing reference renderer.
- Missing files reuse their production counterparts. Do not introduce a deletion syntax in this first restructuring.

Write the resolved theme to `dev/themes/cassidy-dark-color-theme-<name>.json` and that target's palette reports to `dev/generated/palette/<name>/`. Experimental builds must leave production outputs and production palette reports untouched.

Reuse palette generation, alias resolution, template rendering, formatting, and validation across both build types. Parameterize input labels, output destinations, and generated-file notices so errors and instructions identify the correct target. Preserve validation before replacement, deterministic output, and read-only check mode.

Historical snapshots remain independent comparison files. Do not recolor them when the production palette changes. Existing experimental themes may initially retain literal template colors during conversion; migrate selected values to references by their intended roles, rather than automatically matching equal hex values.

## Command responsibilities

These are proposed responsibilities after implementation; `build:dev` does not exist yet.

| Command                   | Planned behavior                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run build:palette`   | Generate production palette reports under `dev/generated/palette/` without requiring tokens or a template.      |
| `npm run build:theme`     | Generate the production theme and production palette reports.                                                   |
| `npm run build:dev`       | Build all configured experiments and their reports.                                                             |
| `npm run dev:sync`        | Build production and experiments, then refresh the separate development extension manifest and asset links.     |
| `npm run check:generated` | Check production and experimental generated outputs without writing files; exclude snapshots from regeneration. |
| `npm run check:theme`     | Validate the production theme, generated experimental themes, historical snapshots, and manifest asset paths.   |
| `npm run check`           | Run generated-output checks, formatting, linting, theme validation, and tests.                                  |
| `npm run package:vsix`    | Require current generated outputs and package only production content.                                          |

Keep the existing release command names and pipeline publishing behavior. Do not add automatic promotion of experiments into production or an automatic watch process as part of this work.

## Implementation sequence

### 1. Record the baseline

- [ ] Record parsed production theme data and the generated palette measurements for comparison.
- [ ] Record the current development theme filenames, picker labels, and contents.
- [ ] Classify the existing `test` and `v1.3` themes as active experiments, retaining the latter's diagnostic marker colors during conversion. Move the two `v1.2.1` comparison themes to `dev/snapshots/` with their filenames and bytes preserved.
- [ ] Review current packaging contents and the development extension's symlink protections.

### 2. Separate generated reports and organize tooling

- [ ] Move and rename the three generated palette reports to `dev/generated/palette/`.
- [ ] Update report generation, relative image references, stale-output checks, and all documentation links.
- [ ] Move `scripts/build-theme.js` and `scripts/check-theme.js` into `scripts/build/`, retaining the shared utilities in `scripts/lib/`.
- [ ] Update relative imports, repository-root resolution, npm entry points, test imports, and documentation links affected by the script moves.
- [ ] Confirm that a rebuild preserves production theme data and palette measurements.

### 3. Add reusable development targets

- [ ] Separate the shared build operations from target discovery and command orchestration.
- [ ] Implement the palette and token override rules and optional replacement templates described above.
- [ ] Add `build:dev` with deterministic target ordering and isolated theme/report destinations.
- [ ] Convert the active development themes into experiment input directories, preserving parsed theme behavior before any intentional palette edits.
- [ ] Keep `dev/themes/` exclusively for generated previews and `dev/snapshots/` exclusively for historical comparisons.
- [ ] Include every committed generated target in `check:generated`, with errors identifying the appropriate rebuild command. Detect stale files left behind by removed or renamed targets without deleting them in check mode.

### 4. Refresh preview and validation workflows

- [ ] Make `dev:sync` build both production and experimental targets before refreshing the manifest.
- [ ] Register the production preview, generated experiments, and historical snapshots with distinct, predictable picker labels. Mark snapshots clearly in their labels.
- [ ] Update theme discovery in the validator to cover `dev/themes/` and `dev/snapshots/`.
- [ ] Preserve the separate development identity, linked checkout assets, repeatable synchronization, and existing symlink protections.
- [ ] Update the development guide, README, project structure tables, command descriptions, and changelog. Keep this plan as the record of the proposed migration.

### 5. Verify packaging and completion

- [ ] Keep `dev/`, `src/`, `docs/`, `scripts/`, and `tests/` excluded from the VSIX. Keep `dist/` ignored by Git and leave committed reports and previews tracked.
- [ ] Update existing tests for moved paths and add focused coverage for experiment merging, leaf replacement, missing optional inputs, target isolation, stale outputs, and unchanged outputs after failed validation.
- [ ] Check development manifest discovery and labels using a temporary extension directory before refreshing the real local extension.
- [ ] Run `npm run check` and confirm a second build makes no changes.
- [ ] Create a local validation VSIX under `dist/` and inspect its contents. Confirm it contains the production theme and distributable assets, with no experiment sources, previews, snapshots, or palette reports.
- [ ] Preview production, an experiment, and a historical snapshot in VS Code using the grammar samples. Confirm the migration preserves their expected appearance.
- [ ] Commit completed implementation stages with their source, generated outputs, and documentation together.

## Completion criteria

The restructuring is complete when the directory names distinguish edited inputs, generated development outputs, and historical files; both build types share the same color resolution logic; committed outputs can be reproduced and checked without writes; and the packaged production theme retains its behavior and identity. Palette redesign, image processing, publishing, and changes to historical theme colors remain separate work.

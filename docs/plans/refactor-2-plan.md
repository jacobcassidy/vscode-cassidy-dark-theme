# Organize the project around sources, tooling, and commands

## Summary

Keep the current theme target directories, grouping each token family's definitions and details together within its theme. Give shared token data a source-owned home and separate reusable implementation from executable scripts.

Today, templates and lookups under `docs/` support theme authoring scripts; builds compile authored theme inputs directly. The upcoming token-category validator adds a build dependency on shared classification data. Separating these responsibilities makes the dependency clear while simplifying the build script's responsibilities.

## Recommended layout

```text
src/
  token-data/
    README.md
    sources.jsonc
    ui/
      definitions.jsonc
      details.jsonc
    semantic/
      definitions.jsonc
      details.jsonc
    syntax/
      details.jsonc
  themes/
    prod/<name>/
    dev/<name>/
      metadata.jsonc
      palette/
      tokens/
        variables/
          definitions.jsonc
          details.jsonc
        ui/
          definitions.jsonc
          details.jsonc
        semantic/
          definitions.jsonc
          details.jsonc
        syntax/
          definitions.jsonc
          details.jsonc

tooling/
  generators/
  palette/
  preview/
  shared/
    color-math.js
  themes/
  tokens/
    formats.js
    category-validation.js
    compilation.js
    data/
      load.js
      sources.js
      extraction.js
      update-details.js

scripts/
  token-data/
    update-token-details.js
  themes/
    add-properties.js
    add-theme.js
    build.js
    check.js
    watch.js
  release/

tests/
  generators/
  palette/
  preview/
  shared/
    color-math.test.js
  themes/
  tokens/
    data/
  workflows/
  helpers/
  fixtures/

samples/
  grammar/
    tsconfig.json
    <language samples>

docs/
  guides/
  references/
  plans/

themes/
preview/
  themes/
  static-snapshots/
images/
```

Keep production outputs, images, and each theme’s palette reports in their current locations. Rename `dev-extension/` to `preview/`, retaining `themes/` for generated dev themes and `static-snapshots/` for fixed comparison themes.

Both prod and dev themes use the illustrated family layout. Move each theme's `tokens/<family>.jsonc` to `tokens/<family>/definitions.jsonc` and `details/<family>.jsonc` to `tokens/<family>/details.jsonc`, for `variables`, `ui`, `semantic`, and `syntax`. Remove the old theme-level `details/` directory after migration.

`definitions.jsonc` holds styling, aliases, or rules; `details.jsonc` holds purpose descriptions and relationships. Use these same filenames in `src/token-data/<family>/` and each theme's `tokens/<family>/`. The parent directory establishes ownership: shared definitions provide the token inventory, categories, and placeholder styling used by generators; theme definitions provide that theme's configured styling. Shared details provide reference documentation, while theme details hold authored explanations and relationships. Keep these family directories as the final directory level.

Preserve independent whole-file fallback for each file. A theme may supply `tokens/semantic/definitions.jsonc` while inheriting `tokens/semantic/details.jsonc`, or the reverse. A supplied empty details file in the applicable schema suppresses documentation fallback. Omitted files remain omitted; creating a family directory does not materialize inherited files or make fallback apply to the whole directory. The default theme continues to supply every required definition and details file.

Move the remaining human reference, `hex-opacity.md`, into `docs/references/`. Remove `docs/templates/` and `docs/lookups/` after their consumers have migrated.

## Responsibilities and interfaces

Give each tooling directory a specific purpose:

| Directory      | Responsibility                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `palette/`     | Palette generation and palette report rendering.                                                                                            |
| `tokens/`      | Shared nested-format handling, category validation, alias resolution, token compilation, and theme rendering.                               |
| `tokens/data/` | Loading shared token data and category indexes, retrieving pinned upstream sources, extracting descriptions, and refreshing shared details. |
| `themes/`      | Target discovery, fallback resolution, manifests, generated-theme validation, build preparation, and build/watch workflows.                 |
| `generators/`  | Theme scaffolding, property addition, syntax ID assignment, and comment-preserving source edits.                                            |
| `preview/`     | Development extension synchronization, registrations, asset links, and reload guidance.                                                     |
| `shared/`      | Reusable color math, repository paths, JSONC parsing, filesystem helpers, terminal output, and artifact staging.                            |

Apply these boundaries:

- **Scripts are command entry points.** They parse arguments, select defaults, invoke tooling, and report failures. Move reusable exported functions into `tooling/`; tests import those modules. Keep the directory name `tooling/` singular throughout imports, commands, documentation, and packaging rules.
- **Color math is shared.** Place reusable color conversion, gamut calculations, hex validation, alpha handling, and contrast calculations in `tooling/shared/color-math.js`. Both palette generation/report rendering and token compilation import it directly. Keep token compilation independent of `tooling/palette/`.
- **Core builds prepare outputs before writing.** Separate palette reports, manifest generation, and artifact replacement from build orchestration. Combined builds preflight both groups before either group writes, as required by the upcoming plan.
- **Preview synchronization belongs to workflows.** Compilation and artifact preparation do not synchronize extensions. Build/watch workflows invoke preview synchronization after successful writes.
- **Use one token-format implementation.** Compiler, generators, updater, and validators share canonical ID construction, category traversal, semantic selector encoding, and syntax ordering.
- **Group token processing under one parent.** Keep format handling, category validation, and compilation in `tooling/tokens/`, with shared-data operations under `tooling/tokens/data/`. Use `load.js` for checked-in data, `sources.js` for pinned source retrieval, `extraction.js` for description extraction, and `update-details.js` for refresh orchestration. Mirror data-operation tests under `tests/tokens/data/`.
- **Load one token-data snapshot per pass.** Expose shared definitions, shared details, classification indexes, and originating paths through `tooling/tokens/data/load.js`. Keep upstream retrieval and extraction confined to explicit refresh operations; ordinary builds load checked-in data without fetching sources.
- **Separate validation data from styling inputs.** Build preflight uses checked-in token data to validate category membership. Compilation resolves styling from theme definitions and their effective palette, including existing prod-default fallback. Builds do not copy shared placeholder styling or descriptions into theme inputs; `add:theme` and `add:properties` perform that optional authoring work through `tooling/generators/`. Palette-only builds remain independent of token data.
- **Centralize repository paths.** Keep stable roots and token-data filenames in one paths module; retain injectable repository roots for isolated tests.

Preserve existing npm command names and flags. Point them at the command wrappers, with the planned updater exposed as `update:token-details`.

## Token data ownership and documentation

Group shared inputs by token family, as selected, while preserving their distinct contracts:

| Input                   | Authority                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Shared definitions      | Supported inventory, category membership, and placeholder styling used by generators. |
| Shared details          | Reusable descriptions, protected description flags, and usage context.                |
| Theme-local definitions | That theme’s styling, aliases, rules, and enabled state.                              |
| Theme-local details     | Authored explanations, protection flags, usage context, and relationships.            |
| `sources.jsonc`         | Pinned upstream revisions and extraction input configuration.                         |

Keep shared definitions and detail files separate. Their inventories intentionally differ, and refreshing descriptions must not expand shared definitions or overwrite theme-specific documentation. The UI and semantic files named templates in the token-catalog plan become `src/token-data/ui/definitions.jsonc` and `src/token-data/semantic/definitions.jsonc`; their generator and classification authority roles remain unchanged.

Adapt the upcoming [token-catalog plan](token-catalog-and-nested-sources-plan.md) to these destinations while preserving its format and validation requirements: four categories, protected descriptions, optional non-standard usage context, exact semantic selectors, and explicit syntax order. Keep `src/token-data/syntax/` details-only, without a shared `definitions.jsonc`; syntax definitions remain authored in themes. Internal variables also remain theme-owned, without a shared token-data family. Use `src/token-data/` for the shared inputs, `tooling/tokens/data/` for loading and refreshing those inputs, and `tooling/generators/` for code that creates or updates theme inputs. Put the updater command wrapper in `scripts/token-data/update-token-details.js`, preserving the `update:token-details` npm command.

Document ownership, update commands, and authoring-versus-validation dependencies in `src/token-data/README.md`. In the development guide, explain the flow once:

```text
src/token-data/ → optional generators → authored theme inputs
       │                                      │
       └──────→ category validation ←──────────┘
                         ↓
           compilation from theme inputs
                         ↓
              prepared output artifacts
                         ↓
               write/check → preview sync
```

Keep active guides and examples current. Preserve archived plans and historical comparisons, repairing links where necessary.

## Preview assets

Move `dev-extension/themes/` to `preview/themes/` and `dev-extension/static-snapshots/` to `preview/static-snapshots/`, including their adjacent README files. Preserve theme filenames, snapshot bytes, extension identity, picker labels, and production registrations. Keep `src/themes/dev/` as the authoring location; its generated outputs move to `preview/themes/`.

`preview/` contains assets used by the Cassidy Dark Preview extension, while `tooling/preview/` contains synchronization and registration code. Update generated output paths, stale-output cleanup, formatter path handling, theme validation, preview registrations, watcher inputs, test fixtures, and active documentation to use the new asset paths. Refresh the generated extension's asset links and manifest paths while preserving existing symlink protections and the separate generated manifest location. Continue excluding preview assets from the production VSIX by replacing the old `dev-extension/` exclusion with `preview/`.

## Grammar samples

Move `docs/grammar-samples/` to `samples/grammar/`. Describe them in the guide as language samples for inspecting highlighting. These files provide programming, markup, stylesheet, configuration, and log examples for visually inspecting TextMate and semantic highlighting in VS Code. Keep the guides for using them in `docs/guides/` and automated test inputs in `tests/fixtures/`.

Move the sample files together, keeping `tsconfig.json` beside the TypeScript, TSX, and JavaScript samples so VS Code continues discovering the configuration and resolving sibling imports. Preserve sample syntax, comments, and highlighting probes; update embedded paths and example validation commands to the new location. The sample programs remain visual inspection inputs, with their optional language-toolchain checks separate from `npm run check`.

Update the README, development guide links and sample tables, `.prettierignore`'s Svelte entry, any formatter/linter or editor path configuration, and source comments that mention the old directory. Audit relative imports and paths inside the samples, including the Python path example. Exclude `samples/` from the VSIX explicitly because the existing exclusion of `docs/` will no longer cover these files. Preserve historical changelog and archive descriptions of earlier locations.

## Migration and verification

1. **Capture the baseline.** Record theme membership, styling, syntax precedence, fallback behavior, generated outputs, and snapshot bytes.
2. **Establish the tooling boundaries.** Move reusable code, extract build responsibilities, and update test imports without changing source formats. Move existing color math into `tooling/shared/color-math.js`; place palette generation and report rendering under `tooling/palette/`, updating both palette and token compilation imports to use shared color math.
3. **Group theme inputs by family.** Move existing local token and details files to their paired family paths, preserving contents and omitted files. Update input discovery, compiler loading, scaffolding, property addition, updater source inventories, and test fixtures together. Preserve alias names and independent per-file fallback.
4. **Implement the upcoming token-data migration at the final paths.** Move shared inputs directly into `src/token-data/`, using `definitions.jsonc` for UI and semantic starter definitions and `details.jsonc` for shared descriptions, avoiding the proposed intermediate `docs/` destinations. Update generator readers, category authority paths, watcher subscriptions, updater inputs, and fixtures to those exact filenames. Group format handling, validation, and compilation under `tooling/tokens/`, loading/extraction/refresh under its `data/` subdirectory, and theme authoring under `tooling/generators/`. Apply the token-catalog plan's categorized authoring format to the theme files at their new family paths.
5. **Align tests with responsibilities.** Move shared project builders into `tests/helpers/`, place upstream extraction samples in `tests/fixtures/`, and update test discovery for nested suites. Group palette generation/report tests under `tests/palette/`, color math tests under `tests/shared/color-math.test.js`, and shared token-data operation tests under `tests/tokens/data/`. Verify independent definition/details fallback in both directions, explicit empty details, omitted local files, required default files, and generator output paths.
6. **Rename preview assets.** Move `dev-extension/` to `preview/` with its existing `themes/` and `static-snapshots/` subdirectories. Update output paths, cleanup and validation, formatter handling, registrations, generated asset links, watchers, fixtures, documentation, and VSIX exclusions together. Verify preview synchronization in an isolated extension destination, preserving extension identity, labels, and snapshot bytes.
7. **Move grammar samples.** Move `docs/grammar-samples/` into `samples/grammar/` with its adjacent `tsconfig.json`. Update active guide/README links, embedded paths and validation commands, and formatter/linter/editor configuration. Verify that the TypeScript configuration and sibling imports still resolve in the new directory.
8. **Update all consumers.** Audit active links, npm scripts, imports, watcher subscriptions, formatting/lint configuration, packaging exclusions, and generated-file notices. Exclude `tooling/`, `preview/`, and `samples/` from the VSIX and ignore the upstream cache.
9. **Verify and commit completed stages.** Run focused tests and `npm run check`; confirm repeatable builds, read-only checks, isolated preview synchronization, and VSIX contents.

Acceptance requires unchanged theme appearance and exact syntax precedence; preserved comments, descriptions, and fallback behavior; actionable category diagnostics; watcher recovery after token-data corrections; and no upstream downloads during ordinary builds or tests. Verify consistent `definitions.jsonc`/`details.jsonc` filenames across shared data and theme families, retaining details-only shared syntax data. Shared category edits must trigger validation without populating theme inputs, shared placeholder colors must never replace authored styling during builds, and palette-only builds must not require token data.

Generated dev themes and fixed snapshots must be available under `preview/`, with working generated extension links and registrations. Verify builds, stale-output cleanup, read-only checks, and watcher behavior at the renamed paths, unchanged snapshot bytes and picker labels, and exclusion of preview assets from the VSIX.

All visual highlighting samples must be available under `samples/grammar/`, with working active documentation links and adjacent TypeScript configuration. Preserve their language probes and sibling imports, update all active references to the old sample path, and verify that the VSIX excludes the relocated samples.

Defaults: retain JavaScript ES modules, existing commands, current theme target directories, production theme and palette-report output locations, preview extension identity and picker labels, and release behavior. Keep this an organization and format migration; do not introduce new styling or consolidate theme-local documentation into shared token data.

# Organize the project around sources, tooling, and commands

## Summary

Keep the current theme target directories, grouping each token family's definitions and details together within its theme. Give shared token data a source-owned home and separate reusable implementation from executable scripts.

Today, templates and lookups under `docs/` participate in generation and validation, while the 837-line build script handles several distinct responsibilities. The upcoming catalog plan makes both boundaries more important.

## Recommended layout

```text
src/
  catalogs/
    tokens/
      README.md
      sources.jsonc
      ui/
        template.jsonc
        details.jsonc
      semantic/
        template.jsonc
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
  authoring/
  catalogs/
  palette/
  preview/
  shared/
    color-math.js
  themes/
  tokens/

scripts/
  catalogs/
    update-token-details.js
  themes/
    add-properties.js
    add-theme.js
    build.js
    check.js
    watch.js
  release/

tests/
  authoring/
  catalogs/
  palette/
  preview/
  shared/
    color-math.test.js
  themes/
  tokens/
  workflows/
  helpers/
  fixtures/

docs/
  guides/
  references/
  grammar-samples/
  plans/

themes/
dev-extension/
images/
```

Keep production outputs, preview outputs, snapshots, images, and each theme’s palette reports in their current locations. Those locations already communicate their relationships reasonably well.

Both prod and dev themes use the illustrated family layout. Move each theme's `tokens/<family>.jsonc` to `tokens/<family>/definitions.jsonc` and `details/<family>.jsonc` to `tokens/<family>/details.jsonc`, for `variables`, `ui`, `semantic`, and `syntax`. Remove the old theme-level `details/` directory after migration.

`definitions.jsonc` holds styling, aliases, or rules; `details.jsonc` holds purpose descriptions and relationships. This matches the family grouping in shared catalogs, where `template.jsonc` provides starter definitions and `details.jsonc` provides shared reference documentation. Keep these family directories as the final directory level.

Preserve independent whole-file fallback for each file. A theme may supply `tokens/semantic/definitions.jsonc` while inheriting `tokens/semantic/details.jsonc`, or the reverse. A supplied empty details file in the applicable schema suppresses documentation fallback. Omitted files remain omitted; creating a family directory does not materialize inherited files or make fallback apply to the whole directory. The default theme continues to supply every required definition and details file.

Move the remaining human reference, `hex-opacity.md`, into `docs/references/`. Remove `docs/templates/` and `docs/lookups/` after their consumers have migrated.

## Responsibilities and interfaces

Give each tooling directory a specific purpose:

| Directory    | Responsibility                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `palette/`   | Palette generation and palette report rendering.                                                                            |
| `tokens/`    | Shared nested-format handling, category validation, alias resolution, token compilation, and theme rendering.               |
| `catalogs/`  | Loading the registry, retrieving pinned upstream sources, extracting descriptions, and refreshing shared details.           |
| `themes/`    | Target discovery, fallback resolution, manifests, generated-theme validation, build preparation, and build/watch workflows. |
| `authoring/` | Theme scaffolding, property addition, syntax ID assignment, and comment-preserving source edits.                            |
| `preview/`   | Development extension synchronization, registrations, asset links, and reload guidance.                                     |
| `shared/`    | Reusable color math, repository paths, JSONC parsing, filesystem helpers, terminal output, and artifact staging.            |

Apply these boundaries:

- **Scripts are command entry points.** They parse arguments, select defaults, invoke tooling, and report failures. Move reusable exported functions into `tooling/`; tests import those modules. Keep the directory name `tooling/` singular throughout imports, commands, documentation, and packaging rules.
- **Color math is shared.** Place reusable color conversion, gamut calculations, hex validation, alpha handling, and contrast calculations in `tooling/shared/color-math.js`. Both palette generation/report rendering and token compilation import it directly. Keep token compilation independent of `tooling/palette/`.
- **Core builds prepare outputs before writing.** Separate palette reports, manifest generation, and artifact replacement from build orchestration. Combined builds preflight both groups before either group writes, as required by the upcoming plan.
- **Preview synchronization belongs to workflows.** Compilation and artifact preparation do not synchronize extensions. Build/watch workflows invoke preview synchronization after successful writes.
- **Use one token-format implementation.** Compiler, generators, updater, and validators share canonical ID construction, category traversal, semantic selector encoding, and syntax ordering.
- **Load one registry snapshot per pass.** Expose templates, shared details, classification indexes, and originating paths through the catalog loader. Keep upstream extraction separate from ordinary local builds.
- **Centralize repository paths.** Keep stable roots and catalog filenames in one paths module; retain injectable repository roots for isolated tests.

Preserve existing npm command names and flags. Point them at the command wrappers, with the planned updater exposed as `update:token-details`.

## Catalog ownership and documentation

Group shared inputs by token family, as selected, while preserving their distinct contracts:

| Input                   | Authority                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Family template         | Supported inventory, category membership, and placeholder styling used by generators. |
| Shared details          | Reusable descriptions, protected description flags, and usage context.                |
| Theme-local definitions | That theme’s styling, aliases, rules, and enabled state.                              |
| Theme-local details     | Authored explanations, protection flags, usage context, and relationships.            |
| `sources.jsonc`         | Pinned upstream revisions and extraction input configuration.                         |

Keep template and detail files separate. Their inventories intentionally differ, and refreshing descriptions must not expand templates or overwrite theme-specific documentation.

Adapt the upcoming token-catalog plan to these destinations while preserving its format and validation requirements: four categories, protected descriptions, optional non-standard usage context, exact semantic selectors, and explicit syntax order. Keep syntax without a template.

Document ownership and update commands in the catalog README. In the development guide, explain the flow once:

```text
theme inputs + shared catalogs
              ↓
     validation and compilation
              ↓
      prepared output artifacts
              ↓
       write/check → preview sync
```

Keep active guides and examples current. Preserve archived plans and historical comparisons, repairing links where necessary.

## Migration and verification

1. **Capture the baseline.** Record theme membership, styling, syntax precedence, fallback behavior, generated outputs, and snapshot bytes.
2. **Establish the tooling boundaries.** Move reusable code, extract build responsibilities, and update test imports without changing source formats. Move existing color math into `tooling/shared/color-math.js`; place palette generation and report rendering under `tooling/palette/`, updating both palette and token compilation imports to use shared color math.
3. **Group theme inputs by family.** Move existing local token and details files to their paired family paths, preserving contents and omitted files. Update input discovery, compiler loading, scaffolding, property addition, updater source inventories, and test fixtures together. Preserve alias names and independent per-file fallback.
4. **Implement the upcoming catalog migration at the final paths.** Avoid moving catalogs into the proposed intermediate `docs/` destinations first. Apply its categorized authoring format to the theme files at their new family paths.
5. **Align tests with responsibilities.** Move shared project builders into `tests/helpers/`, place upstream extraction samples in `tests/fixtures/`, and update test discovery for nested suites. Group palette generation/report tests under `tests/palette/` and color math tests under `tests/shared/color-math.test.js`. Verify independent definition/details fallback in both directions, explicit empty details, omitted local files, required default files, and generator output paths.
6. **Update all consumers.** Audit active links, npm scripts, imports, watcher subscriptions, formatting/lint configuration, packaging exclusions, and generated-file notices. Exclude `tooling/` from the VSIX and ignore the upstream cache.
7. **Verify and commit completed stages.** Run focused tests and `npm run check`; confirm repeatable builds, read-only checks, isolated preview synchronization, and VSIX contents.

Acceptance requires unchanged theme appearance and exact syntax precedence; preserved comments, descriptions, and fallback behavior; actionable category diagnostics; watcher recovery after catalog corrections; and no upstream downloads during ordinary builds or tests.

Defaults: retain JavaScript ES modules, existing commands, current theme directories, generated-output locations, and release behavior. Keep this an organization and format migration; do not introduce new styling or consolidate theme-local documentation into shared catalogs.

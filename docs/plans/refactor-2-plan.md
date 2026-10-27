# Organize the project around sources, tooling, and commands

## Summary

Keep the current per-theme structure. The largest improvement would come from giving shared token data a source-owned home and separating reusable implementation from executable scripts.

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
      details/

tooling/
  authoring/
  catalogs/
  colors/
  preview/
  shared/
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
  colors/
  preview/
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

Move the remaining human reference, `hex-opacity.md`, into `docs/references/`. Remove `docs/templates/` and `docs/lookups/` after their consumers have migrated.

## Responsibilities and interfaces

Give each tooling directory a specific purpose:

| Directory    | Responsibility                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `colors/`    | Color math, palette generation, and palette report rendering.                                                               |
| `tokens/`    | Shared nested-format handling, category validation, alias resolution, token compilation, and theme rendering.               |
| `catalogs/`  | Loading the registry, retrieving pinned upstream sources, extracting descriptions, and refreshing shared details.           |
| `themes/`    | Target discovery, fallback resolution, manifests, generated-theme validation, build preparation, and build/watch workflows. |
| `authoring/` | Theme scaffolding, property addition, syntax ID assignment, and comment-preserving source edits.                            |
| `preview/`   | Development extension synchronization, registrations, asset links, and reload guidance.                                     |
| `shared/`    | Repository paths, JSONC parsing, filesystem helpers, terminal output, and artifact staging.                                 |

Apply these boundaries:

- **Scripts are command entry points.** They parse arguments, select defaults, invoke tooling, and report failures. Move reusable exported functions into `tooling/`; tests import those modules.
- **Core builds prepare outputs before writing.** Separate palette reports, manifest generation, and artifact replacement from build orchestration. Combined builds preflight both groups before either group writes, as required by the upcoming plan.
- **Preview synchronization belongs to workflows.** Compilation and artifact preparation do not synchronize extensions. Build/watch workflows invoke preview synchronization after successful writes.
- **Use one token-format implementation.** Compiler, generators, updater, and validators share canonical ID construction, category traversal, semantic selector encoding, and syntax ordering.
- **Load one registry snapshot per pass.** Expose templates, shared details, classification indexes, and originating paths through the catalog loader. Keep upstream extraction separate from ordinary local builds.
- **Centralize repository paths.** Keep stable roots and catalog filenames in one paths module; retain injectable repository roots for isolated tests.

Preserve existing npm command names and flags. Point them at the command wrappers, with the planned updater exposed as `update:token-details`.

## Catalog ownership and documentation

Group shared inputs by token family, as selected, while preserving their distinct contracts:

| Input               | Authority                                                                             |
| ------------------- | ------------------------------------------------------------------------------------- |
| Family template     | Supported inventory, category membership, and placeholder styling used by generators. |
| Shared details      | Reusable descriptions, protected description flags, and usage context.                |
| Theme-local tokens  | That theme’s styling and enabled state.                                               |
| Theme-local details | Authored explanations, protection flags, usage context, and relationships.            |
| `sources.jsonc`     | Pinned upstream revisions and extraction input configuration.                         |

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
2. **Establish the tooling boundaries.** Move reusable code, extract build responsibilities, and update test imports without changing source formats.
3. **Implement the upcoming catalog migration at the final paths.** Avoid moving catalogs into the proposed intermediate `docs/` destinations first.
4. **Align tests with responsibilities.** Move shared project builders into `tests/helpers/`, place upstream extraction samples in `tests/fixtures/`, and update test discovery for nested suites.
5. **Update all consumers.** Audit active links, npm scripts, imports, watcher subscriptions, formatting/lint configuration, packaging exclusions, and generated-file notices. Exclude `tooling/` from the VSIX and ignore the upstream cache.
6. **Verify and commit completed stages.** Run focused tests and `npm run check`; confirm repeatable builds, read-only checks, isolated preview synchronization, and VSIX contents.

Acceptance requires unchanged theme appearance and exact syntax precedence; preserved comments, descriptions, and fallback behavior; actionable category diagnostics; watcher recovery after catalog corrections; and no upstream downloads during ordinary builds or tests.

Defaults: retain JavaScript ES modules, existing commands, current theme directories, generated-output locations, and release behavior. Keep this an organization and format migration; do not introduce new styling or consolidate theme-local documentation into shared catalogs.

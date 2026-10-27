# Split token catalogs and adopt nested theme sources

Status: planned. This document describes implementation work; it does not change the current source format.

## Goals and current state

Split the token purpose catalog, organize templates and lookups by token family, add a reproducible lookup updater, and migrate every authored UI and semantic token file to the categorized nesting demonstrated in `docs/references/examples/`.

The current catalog is `docs/lookups/token-details.jsonc`. It contains 1,031 UI entries, 59 semantic entries, and 46 syntax entries. It has no base section. Current templates are `docs/templates/all-ui-tokens.json` and `docs/templates/all-semantic-tokens.json`, containing 1,002 UI properties and 65 semantic selectors respectively. The default theme contains 29 UI properties and two semantic selectors absent from those templates; eight template semantic selectors are absent from the default theme. Preserve these differences during the format migration.

The UI and semantic examples already have category wrappers. Most authoring files, the compiler, and generators still expect flat keys. Catalog consumers and documentation also retain the former `docs/references/lookups/` path even though the files now live in `docs/lookups/`; update those consumers as part of this work.

## Target paths

```text
docs/
  lookups/
    hex-opacity.md
    tokens/
      semantic-details.jsonc
      syntax-details.jsonc
      ui-details.jsonc
  templates/
    tokens/
      semantic-template.jsonc
      ui-template.jsonc
  references/
    examples/
      example-semantic.jsonc
      example-ui.jsonc
```

| Current path                              | Destination                                                       |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `docs/lookups/token-details.jsonc`        | Split into the three `docs/lookups/tokens/*-details.jsonc` files. |
| `docs/templates/all-semantic-tokens.json` | `docs/templates/tokens/semantic-template.jsonc`                   |
| `docs/templates/all-ui-tokens.json`       | `docs/templates/tokens/ui-template.jsonc`                         |
| `docs/lookups/hex-opacity.md`             | Keep its current path.                                            |

Use JSONC comments for file purpose, upstream provenance, and required license notices. Remove the VS Code color-theme `$schema` and theme metadata wrappers from templates because the new grouped authoring structure is a repository format. UI and semantic files have category objects at the root; syntax files have exactly one root property, `textmate`, whose value is an object. Do not add a syntax template: syntax rules continue to come from authored theme definitions.

## Classification and file structures

The UI and semantic catalog/template files use the same ordered root categories: `standard`, `source`, `non-standard`, and `deprecated`. Keep unused categories as empty objects so the allowed structure is explicit. UI and semantic theme files and their matching details use those categories too. Syntax lookup, token, and detail files use a single `textmate` object instead of category groups.

| Category       | Meaning                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standard`     | Properties or selectors supported by the pinned published schema or standard token type/modifier definitions.                                           |
| `source`       | Properties or selectors verified in the pinned core source registrations but absent from the corresponding published schema or standard definition set. |
| `non-standard` | Extension-owned, provider-defined, or repository-defined entries. Unverified custom entries stay here with a review marker.                             |
| `deprecated`   | Entries explicitly documented as retired, removed, or deprecated. Absence from a template or a source snapshot alone does not establish deprecation.    |

Seed classification from the existing template section comments and examples, then reconcile it against pinned registration evidence. Record any deliberate category corrections in the migration report. Category membership belongs to the canonical token ID, independently of its color, enabled state, or field names. Reject duplicate IDs across categories rather than letting category order select a winner.

### UI files

`ui-template.jsonc` contains categorized, nested VS Code UI IDs. Split dotted IDs into component objects, following `example-ui.jsonc`. Template leaves contain the existing generator placeholder descriptor: `color: "#0ff"` and its `UNREVIEWED` color reason. Existing template hex values are discovery placeholders, not theme styling to copy during migration.

`ui-details.jsonc` uses identical category/path nesting, with purpose records instead of styling records:

```jsonc
{
  "standard": {
    "actionBar": {
      "toggledBackground": { "description": "Extracted registration description." },
    },
  },
  "source": {
    "agentsMobileDiff": {
      "addedForeground": { "description": "Extracted source registration description." },
    },
  },
  "non-standard": {
    "gitblame": {
      "inlineMessage": {
        "description": "Inline blame annotation text.",
        "modified-desc": true,
        "use": "When a Git blame extension contributing this token is installed and its inline blame annotation is visible beside an editor line.",
      },
    },
  },
  "deprecated": {},
}
```

Verify the illustrated classification against the pinned inputs during implementation. Keep all 29 existing authored UI IDs absent from the template in the lookup inventory, and classify them using their existing evidence. Do not add them to the template automatically or delete them from themes.

Support nodes that are both a token and a branch, as already demonstrated by `testing.iconFailed` and `testing.iconFailed.retired`: descriptor fields remain on the parent and `retired` remains a child object. Collect both tokens. Apply the same rule to a purpose record with its own `description` field and nested children. Detect ambiguity between reserved record fields and child names explicitly.

### Semantic files

`semantic-template.jsonc` and `semantic-details.jsonc` use the category, token type, and selector suffix structure shown in `example-semantic.jsonc`:

```jsonc
{
  "standard": {
    "*": {
      "abstract": { "description": "Extracted abstract modifier description." },
      "deprecated": { "description": "Extracted deprecated modifier description." },
    },
    "parameter": {
      "default": { "description": "Extracted parameter token description." },
    },
  },
  "source": {},
  "non-standard": {
    "parameter": {
      "readwrite": {
        "description": "Provider-specific read/write parameter styling.",
        "modified-desc": true,
        "use": "When the active language extension emits parameter.readwrite for a parameter occurrence.",
      },
    },
  },
  "deprecated": {},
}
```

Template leaves use placeholder styling descriptors; lookup leaves use detail records. In a theme, `parameter.default` retains the existing configured descriptor, such as `color: "syntax.parameter"`. It compiles to the selector `parameter`, not `parameter.default`.

Selector encoding must preserve the existing selector language:

- `*.abstract` becomes `"*": { "abstract": record }`.
- `parameter` becomes `"parameter": { "default": record }`.
- `parameter.readwrite` becomes `"parameter": { "readwrite": record }`.
- Combined modifiers remain a single suffix key: `*.builtin.deprecated` becomes `"*": { "builtin.deprecated": record }`. Modifier combinations are selectors, not modifier inheritance.
- Put a language qualifier on the type key: `variable.readonly:typescript` becomes `"variable:typescript": { "readonly": record }`; `variable:typescript` uses its `default` child. Preserve modifier order and exact language spelling when reconstructing selectors.
- Reserve the child name `default` for an unmodified selector. Fail migration with a specific diagnostic if an actual modifier named `default` creates an ambiguity; the current inventory has no such collision. Document this reservation.

A selector containing the modifier `deprecated`, such as `*.deprecated`, belongs to its normal category; it does not become a retired selector. Resolve classifications of provider-specific names such as `builtin`, `arrow`, and `readwrite` from their registration evidence. Preserve all 65 template selectors and all 59 authored selectors; retain `function.defaultLibrary` and `parameter.readwrite` even though they are absent from the current template.

### Syntax details

`syntax-details.jsonc` has one top-level `textmate` object containing exact, stable syntax rule IDs, rather than splitting rule IDs or TextMate scope expressions:

```jsonc
{
  "textmate": {
    "bold": {
      "description": "Bold formatting for Markdown bold spans.",
      "modified-desc": true,
    },
  },
}
```

All 46 current syntax IDs live directly inside `textmate`. Syntax files do not use `standard`, `source`, `non-standard`, or `deprecated` root groups. Retain any retirement explanation in the relevant rule's details and its existing disabled fields where applicable.

Wrap source `details/syntax.jsonc` in the same `textmate` object, indexed by exact IDs. In `src/themes/*/*/tokens/syntax.jsonc`, keep the ordered rules under `textmate.rules`:

```jsonc
{
  "textmate": {
    "rules": [
      {
        "id": "bold",
        "name": "BOLD",
        "scope": ["markup.bold.markdown"],
        "fontStyle": "bold",
      },
    ],
  },
}
```

An explicitly empty syntax token file becomes `{ "textmate": { "rules": [] } }`; an explicitly empty syntax details file becomes `{ "textmate": {} }`. Omitted files retain whole-file fallback. Validate the wrapper and unwrap the ordered array before compilation. Preserve rule order, scope order, IDs, names, formatting-only rules, backgrounds, and disabled definitions. Base roles remain in their existing nested format, with purpose details derived from those definitions; metadata and palette formats continue to use their current schemas.

## Descriptions and refresh protection

Replace `for` with `description` in every lookup detail record and authored `details/*.jsonc` record, including base and syntax details. Add an optional boolean `modified-desc` to those records. Remove the proposed per-entry `source` attribution property from the schema. These fields are documentation metadata and never become theme color fields or emitted VS Code settings.

- When `modified-desc` is exactly `true`, the updater preserves the existing `description` rather than replacing it with extracted text. Require a nonempty description on a protected entry.
- When `modified-desc` is absent or `false`, the description is eligible for refresh from extraction. Removing the flag or setting it to `false` restores that behavior. Reject nonboolean values rather than treating them as truthy flags.
- UI and semantic descriptions come from extracted registration descriptions by default. Syntax descriptions come from extracted local rule/scope descriptions, supplemented by grammar contribution descriptions where available. Base descriptions continue to be derived from base role definitions.
- Preserve existing description text verbatim during the format/property-name migration. Do not automatically mark every migrated or unresolved entry as modified; set `modified-desc: true` only for descriptions explicitly chosen to be protected from extraction.
- Keep extraction provenance, pinned revisions, review date, and upstream license in catalog headers. The root category named `source` remains a category; there is no per-record `source` property.
- When adding a new theme detail entry, copy the catalog's `description` and its `modified-desc` value when present. Preserve existing theme-specific descriptions, protection flags, relationships, and reviewed fields during property addition.
- Refresh protection applies to the description only. It does not prevent token validation, category reconciliation, or updates to unrelated metadata. Do not clear a protection flag during refresh.

Protected catalog descriptions are authoritative for the lookup updater. Also import protected descriptions from `prod/default/details/`; if both locations have `modified-desc: true` and conflicting descriptions for one token, fail with both paths and require reconciliation. Protection flags and descriptions in dev themes stay local to that theme and do not silently replace the shared catalog.

## Non-standard usage context

Add optional `use` text to individual token records inside `non-standard`, documenting the conditions in which the token is used. Store it on non-standard UI and semantic lookup detail records and corresponding authored theme detail records. Allow it as documentation metadata on non-standard template leaves so templates can supply context when a lookup does not yet contain it. Keep the category object itself as a container of tokens.

- `use` is a nonempty string when present. Omit it when the usage context is unknown; reject empty strings, whitespace-only strings, arrays, and other nonstring values.
- Describe the contributing extension by display name and extension ID when verified, the relevant language/provider when applicable, and the visible object or state that uses the token. For example: `When Example Blame (example.blame) is installed and its inline blame annotation is visible beside an editor line.` This extension name is illustrative; populate real entries only from verified extension or provider evidence.
- Keep `description` focused on the token's purpose and `use` focused on its activation/display context. An installed extension alone does not imply that its relevant UI is visible or its semantic provider is active.
- Preserve authored `use` text during lookup refresh regardless of `modified-desc`. That flag protects only `description`. Extraction may supply missing usage context when the evidence establishes it; otherwise leave the property absent.
- When generating a new theme detail record, copy `use` from the lookup, or from the template when the lookup has no value. Preserve an existing theme-specific value. Report conflicting lookup/template context for review rather than silently replacing authored text.
- Treat template `use` as documentation metadata: transfer it into generated details, excluding it from styling token definitions and emitted VS Code theme JSON. It has no effect on token matching, aliases, rendering, or preview reload requirements.
- Validate `use` on non-standard token leaves, alongside `description` and `modified-desc` where applicable. If a category correction would move an entry carrying `use` outside `non-standard`, report it for reconciliation before writing rather than silently dropping its usage text.
- Syntax files retain their single `textmate` wrapper; this addition does not create a syntax `non-standard` group.

## Lookup updater and extraction

Add `scripts/themes/update-token-details.js` and the package command:

```json
{
  "update:token-details": "node scripts/themes/update-token-details.js"
}
```

Add shared extraction code in `scripts/lib/token-detail-extraction.js` and an explicit source configuration, for example `scripts/themes/token-detail-sources.jsonc`, recording the existing stable VS Code snapshot `1.143.1` and supplemental main revision `1184ad4d45794110deb6b897ea83b15aac44ed89`. Verify that these revisions are available during implementation; changing a pin is a documented source update, not an automatic switch to latest.

The updater will:

1. Read and validate both categorized templates, all three lookups, and authored token/detail inventories. Refresh the union of template IDs, existing lookup IDs, and authored IDs without expanding templates or pruning lookup entries implicitly.
2. Preserve descriptions with `modified-desc: true` before considering extracted text. Refresh entries with an absent or false flag, and validate protection conflicts before writing.
3. Extract UI registration descriptions from pinned `registerColor` calls and contributed color definitions. Extract semantic type/modifier descriptions from registry declarations and extension contributions. Use the stable registration first and the pinned main registration for verified additions absent from stable.
4. Parse TypeScript structurally, using a TypeScript AST parser and an explicit development dependency/lockfile update. Resolve supported static strings, localization message forms, and referenced constants; report unresolved dynamic expressions. Read extension manifests as data. Never execute upstream modules to obtain descriptions.
5. Derive descriptions for semantic combinations from the extracted type/modifier definitions without claiming unsupported provider behavior. Extract local syntax rule names, ordered scopes, and available descriptive comments for source-derived syntax purposes. Preserve authored syntax descriptions marked `modified-desc: true`.
6. Retain reviewed descriptions for unresolved existing tokens and report the missing extraction evidence. New unresolved tokens receive a nonempty `UNREVIEWED` description and a warning; do not manufacture reviewed descriptions. Retaining an entry because extraction is unavailable must not set `modified-desc: true` automatically; keep reporting it for review on later updates.
7. Reconcile evidence-backed category changes, preserving protected descriptions, protection flags, authored `use` context, relationships where present, provenance, and upstream license notices. Fill missing non-standard usage context only from verified evidence and report classification/context conflicts before writing. Absence upstream never causes automatic deletion or deprecation.
8. Prepare, validate, and format all three candidate catalogs before replacing any destination. Write changed files only, stage replacements, and restore prior files on a commit failure. Repeated runs with identical inputs must leave files and timestamps unchanged.
9. Report counts and changed paths using established colors: yellow headings, blue information and paths, green additions/success, bright yellow warnings, red errors, magenta required actions and important messages. A catalog refresh alone requires no VS Code reload.

Source retrieval and modes:

- Default update uses pinned sources from an ignored `.cache/token-details/` directory, fetching those exact revisions when the cache is missing. Record revisions and required extraction inputs so a result can be reproduced.
- Accept `--vscode-source <path>` and `--vscode-main-source <path>` to use local matching checkouts, with revision validation. Optional extension source roots provide developer/extension registration descriptions that are absent from core.
- `--offline` forbids downloads and gives an actionable error when required sources are missing.
- `--check` performs the same refresh in memory and reports drift without writing lookups or cache files; it requires existing cached or explicitly supplied source snapshots. Keep a clean checkout's ordinary build and aggregate checks independent of this upstream cache.
- Fetch, pin validation, parse, or formatting failures abort before any catalog write. Unknown individual IDs produce review warnings as described above, rather than disguising an extraction failure as a successful reviewed description.
- Builds, `add:theme`, `add:properties`, and watch consume checked-in lookups/templates locally. They do not trigger upstream downloads or modify catalogs as a side effect.

## Shared format handling and source migration

Add `scripts/lib/token-formats.js` to validate and normalize the new structures. It supplies consistent category ordering, canonical ID construction, nested record traversal, syntax `textmate` wrapper handling, and diagnostics for templates, lookups, source tokens, and source details.

Normalize UI and semantic inputs to the compiler's existing canonical IDs before alias collection, details validation, and rendering. Strip category wrappers, UI grouping objects, and semantic `default` markers from emitted IDs. Keep aliases such as `ui.activityBar.foreground`, `semantic.function`, and `syntax.parameter` stable, along with relationship references in details.

Normalize syntax tokens from `textmate.rules` to the existing ordered compiler array, and syntax lookup/detail entries from `textmate` to the existing ID map. The wrapper adds no prefix to syntax IDs, aliases, or emitted TextMate scopes.

Recognize records using the schema for the relevant file, including formatting-only or disabled entries without a color. A node can hold record fields and descendants; traverse both. Reject unknown scalar fields, invalid child structures, duplicate normalized IDs, and reserved-field collisions with diagnostics containing the authored path and canonical ID.

Perform the migration with a repeatable, one-time utility that inventories and stages the complete selected set before writes:

1. Split the current catalog without losing any of its 1,136 entries or its provenance and license. Rename every `for` field to `description` while preserving its text. Translate UI and semantic purpose IDs into the new nesting and seed category membership from the audited inventory; place syntax purpose records inside `textmate`.
2. Move and reshape both templates, preserving their token inventories. Add the four category objects and style-descriptor leaves. Any token additions or removals require a separate, explicit decision.
3. Migrate every existing local `tokens/ui.jsonc` and `tokens/semantic.jsonc` in prod/default, dev/test, dev/beta, and dev/reviewer. Discover targets through the existing discovery API rather than hardcoding those names.
4. Migrate corresponding local `details/ui.jsonc` and `details/semantic.jsonc` to matching category/path nesting. Rename `for` to `description` in every local details file, including base and syntax, without changing its text. Preserve any explicit `modified-desc` flags, non-standard `use` context, `inherits`, `overrides`, and `globallyOverriddenBy` values and their array order. Wrap every existing local syntax token array in `textmate.rules` and every local syntax details ID map in `textmate`, preserving array order and file-level fallback.
5. Preserve JSONC comments by using syntax-tree spans and attaching comments to their original token records during reparenting. Retain disabled definitions, configured colors, alpha, reasons, formatting flags, key case, and deliberate ordering. Never reconstruct authored files solely by parsing and stringifying their values.
6. Keep omitted files omitted and local empty sections empty. Preserve independent whole-file fallback for tokens and details; do not materialize inherited files. An empty categorized input continues to suppress local definitions just as `{}` does today.
7. Inventory unknown and custom IDs and classify them explicitly rather than dropping them. Keep existing theme membership unchanged; migration does not run `add:properties` to populate every theme from expanded catalogs.
8. Refresh both examples to the same codec and classification rules. Document the compound semantic suffix/language conventions and UI parent/child case in the examples or adjacent guide.
9. Switch all active readers and generators together. Update all field validation, required-description checks, diagnostics, examples, and fixtures to use `description`, optional boolean `modified-desc`, and optional non-standard `use` text; remove per-entry `source` support. Remove obsolete flat-format paths and `for` field support once committed sources and fixtures are migrated; no permanent dual-format guessing in the compiler. Fail a migration that encounters conflicting `for` and `description` values rather than discarding either value.

Source changes that only reparent tokens must preserve rendering order as well as values. Capture the current emitted UI/semantic order; where grouping necessarily changes object order, document and review that ordering difference while proving styling equality. Preserve syntax order exactly, since it affects precedence. No category, description, protection flag, `use` context, or authoring-only grouping field appears in generated theme JSON.

## Scripts, tests, and documentation affected

- `scripts/themes/add-properties.js`: replace the obsolete combined catalog path with the split lookups; read categorized templates; add missing entries at nested paths; keep existing review and comment-preservation behavior; fill `description` and propagate `modified-desc` and non-standard `use` context when adding details; read/update syntax rules at `textmate.rules` and syntax purposes inside `textmate`; keep syntax ID generation and base-purpose derivation.
- `scripts/themes/add-theme.js`: scaffold categorized UI/semantic token and detail objects, populate from the renamed templates, and retain metadata copying, whole-file fallback, rollback, terminal colors, and build command guidance.
- `scripts/lib/theme-compilation.js`: normalize nested tokens/details and syntax wrappers before validation and emission; validate `description`, optional boolean `modified-desc`, and optional non-standard `use` text instead of `for` or per-entry `source`; retain all color, alias, disabled-entry, and relationship contracts.
- `scripts/lib/theme-source-inputs.js`, `scripts/themes/build.js`, and `scripts/themes/check.js`: use the shared reader wherever they inspect source shapes. Preserve target discovery, independent fallback, selected-group cleanup, check-mode immutability, and preview registration behavior.
- `scripts/themes/watch.js`: ensure the nested source migration is handled through normal source events. Templates and lookups remain explicit generator inputs rather than runtime build dependencies; catalog-only changes need no automatic rebuild or reload. Actual registration changes still use the existing conditional reminder.
- `package.json` and lockfile: add the updater command, extraction dependency where needed, and any necessary validation integration. Ordinary `npm run check` validates checked-in schemas and coverage offline; upstream refresh checking remains an explicit updater command with pinned inputs.
- `tests/test-projects.js` and existing compilation, validation, property, setup, build, workflow, and watch tests: migrate fixtures and source-path assertions. Keep tests that verify behavior rather than reproducing the nesting implementation.
- `README.md`, `docs/guides/token-details.md`, and `docs/guides/development-guide.md`: document the file tree, categories, nested authoring, `description` and `modified-desc` refresh protection, non-standard `use` context, updater flags/source prerequisites, template-versus-lookup responsibilities, and generator workflow.
- `docs/guides/workbench-color-audit.md`: update active provenance instructions and links to the new catalogs. Preserve historical audit claims with their pinned versions.
- `CHANGELOG.md`: record the completed format/catalog migration during implementation. Plans and historical changelog entries remain historical; repair broken links when relocating active resources without rewriting past behavior.
- Search the whole repository for retired catalog/template paths, former names, and flat-format instructions. Update active prose, code, fixture paths, editor configuration, and any packaging/workflow references found. Verify `hex-opacity.md` links still target `docs/lookups/hex-opacity.md`.

Every authored JavaScript module follows `AGENTS.md` header, declaration JSDoc, parameter documentation, and spacing requirements.

## Implementation sequence

- [ ] Capture canonical token, purpose, alias, scope-order, and generated-output inventories for every current theme; record the template/catalog membership differences.
- [ ] Implement the shared format codec and detail `description`/`modified-desc`/`use` validation; cover ambiguous UI nodes, selectors, syntax wrappers, and duplicate IDs.
- [ ] Implement pinned description extraction and the lookup updater, using fixture snapshots for reproducible behavior checks.
- [ ] Prepare categorized templates and split lookup candidates, including description refresh protection and a classification report.
- [ ] Update compiler, catalog readers, generators, and their fixtures; migrate all local source and detail files in the same integrated change.
- [ ] Refresh examples, active documentation, commands, and path references; retain reviewed provenance and required license notices.
- [ ] Compare normalized inventories and generated themes against the baseline; investigate every missing ID, changed configured style, or changed syntax order.
- [ ] Run the relevant focused tests, then `npm run check`; verify a build and preview sync in an isolated extension destination.
- [ ] Commit the completed implementation, generated changes where applicable, and completion documentation using the repository's commit style.

## Acceptance checks

1. All requested destination files exist and active consumers use their new paths; the old combined catalog and old templates have been removed after successful migration.
2. UI and semantic files have validated category roots; every syntax lookup, token, and detail file has exactly one root `textmate` object with the appropriate ID map or ordered `rules` array. No canonical token is duplicated or silently omitted, including the 29 UI and two semantic source-only entries.
3. Every theme retains its authored token membership, configured styling, reasons, flags, IDs, and independent fallback behavior. Syntax rule and scope order are identical. Normalized aliases and relationship strings remain stable.
4. UI parent/child tokens both survive; unmodified and compound wildcard semantic selectors and language-qualified selectors reconstruct exactly; `*.deprecated` is not misclassified as a retired selector.
5. All lookup and authored detail records use `description` instead of `for`, with no per-entry `source` field. The lookup updater preserves descriptions with `modified-desc: true`; absent or false flags permit extracted refresh. Nonboolean flags, empty protected descriptions, conflicts, incomplete extraction, missing pins, and malformed inputs produce accurate diagnostics and leave files intact on fatal errors.
6. Extraction and merge behavior is covered with local fixture sources: registration strings/localization forms, stable/main precedence, protected descriptions, false/absent flag refresh, preservation and validation of non-standard `use` text independently of description refresh, context propagation to new detail records, context/category conflicts, exclusion of usage metadata from styling/output, unknown IDs, and failure-before-write behavior. Routine tests do not require network access.
7. Repeated updater and generator runs are idempotent. Updater `--check` and build check modes make no writes. Catalog refreshes never manufacture a reload requirement.
8. Generated themes have the same active styling and disabled definitions as the baseline, with exact syntax ordering. Any harmless UI/semantic serialization-order changes are reviewed explicitly rather than hidden by a broad snapshot update.
9. Relevant focused tests and the aggregate checks pass, examples match the live authoring schema, documentation links resolve, and all completed changes are committed.

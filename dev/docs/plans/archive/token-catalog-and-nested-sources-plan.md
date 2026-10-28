# Split token catalogs and adopt nested theme sources

Status: archived. Consolidated into [refactor-2b-plan.md](../refactor-2b-plan.md); use that plan for implementation. This document records the earlier proposal.

## Goals and current state

Split the token purpose catalog, organize templates and lookups by token family, add a reproducible lookup updater, and migrate every authored UI and semantic token file to the categorized nesting demonstrated in `docs/references/examples/`.

The current catalog is `docs/lookups/token-details.jsonc`. It contains 1,031 UI entries, 59 semantic entries, and 46 syntax entries. It has no base section. Current templates are `docs/templates/all-ui-tokens.json` and `docs/templates/all-semantic-tokens.json`, containing 1,002 UI properties and 65 semantic selectors respectively. The default theme contains 29 UI properties and two semantic selectors absent from those templates; eight template semantic selectors are absent from the default theme. Inventory these differences without losing authored entries, and reconcile verified missing standard registrations as described under source category validation.

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

Use JSONC comments for file purpose, upstream provenance, and required license notices. Remove the VS Code color-theme `$schema` and theme metadata wrappers from templates because the new grouped authoring structure is a repository format. UI, semantic, and syntax files have category objects at the root. Do not add a syntax template: syntax rules continue to come from authored theme definitions.

## Classification and file structures

All five catalog/template files use the same ordered root categories: `standard`, `source`, `non-standard`, and `deprecated`. Theme UI, semantic, and syntax token files and their matching details use those categories too. Keep unused categories as empty objects, except syntax token categories, which contain an empty `rules` array. Syntax rules default to `standard`; `non-standard` identifies rules containing verified extension-specific scopes, as detailed below.

| Category       | Meaning                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standard`     | Properties or selectors supported by the pinned published schema or standard token type/modifier definitions.                                           |
| `source`       | Properties or selectors verified in the pinned core source registrations but absent from the corresponding published schema or standard definition set. |
| `non-standard` | Extension-owned, provider-defined, or repository-defined entries. Unverified custom entries stay here with a review marker.                             |
| `deprecated`   | Entries explicitly documented as retired, removed, or deprecated. Absence from a template or a source snapshot alone does not establish deprecation.    |

For UI and semantic tokens, seed classification from the existing template section comments and examples, then reconcile it against pinned registration evidence. For syntax, use the family-specific definitions below. Record any deliberate category corrections in the migration report. Category membership belongs to the canonical token ID, independently of its color, enabled state, or field names. Reject duplicate IDs across categories rather than letting category order select a winner.

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

`syntax-details.jsonc` uses the four category objects containing exact, stable syntax rule IDs, rather than splitting rule IDs or TextMate scope expressions. Put syntax tokens in `standard` by default:

```jsonc
{
  "standard": {
    "bold": {
      "description": "Bold formatting for Markdown bold spans.",
      "modified-desc": true,
    },
  },
  "source": {},
  "non-standard": {},
  "deprecated": {},
}
```

Use these syntax classification rules:

- `standard`: the default for existing and newly authored syntax rules, including conventional TextMate scopes and ordinary language grammar scopes. A repository-defined rule ID does not make the rule non-standard.
- `source`: reserved for a scope verified in the pinned core grammar sources that needs explicit source-only classification. Require documented evidence before moving a rule here; do not use it merely because a rule originated in a theme source file.
- `non-standard`: rules with extension-specific tokens/scopes added or used by a particular extension, such as a custom Rainbow extension scope. A common scope such as `comment` remains standard when a third-party grammar also emits it; extension-specific dependence is what distinguishes this category.
- `deprecated`: explicitly retired rules or scopes with documented deprecation evidence. Disabled styling alone does not establish deprecation.

Seed all 46 current syntax rule IDs as `standard`, then identify and move only verified extension-specific rules into `non-standard`, recording the extension and scope evidence. If a rule combines ordinary scopes and extension-specific scopes, preserve it as one rule with the same ID, styling, and scope list and classify it as `non-standard`. Its optional `use` text must identify which scopes need the extension so readers do not assume the entire rule requires it. Do not split or duplicate the rule merely to classify its scopes.

Source `details/syntax.jsonc` uses the same category objects, indexed by exact IDs. In `src/themes/*/*/tokens/syntax.jsonc`, each category object holds a `rules` array. Give every rule an explicit nonnegative integer `order` to preserve its position across category groups:

```jsonc
{
  "standard": {
    "rules": [
      {
        "order": 0,
        "id": "bold",
        "name": "BOLD",
        "scope": ["markup.bold.markdown"],
        "fontStyle": "bold",
      },
    ],
  },
  "source": { "rules": [] },
  "non-standard": { "rules": [] },
  "deprecated": { "rules": [] },
}
```

During migration, assign `order` from each rule's original array index. Collect rules across all categories and sort by `order` before compilation. Require globally unique IDs and order values within each effective syntax token file; reject missing, negative, fractional, or duplicate order values. Category or object-key ordering never changes precedence. New generated rules append after the highest order unless an explicit insertion is requested. Keep `order` as authoring metadata and exclude it from emitted VS Code theme rules.

An explicitly empty syntax token file has all four category objects, each with `rules: []`; an explicitly empty syntax details file has the four empty category objects. Omitted files retain whole-file fallback. Preserve rule order, scope order, IDs, names, formatting-only rules, backgrounds, and disabled definitions. Base roles remain in their existing nested format, with purpose details derived from those definitions; metadata and palette formats continue to use their current schemas.

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

Add optional `use` text to individual token records inside `non-standard`, documenting the conditions in which the token is used. Store it on non-standard UI, semantic, and syntax lookup detail records and corresponding authored theme detail records. Allow it as documentation metadata on non-standard UI/semantic template leaves so templates can supply context when a lookup does not yet contain it. Keep the category object itself as a container of tokens.

- `use` is a nonempty string when present. Omit it when the usage context is unknown; reject empty strings, whitespace-only strings, arrays, and other nonstring values.
- Describe the contributing extension by display name and extension ID when verified, the relevant language/provider when applicable, and the visible object or state that uses the token. For example: `When Example Blame (example.blame) is installed and its inline blame annotation is visible beside an editor line.` This extension name is illustrative; populate real entries only from verified extension or provider evidence.
- Keep `description` focused on the token's purpose and `use` focused on its activation/display context. An installed extension alone does not imply that its relevant UI is visible or its semantic provider is active.
- Preserve authored `use` text during lookup refresh regardless of `modified-desc`. That flag protects only `description`. Extraction may supply missing usage context when the evidence establishes it; otherwise leave the property absent.
- When generating a new theme detail record, copy `use` from the lookup, or from the template when the lookup has no value. Preserve an existing theme-specific value. Report conflicting lookup/template context for review rather than silently replacing authored text.
- Treat template `use` as documentation metadata: transfer it into generated details, excluding it from styling token definitions and emitted VS Code theme JSON. It has no effect on token matching, aliases, rendering, or preview reload requirements.
- Validate `use` on non-standard token leaves, alongside `description` and `modified-desc` where applicable. If a category correction would move an entry carrying `use` outside `non-standard`, report it for reconciliation before writing rather than silently dropping its usage text.
- For non-standard syntax rules, describe the contributing extension and its custom scope or visible annotation. For mixed-scope rules, distinguish extension-specific scope usage from the ordinary scopes that also use the rule.

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

Add `scripts/lib/token-formats.js` to validate and normalize the new structures. It supplies consistent category ordering, canonical ID construction, nested record traversal, categorized syntax rule ordering, and diagnostics for templates, lookups, source tokens, and source details.

Normalize UI and semantic inputs to the compiler's existing canonical IDs before alias collection, details validation, and rendering. Strip category wrappers, UI grouping objects, and semantic `default` markers from emitted IDs. Keep aliases such as `ui.activityBar.foreground`, `semantic.function`, and `syntax.parameter` stable, along with relationship references in details.

Normalize syntax tokens from the four category `rules` arrays to the existing compiler array, sorting by explicit `order`; flatten categorized syntax lookup/detail entries to the existing ID map. Categories add no prefix to syntax IDs, aliases, or emitted TextMate scopes.

Recognize records using the schema for the relevant file, including formatting-only or disabled entries without a color. A node can hold record fields and descendants; traverse both. Reject unknown scalar fields, invalid child structures, duplicate normalized IDs, and reserved-field collisions with diagnostics containing the authored path and canonical ID.

### Source category validation

Add `scripts/lib/token-category-validation.js`, using the shared format codec, and invoke it before compilation or any build writes. Keep `docs/templates/tokens/ui-template.jsonc` as the canonical UI template filename. The semantic authority is `docs/templates/tokens/semantic-template.jsonc`.

Build category indexes from the checked-in templates and split lookups, retaining their file paths and authored token locations for diagnostics:

- A UI token in a theme's `standard` object must have an exact, case-sensitive canonical ID in the UI template's `standard` object. Merely occurring elsewhere in that template is insufficient. A lookup entry cannot make a token standard when the template does not list it there.
- Apply the same rule to semantic tokens using their exact reconstructed selectors and the semantic template's `standard` object. Exclude the authoring-only `default` marker when checking an unmodified selector.
- When a token appears anywhere in its template, its authored category must match that template category. For example, a template `deprecated` token placed in theme `standard` fails and reports `deprecated` as the expected category.
- For tokens absent from a template, consult the matching lookup for verified `source`, `non-standard`, or `deprecated` membership. This preserves the existing 29 UI and two semantic source-only entries without expanding templates implicitly. Template and lookup classification conflicts fail registry validation; lookups never override template membership.
- A UI or semantic token absent from both template and lookup can be authored only in `non-standard`, subject to the existing ID, styling, and details validation. Reject an unregistered UI or semantic token in `standard`, `source`, or `deprecated`, explaining that the claimed classification has no catalog evidence. The optional `use` field does not grant standard membership or bypass validation. Syntax follows its separate default-standard rule below.
- Check disabled tokens, formatting-only semantic entries, and both tokens in a UI parent/child node. Validate the effective source after whole-file fallback, retaining the actual originating file and the target theme being built. Check matching UI/semantic details for category agreement with their tokens too.
- Syntax files must have the four category objects and retain exact rule IDs and scope order. Validate order metadata and category agreement with their syntax lookup/details. New rules default to `standard`; require evidence for extension-specific `non-standard`, source-only, or deprecated placement. Syntax has no template allowlist, so do not reject a default-standard syntax rule because it is absent from a UI/semantic template. Base roles continue to use their own schema.
- Reject missing, malformed, duplicate, or conflicting registry inputs with the exact registry path; do not treat an unreadable template as an empty allowlist or skip validation. Load a fresh registry snapshot per build pass, with no upstream downloads.

Every category error must include the target theme, source filename, line/column when available from the syntax tree, exact canonical token ID, actual category, expected category when known, and the authority path plus a concrete failure reason. For example:

```text
prod/default: src/themes/prod/default/tokens/ui.jsonc:12:7: UI token "widget.unknownBackground" is in "standard", but docs/templates/tokens/ui-template.jsonc has no entry for this token in its "standard" object.
```

If the token exists under another category, name that category and its template/lookup path in the error. Use the established red error output, a nonzero exit status, and an actionable correction message. Report the failing ID rather than only its component object, a token count, or a generic invalid-schema message. Do not automatically move the token or change the allowlist to make validation pass.

Before enabling validation on migrated sources, audit template-absent authored IDs. If pinned evidence verifies one as standard, explicitly add its registration to the template's `standard` object and document that correction in the migration report. Preserve its theme styling and membership. Never relabel a verified standard token as non-standard merely to bypass the allowlist. This audited correction is the permitted exception to preserving the initial template inventory; do not bulk-add unverified IDs or remove entries.

Integrate the validator into `build`, `build:prod`, `build:dev`, build `--check`/`check:generated`, and source validation in `check:theme`. Preflight every selected target and the required default inputs before replacing generated files, performing stale-output cleanup, changing registrations, or syncing previews. Combined builds preflight both groups before either writes output. Palette-only builds retain their existing independence from token inputs. Make source generators validate their prepared categorized token/detail output before writing it.

Watch must use the same validator and recover after a failed pass. Watch changes to the two exact template files and the three split lookup files in addition to the existing source and registration inputs, coalescing them through the existing serialized scheduler. A catalog change can invalidate classification without a theme source save, so it must trigger a fresh validation pass. These events never run the lookup updater or trigger a reload reminder unless existing preview-registration/setup rules independently require one.

### Migration steps

Perform the migration with a repeatable, one-time utility that inventories and stages the complete selected set before writes:

1. Split the current catalog without losing any of its 1,136 entries or its provenance and license. Rename every `for` field to `description` while preserving its text. Translate UI and semantic purpose IDs into the new nesting and seed category membership from the audited inventory; seed syntax purpose records under `standard` and move verified extension-specific rules into `non-standard`.
2. Move and reshape both templates, preserving their token inventories apart from audited missing-standard corrections required by category validation. Add the four category objects and style-descriptor leaves. Record each correction with its evidence; do not remove tokens or add unverified registrations.
3. Migrate every existing local `tokens/ui.jsonc` and `tokens/semantic.jsonc` in prod/default, dev/test, dev/beta, and dev/reviewer. Discover targets through the existing discovery API rather than hardcoding those names.
4. Migrate corresponding local `details/ui.jsonc` and `details/semantic.jsonc` to matching category/path nesting. Rename `for` to `description` in every local details file, including base and syntax, without changing its text. Preserve any explicit `modified-desc` flags, non-standard `use` context, `inherits`, `overrides`, and `globallyOverriddenBy` values and their array order. Group local syntax token rules and matching details into the four categories; assign each rule its original index as `order`, preserving compilation precedence and file-level fallback.
5. Preserve JSONC comments by using syntax-tree spans and attaching comments to their original token records during reparenting. Retain disabled definitions, configured colors, alpha, reasons, formatting flags, key case, and deliberate ordering. Never reconstruct authored files solely by parsing and stringifying their values.
6. Keep omitted files omitted and local empty sections empty. Preserve independent whole-file fallback for tokens and details; do not materialize inherited files. An empty categorized input continues to suppress local definitions just as `{}` does today.
7. Inventory unknown and custom IDs and classify them explicitly rather than dropping them. Reconcile their authored categories with the new validator, including template-absent IDs that currently appear under `standard` in examples. Keep existing theme membership and styles unchanged; migration does not run `add:properties` to populate every theme from expanded catalogs.
8. Refresh both examples to the same codec and classification rules. Document the compound semantic suffix/language conventions and UI parent/child case in the examples or adjacent guide.
9. Switch all active readers and generators together. Update all field validation, required-description checks, diagnostics, examples, and fixtures to use `description`, optional boolean `modified-desc`, and optional non-standard `use` text; remove per-entry `source` support. Remove obsolete flat-format paths and `for` field support once committed sources and fixtures are migrated; no permanent dual-format guessing in the compiler. Fail a migration that encounters conflicting `for` and `description` values rather than discarding either value.

Source changes that only reparent tokens must preserve rendering order as well as values. Capture the current emitted UI/semantic order; where grouping necessarily changes object order, document and review that ordering difference while proving styling equality. Preserve syntax order exactly, since it affects precedence. No category, description, protection flag, `use` context, `order`, or authoring-only grouping field appears in generated theme JSON.

## Scripts, tests, and documentation affected

- `scripts/themes/add-properties.js`: replace the obsolete combined catalog path with the split lookups; read categorized templates; add missing entries at nested paths; keep existing review and comment-preservation behavior; fill `description` and propagate `modified-desc` and non-standard `use` context when adding details; read/update syntax rules and purposes in their category objects while preserving `order`; keep syntax ID generation and base-purpose derivation.
- `scripts/themes/add-theme.js`: scaffold categorized UI/semantic token and detail objects, populate from the renamed templates, and retain metadata copying, whole-file fallback, rollback, terminal colors, and build command guidance.
- `scripts/lib/theme-compilation.js`: normalize nested tokens/details and categorized syntax arrays before validation and emission; sort syntax rules by authoring `order` and omit it from output; validate `description`, optional boolean `modified-desc`, and optional non-standard `use` text instead of `for` or per-entry `source`; retain all color, alias, disabled-entry, and relationship contracts.
- `scripts/lib/token-category-validation.js`: index template/lookup membership and validate exact canonical IDs against their authored category, with source locations and precise reasons for mismatches.
- `scripts/lib/theme-source-inputs.js`, `scripts/themes/build.js`, and `scripts/themes/check.js`: use the shared reader wherever they inspect source shapes and run category validation in source preflight before writes. Preserve target discovery, independent fallback, selected-group cleanup, check-mode immutability, and preview registration behavior.
- `scripts/themes/watch.js`: validate nested source through the same build preflight; treat the two templates and three lookup catalogs as validation dependencies and watch their exact paths. Retry after either source or registry corrections through the serialized scheduler. Catalog-only events require validation without automatically requiring a reload; actual registration changes still use the existing conditional reminder.
- `package.json` and lockfile: add the updater command, extraction dependency where needed, and any necessary validation integration. Ordinary `npm run check` validates checked-in schemas and coverage offline; upstream refresh checking remains an explicit updater command with pinned inputs.
- `tests/test-projects.js` and existing compilation, validation, property, setup, build, workflow, and watch tests: migrate fixtures and source-path assertions, supplying category registries for isolated builds. Cover wrong-category and missing-standard membership, exact diagnostic IDs/paths, inherited and disabled tokens, registry conflicts, validation before writes, and watcher recovery after registry edits. Keep tests that verify behavior rather than reproducing the nesting implementation.
- `README.md`, `docs/guides/token-details.md`, and `docs/guides/development-guide.md`: document the file tree, categories, nested authoring, `description` and `modified-desc` refresh protection, non-standard `use` context, category validation failures and corrections, updater flags/source prerequisites, template-versus-lookup responsibilities, and generator workflow.
- `docs/guides/workbench-color-audit.md`: update active provenance instructions and links to the new catalogs. Preserve historical audit claims with their pinned versions.
- `CHANGELOG.md`: record the completed format/catalog migration during implementation. Plans and historical changelog entries remain historical; repair broken links when relocating active resources without rewriting past behavior.
- Search the whole repository for retired catalog/template paths, former names, and flat-format instructions. Update active prose, code, fixture paths, editor configuration, and any packaging/workflow references found. Verify `hex-opacity.md` links still target `docs/lookups/hex-opacity.md`.

Every authored JavaScript module follows `AGENTS.md` header, declaration JSDoc, parameter documentation, and spacing requirements.

## Implementation sequence

- [ ] Capture canonical token, purpose, alias, scope-order, and generated-output inventories for every current theme; record the template/catalog membership differences.
- [ ] Implement the shared format codec and detail `description`/`modified-desc`/`use` validation; cover ambiguous UI nodes, selectors, syntax categories/order metadata, and duplicate IDs.
- [ ] Implement template/lookup category validation with exact source diagnostics; integrate selected-target preflight and template/lookup watch events before migrating sources.
- [ ] Implement pinned description extraction and the lookup updater, using fixture snapshots for reproducible behavior checks.
- [ ] Prepare categorized templates and split lookup candidates, including description refresh protection and a classification report.
- [ ] Update compiler, catalog readers, generators, and their fixtures; migrate all local source and detail files in the same integrated change.
- [ ] Refresh examples, active documentation, commands, and path references; retain reviewed provenance and required license notices.
- [ ] Compare normalized inventories and generated themes against the baseline; investigate every missing ID, changed configured style, or changed syntax order.
- [ ] Run the relevant focused tests, then `npm run check`; verify a build and preview sync in an isolated extension destination.
- [ ] Commit the completed implementation, generated changes where applicable, and completion documentation using the repository's commit style.

## Acceptance checks

1. All requested destination files exist and active consumers use their new paths; the old combined catalog and old templates have been removed after successful migration.
2. UI, semantic, and syntax files use the four category objects. Syntax defaults to `standard`, with extension-specific rules under `non-standard`; syntax token categories hold `rules` arrays with unique order values, and syntax lookup/detail categories hold exact ID maps. No canonical token is duplicated or silently omitted, including the 29 UI and two semantic source-only entries.
3. Every theme retains its authored token membership, configured styling, reasons, flags, IDs, and independent fallback behavior. Syntax rule and scope order are identical. Normalized aliases and relationship strings remain stable.
4. UI parent/child tokens both survive; unmodified and compound wildcard semantic selectors and language-qualified selectors reconstruct exactly; `*.deprecated` is not misclassified as a retired selector.
   Any UI or semantic token placed in `standard` without an exact matching entry in its family's template `standard` object fails the build with its canonical ID, actual category, authority path, and reason. Known IDs in the wrong category fail too; syntax uses lookup/evidence-based validation rather than the UI/semantic template allowlist. Validate disabled, inherited, and compound-selector cases before any output, cleanup, manifest, or preview mutation. Registry edits trigger watcher validation and a corrected registry/source edit recovers normally.
5. All lookup and authored detail records use `description` instead of `for`, with no per-entry `source` field. The lookup updater preserves descriptions with `modified-desc: true`; absent or false flags permit extracted refresh. Nonboolean flags, empty protected descriptions, conflicts, incomplete extraction, missing pins, and malformed inputs produce accurate diagnostics and leave files intact on fatal errors.
6. Extraction and merge behavior is covered with local fixture sources: registration strings/localization forms, stable/main precedence, protected descriptions, false/absent flag refresh, preservation and validation of non-standard `use` text independently of description refresh, context propagation to new detail records, context/category conflicts, exclusion of usage metadata from styling/output, unknown IDs, and failure-before-write behavior. Routine tests do not require network access.
7. Repeated updater and generator runs are idempotent. Updater `--check` and build check modes make no writes. Catalog refreshes never manufacture a reload requirement.
8. Generated themes have the same active styling and disabled definitions as the baseline, with exact syntax ordering across category boundaries. Test interleaved standard/extension rules, category moves with stable `order`, mixed-scope rules, duplicate/missing/invalid order values, and exclusion of order metadata from emitted rules. Any harmless UI/semantic serialization-order changes are reviewed explicitly rather than hidden by a broad snapshot update.
9. Relevant focused tests and the aggregate checks pass, examples match the live authoring schema, documentation links resolve, and all completed changes are committed.

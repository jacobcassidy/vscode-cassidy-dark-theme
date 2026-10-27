# Consolidate theme authoring, shared token data, and tooling

Status: planned. This is the consolidated implementation specification for [refactor-2-plan.md](archive/refactor-2-plan.md) and [token-catalog-and-nested-sources-plan.md](archive/token-catalog-and-nested-sources-plan.md). Original differences are resolved in favor of `refactor-2-plan.md`; subsequent naming revisions recorded here supersede both predecessors. Both predecessor files are archived historical inputs; implement the destinations and contracts in this document directly.

## Scope and retained behavior

Keep the current prod/dev target directories, theme styling, JavaScript ES modules, command names, and release behavior. Group each theme's definitions and details by token family; move shared authoring/validation data into `src/token-data/`; move preview assets to `preview/`; rename palette configuration to `palette/config.jsonc`; separate command wrappers from reusable tooling; adopt categorized nested tokens; and add latest-version description updates with recorded upstream revisions and category validation.

Theme definitions and their effective palette supply styling. Shared definitions provide token inventory, category membership, and generator placeholders; shared details provide reusable documentation. Generators optionally copy those inputs into authored files. Builds consult shared classification data without copying shared styling or descriptions into themes.

The historical catalog inventory is 1,031 UI entries, 59 semantic entries, and 46 syntax entries, totaling 1,136. The UI and semantic starter inventories contain 1,002 and 65 entries respectively. The default theme has 29 UI IDs and two semantic selectors absent from those starter inventories; eight starter semantic selectors are absent from that theme. Recompute these inventories at implementation start and record differences rather than relying on these counts as permanent constants.

Preserve every authored token, configured color, alpha, reason, enabled state, formatting flag, alias, syntax ID, scope expression, reviewed relationship, comment, and independently inherited file. Correct classifications using evidence without changing appearance or populating existing themes with missing starter entries.

## Authoritative layout and path migration

```text
src/
  token-data/
    README.md
    upstream-sources.jsonc
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
        config.jsonc
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
    schemas/
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
    development-guide.md
  references/
    examples/
  plans/

themes/
preview/
  themes/
  snapshots/
images/
```

| Current input or responsibility                                         | Final destination                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------- |
| `docs/templates/all-ui-tokens.json`                                     | `src/token-data/ui/definitions.jsonc`                 |
| `docs/templates/all-semantic-tokens.json`                               | `src/token-data/semantic/definitions.jsonc`           |
| UI section of `docs/lookups/token-details.jsonc`                        | `src/token-data/ui/details.jsonc`                     |
| Semantic section of that catalog                                        | `src/token-data/semantic/details.jsonc`               |
| Syntax section of that catalog                                          | `src/token-data/syntax/details.jsonc`                 |
| Upstream extraction configuration and last successful source resolution | `src/token-data/upstream-sources.jsonc`               |
| Each theme's `tokens/<family>.jsonc`                                    | `tokens/<family>/definitions.jsonc` in the same theme |
| Each theme's `details/<family>.jsonc`                                   | `tokens/<family>/details.jsonc` in the same theme     |
| `docs/lookups/hex-opacity.md`                                           | `docs/references/hex-opacity.md`                      |
| `docs/grammar-samples/`                                                 | `samples/grammar/`                                    |
| Reusable implementation in command scripts and `scripts/lib/`           | The corresponding `tooling/` modules                  |
| Shared test project helpers                                             | `tests/helpers/`                                      |
| Each theme's `palette/palette-config.jsonc`                             | `palette/config.jsonc` in the same theme              |
| `dev-extension/`                                                        | `preview/`                                            |
| `dev-extension/themes/`                                                 | `preview/themes/`                                     |
| `dev-extension/static-snapshots/`                                       | `preview/snapshots/`                                  |

The theme families are `variables`, `ui`, `semantic`, and `syntax`; keep those family directories as the final directory level. Internal variables remain theme-owned and expose `variables.*` aliases. Shared syntax data remains details-only: add neither shared syntax definitions nor a shared variables family.

Move inputs directly to these paths. Do not implement the predecessor's intermediate `docs/lookups/tokens/`, `docs/templates/tokens/`, `*-template.jsonc`, or split `*-details.jsonc` destinations. Remove the old combined catalog, starter files, and theme-level `details/` directories only after all active consumers have migrated. Remove `docs/templates/` and `docs/lookups/` when empty.

Keep `metadata.jsonc`, palette reports/notes, prod outputs under `themes/`, and images in their current locations. Every target requires an explicit `palette/config.jsonc`, retaining the current palette settings and `useDefaultPalette` behavior. Preview-generated themes live under `preview/themes/` and preserved snapshots under `preview/snapshots/`. The preview extension manifest continues to be generated directly in the installed extension directory, normally `~/.vscode/extensions/jacobcassidy.cassidy-dark-dev/package.json`, with an injectable destination for tests. Adapt the root production manifest there and link checkout assets as today; do not create a manifest in the checkout's `preview/` directory. Definitions and details independently use existing whole-file prod-default fallback. Creating a family directory never materializes omitted files or changes fallback to apply to the whole family. Explicit empty inputs retain their existing suppression semantics after conversion to the applicable new schema.

Update preview output discovery, manifest contribution paths, asset links, watcher subscriptions, cleanup ownership checks, packaging/ignore rules, tests, and docs together. Preserve snapshot bytes, generated theme filenames/notices, extension identity, theme labels, and reload-detection behavior. Repair an existing installed preview link only after verifying that it points to this checkout's former directory; unrelated real paths or links remain protected. Update the palette input-path constant and every generator, fixture, palette-only command, and documentation example to use `palette/config.jsonc`.

## Tooling boundaries and dependency direction

| Directory              | Responsibility                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tooling/palette/`     | Palette generation and report rendering.                                                                                                                     |
| `tooling/tokens/`      | Format normalization, category validation, aliases, compilation, and theme rendering.                                                                        |
| `tooling/tokens/data/` | Loading checked-in definitions/details, resolving latest upstream versions, retrieving exact source revisions, extraction, and detail refresh orchestration. |
| `tooling/themes/`      | Discovery, fallback, manifests, generated-theme validation, artifact preparation, and build/watch workflows.                                                 |
| `tooling/generators/`  | Theme scaffolding, property addition, syntax ID assignment, and JSONC source edits.                                                                          |
| `tooling/preview/`     | Preview synchronization, asset links, registrations, and reload guidance.                                                                                    |
| `tooling/shared/`      | Color math, repository paths, JSONC parsing, filesystem helpers, terminal output, and artifact staging.                                                      |

Apply these interfaces:

- Scripts parse CLI arguments, select defaults, invoke tooling, and report results/errors. Tooling never imports command wrappers, and importing a tooling module does not start a CLI or watcher. Tests import tooling directly except when exercising CLI behavior.
- Shared utilities have no dependency on theme workflows, generators, palette code, or token compilation. Palette code and token compilation import `tooling/shared/color-math.js` directly.
- Pure format handling and compilation operate on supplied inputs. The checked-in data loader may use the format codec; compilation does not reach back into the loader. Inject category indexes into validation to avoid loader/compiler cycles.
- Theme workflows orchestrate loading, validation, palette/compilation, artifact preparation, staging, and preview synchronization. Generators may reuse discovery, loading, codecs, validation, and staging without calling build CLIs or introducing a build-to-generator dependency.
- `data/load.js` loads checked-in data and exposes definitions, details, normalized category indexes, and originating paths. It does not import source retrieval, extraction, or the TypeScript parser. Load those modules only for explicit detail refresh operations.
- Load one token-data snapshot and one consistent set of effective theme inputs per pass; centralize final paths and family filenames in one injectable paths module. Avoid separate hardcoded path tables in each command.
- Retain established CLI flags and commands. Use `tooling/` singular throughout imports, documentation, npm commands, and packaging exclusions.

## Shared and theme data contracts

Remove the VS Code color-theme schema/metadata wrappers from shared definitions. Keep root content as the family data shape, with file purpose, pinned upstream provenance, review information, and required license notices in JSONC comments. Preserve the Microsoft license wherever extracted descriptions require it. Associate repository JSON Schemas through editor configuration rather than adding a `$schema` property to category-only roots.

### Shared file provenance headers

Every shared `definitions.jsonc` and `details.jsonc` begins with a JSONC comment header identifying its purpose and the upstream inputs last processed for that file. Record the stable VS Code version and exact commit, plus the supplemental main commit when consulted. Preserve required license notices within the opening comments. The final header line, after provenance and license text and before the root object, must explain how to invoke the updater from the repository root:

```jsonc
// Shared UI token definitions: inventory, categories, and generator placeholders.
// Upstream inputs last processed: VS Code <stable-version>
// Stable commit: <full-commit>
// Supplemental main commit: <full-commit>
// Updater (run from the repository root): npm run update:token-details
```

The example omits license text for brevity; required notices must remain before the final updater line. Use a purpose appropriate to each file. Preserve evidenced historical versions during migration, mark unknown revisions explicitly rather than inventing them, and identify local syntax inputs where applicable. Omit an upstream commit line when that source was not consulted. These headers describe file-level processing provenance, not a claim that every protected or unresolved description was extracted from that version.

Advance a file's provenance only after that file is successfully refreshed or explicitly verified against those inputs. A details-only refresh must not advance definition-file headers. The final updater line on definitions points to the command that refreshes descriptions and reports inventory differences; it does not imply that the command rewrites definitions. Stage refreshed headers with their file contents and successful resolution record, preserve them on failure, and make no-op runs leave content/timestamps unchanged. Keep provenance in comments rather than adding root metadata fields or prefixes to canonical IDs.

### Shared inventory and categories

Shared definitions and shared details intentionally have different inventories. Definition files control supported inventory and generator placeholders. Detail refreshes do not expand definitions, prune entries, or overwrite theme-specific documentation implicitly.

UI, semantic, and syntax definitions/details use root categories in this order: `standard`, `sourceCode`, `nonStandard`, `deprecated`. Keep empty category objects, except syntax definition categories, which each contain a `rules` array. Variables retain their existing nested role definitions and corresponding canonical-path detail map without these category wrappers.

Rename the legacy JSONC token-category keys `source` to `sourceCode` and `non-standard` to `nonStandard` in shared data, authored definitions/details, examples, schemas, and fixtures. Perform this at the category-root paths using the syntax tree; do not globally replace token ID segments, scope strings, descriptions, `upstream-sources.jsonc`, or extraction source options. Retain `modified-desc` exactly as named on shared details only. Reject old/new category collisions with their paths during migration, and accept only the new category spellings after the source/reader cutover.

| Category      | UI and semantic meaning                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `standard`    | Properties/selectors supported by the pinned published schema or standard type/modifier definitions.             |
| `sourceCode`  | Verified pinned core registrations absent from the corresponding published schema or standard definition set.    |
| `nonStandard` | Extension-owned, provider-defined, or custom entries; unverified entries remain explicitly marked for review.    |
| `deprecated`  | Explicitly retired, removed, or deprecated entries with evidence. Absence from a snapshot alone is insufficient. |

Use existing sections/examples as the classification seed, then reconcile them with pinned evidence and record corrections. Category membership belongs to the canonical token ID independently of its style or enabled state. Reject duplicate canonical IDs across categories. Syntax uses its family-specific category rules below.

Pinned evidence means the exact revisions resolved for a successful refresh, not a permanently fixed updater target. Online refreshes follow the latest stable VS Code release and current supplemental main revision; checked-in classification remains tied to the recorded inputs until an explicit refresh succeeds.

### UI nesting

Both shared and theme UI files split dotted IDs into nested objects, following `docs/references/examples/example-ui.jsonc`. For example, `actionBar.toggledBackground` becomes `standard.actionBar.toggledBackground`; the emitted ID remains `actionBar.toggledBackground`.

Shared definitions use the generator placeholder descriptor, `color: "#0ff"` with `colorReason: "UNREVIEWED: Added from a token template; choose an intentional color."`. Existing starter hex values are discovery placeholders and never replace configured theme colors during migration or builds. Authored definitions preserve their existing descriptors.

A theme definition excerpt is:

```jsonc
{
  "standard": {
    "actionBar": {
      "toggledBackground": {
        "color": "#0ff",
        "colorReason": "UNREVIEWED: Added from a token template; choose an intentional color.",
      },
    },
  },
  "sourceCode": {},
  "nonStandard": {},
  "deprecated": {},
}
```

UI details use the same category/path nesting with description/relationship records instead of styling. Support nodes that are both a record and a branch, including `testing.iconFailed` and `testing.iconFailed.retired`. Collect the parent's descriptor or description fields and continue into its children; never stop traversal solely because the node has a color or description. Detect reserved-field/child-name ambiguities with a precise diagnostic.

### Semantic nesting and exact selectors

Shared and theme semantic files use category, token type, and suffix objects, following `docs/references/examples/example-semantic.jsonc`. Detail leaves use detail records; shared definition leaves use placeholders; theme definition leaves retain configured styles.

```jsonc
{
  "standard": {
    "*": {
      "abstract": {
        "color": "#0ff",
        "colorReason": "UNREVIEWED: Added from a token template; choose an intentional color.",
      },
    },
    "parameter": {
      "default": { "color": "syntax.parameter" },
    },
  },
  "sourceCode": {},
  "nonStandard": {
    "parameter": {
      "readwrite": {
        "color": "#0ff",
        "colorReason": "UNREVIEWED: Added from a token template; choose an intentional color.",
      },
    },
  },
  "deprecated": {},
}
```

The parameter alias illustrates a theme definition; shared definitions always retain their placeholder role. Verify category evidence during migration rather than treating example membership as authoritative.

| Exact selector                 | Nested type key       | Nested suffix key    |
| ------------------------------ | --------------------- | -------------------- |
| `*.abstract`                   | `*`                   | `abstract`           |
| `parameter`                    | `parameter`           | `default`            |
| `parameter.readwrite`          | `parameter`           | `readwrite`          |
| `*.builtin.deprecated`         | `*`                   | `builtin.deprecated` |
| `variable.readonly:typescript` | `variable:typescript` | `readonly`           |
| `variable:typescript`          | `variable:typescript` | `default`            |

Keep compound modifiers in one suffix key and preserve modifier order, language qualifiers, and case when reconstructing selectors. Modifier combinations do not imply inheritance. Reserve the child key `default` for an unmodified selector; fail migration with a specific diagnostic if an actual modifier named `default` would collide. The current inventory has no known such collision.

`parameter.default` compiles to `parameter`; `*.deprecated` remains an active selector using a modifier and does not imply membership in the retired category. Audit provider-specific names such as `builtin`, `arrow`, and `readwrite` against their evidence. Preserve source-only `function.defaultLibrary` and `parameter.readwrite` when reconciling shared inventory.

### Syntax categories and global precedence

Source syntax definitions use the four category objects, each with a `rules` array. Shared and theme syntax details use the four category objects containing exact stable rule-ID maps. IDs identify rules within a theme's effective syntax file, not a global rule namespace. Shared syntax details describe the default/reference rules and provide reusable documentation without fixing every theme's classification by ID. Do not split rule IDs or TextMate scope expressions into nested paths.

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
  "sourceCode": { "rules": [] },
  "nonStandard": { "rules": [] },
  "deprecated": { "rules": [] },
}
```

- Default existing and new rules to `standard`, including conventional TextMate scopes and ordinary grammar scopes. A repository-defined ID or a common scope also emitted by a third-party grammar does not itself make a rule nonStandard.
- Use `nonStandard` for verified extension-specific scopes added or used by a particular extension. Seed the existing 46 IDs as standard, then move only verified extension-specific rules and record the evidence.
- Reserve `sourceCode` for explicitly evidenced source-only core grammar scopes. Use `deprecated` for documented retired rules/scopes; disabled styling alone is insufficient.
- A mixed rule with ordinary and extension-specific scopes remains one rule with the same ID, style, and scopes, classified as nonStandard. Its `use` text identifies which scopes need the extension. Do not split or duplicate it merely to classify scopes.
- Assign `order` from the original array index during migration. Merge category arrays and sort by `order` across that effective file's categories before compiling. Require unique nonnegative integer orders and unique declared IDs within each effective syntax definition file; reject missing, fractional, negative, and duplicate orders. Different themes may reuse IDs and order values.
- Retain existing ID requirements: every default-theme rule needs an ID; other targets retain optional IDs, validating uniqueness when declared. Do not invent aliases or details targets for unnamed nondefault rules. Required ID assignment remains an explicit generator responsibility.
- New generated rules append after the highest order unless an insertion is explicitly requested. Category/object ordering cannot change precedence. Strip `order` from emitted rules.

Preserve syntax rule and scope order exactly, including disabled rules, names, stable IDs, formatting-only rules, and background descriptors. Empty local syntax definitions have four objects with empty `rules` arrays; empty local syntax details have four empty objects. Both continue to suppress their respective whole-file fallback.

Validate each rule's category from its actual scope expressions and checked-in extension/grammar evidence. A shared detail entry with the same ID is insufficient to require category equality across themes. For example, the default theme's `string` rule may target `string.quoted` in `standard`, while an extension-preview theme's `string` rule targets the illustrative `exampleExtension.string.special` scope in `nonStandard`. Both remain valid, expose their own `syntax.string` alias, and retain independent style and order. A color-only change with unchanged scopes does not change classification.

Use reviewed scope evidence when available; do not infer extension ownership from an ID's spelling or require installed extensions/network access during builds. Unknown scopes retain the existing default-standard policy unless evidence supports another category. Keep unsupported explicit sourceCode/deprecated/extension claims visible for review rather than treating a shared ID as proof.

Reuse a shared syntax description/version basis only when the rule's actual scopes match the reference rule's intended scope coverage. Otherwise generate a scope-derived local description or an `UNREVIEWED` marker, preserving existing authored details. A theme replacing inherited scopes/category must supply matching local details when inherited details no longer agree; it does not need to rename the ID or alter the default theme. Do not add new runtime metadata fields solely to make IDs globally unique.

Test the same ID in two themes with different scopes/categories, duplicate IDs across categories within one theme, unchanged-scope color variants, mixed-scope rules, per-theme aliases/order values, and mismatched inherited details. Shared descriptions must not silently misdescribe a different scope profile.

## Detail metadata, refresh protection, and usage

Rename every existing `for` field to `description` in shared details and all theme families' details, including variables and syntax. Preserve the original text verbatim during migration. Retain `inherits`, `overrides`, and `globallyOverriddenBy` arrays and ordering, with their current validation and disabling requirements. Details do not supply styling or create new runtime precedence relationships.

```jsonc
{
  "standard": {
    "actionBar": {
      "toggledBackground": { "description": "Extracted registration description." },
    },
  },
  "sourceCode": {},
  "nonStandard": {
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

The example demonstrates shared-detail metadata shape, not a verified extension registration. Verify actual contributors before documenting usage. Theme-local details may carry the description and usage context but never the shared protection flag.

### Description protection

- Optional `modified-desc` is a boolean accepted only in `src/token-data/<family>/details.jsonc`. Exactly `true` protects the existing nonempty shared `description` from extracted replacement. An absent or false flag permits refresh; removing it or setting it false restores that behavior. Reject nonboolean flags and empty protected descriptions.
- The updater refreshes shared details only. Generators preserve existing theme-specific descriptions, version metadata, usage context, and relationships. When creating missing detail records, copy the shared description, known version metadata, and optional `use`, excluding `modified-desc` explicitly. Builds never refresh either document as a side effect.
- Preserve description text in the structural migration without automatically marking every migrated or unresolved entry protected. A preservation decision requires an explicit flag.
- Theme-local details are authored documentation, including the default theme's records. Remove `modified-desc` from every theme-local schema, generator output, and example. Reject it as an unsupported theme-detail field rather than accepting a no-op flag. Default-theme descriptions still require complete coverage without protection flags.
- Never import default-theme or dev-theme descriptions, flags, or version metadata back into shared data automatically. Shared protection is controlled exclusively by its own record; a copied theme description cannot restore a cleared shared protection flag.
- With no shared protection, extract UI/semantic descriptions from registrations and syntax descriptions from local rule/scopes and available grammar descriptions. Derive variables descriptions from local role definitions only when the generator fills missing theme details; variables have no shared detail file or protection flag.
- Do not introduce a per-entry `source` attribution property. Keep exact source revisions, license, and file review information in headers/configuration; the optional description-version fields below identify a description's history and upstream baseline. The category named `sourceCode` remains supported.

### Description version history and manual overrides

Allow these optional fields on individual shared and theme detail records, separate from styling definitions:

| Field                  | Meaning                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `descriptionAddedIn`   | The updater's stable VS Code version baseline when this description was first added to the shared data, when known. It does not identify when VS Code introduced the token.                        |
| `descriptionUpdatedIn` | The stable version baseline of the most recent successful upstream refresh that changed the description text. It does not track later manual edits.                                                |
| `descriptionBasedOn`   | The stable version baseline from which the extracted wording or its manual adaptation was derived, when known. For protected wording this identifies its upstream basis, not its last manual edit. |

Use normalized stable release strings such as `1.143.1`. These values identify the updater's resolved stable baseline, including runs that use supplemental main evidence; they do not claim that main-only wording shipped in that stable release. Exact stable/main commits remain in the file headers and successful source resolution record. Omit fields whose history or upstream basis is unknown. New purely local or unresolved descriptions receive no version stamps; preserve known historical metadata when an existing description cannot be re-extracted. Never infer per-description dates/versions from an aggregate file header or stamp migrated descriptions as newly added by the migration.

- When adding a new successfully extracted description, set `descriptionAddedIn` and `descriptionBasedOn` to the run's stable version; omit `descriptionUpdatedIn`.
- Preserve an established `descriptionAddedIn`. When a later extraction changes unprotected description text, set `descriptionUpdatedIn` and `descriptionBasedOn` to that run's stable version. If addition history is unknown, leave `descriptionAddedIn` absent rather than backfilling it with the update version.
- Always omit `descriptionUpdatedIn` when its version equals `descriptionAddedIn`, including after a same-version text change. Prepared migration, updater, and generator candidates remove that redundant field. Git history and recorded commits retain the distinction between changes within one stable version.
- Checking unchanged text, changing classification/usage/protection, or processing newer upstream inputs alone does not advance the text-history fields. An extraction that establishes a previously unknown upstream basis may fill `descriptionBasedOn` without inventing addition or update history; otherwise preserve known metadata when text is unchanged.
- In shared details, `modified-desc: true` preserves the wording and all known description-version values, subject only to omitting redundant equal-version `descriptionUpdatedIn`. Manual edits retain a known `descriptionBasedOn` when they adapt that wording; omit it when the replacement has no established upstream basis. Do not automatically stamp manual edits with the latest VS Code version. Git records manual edit history.
- Removing shared protection permits upstream replacement again. If extraction changes the text, apply the normal update rules and refresh its known upstream basis. Merely removing the flag does not change version metadata.
- Theme generators copy known history/basis only with the description they copy, preserving existing theme-specific wording and metadata without copying shared protection flags. Theme-local manual edits retain a known upstream basis only when they adapt that wording, without requiring a protection flag. Shared refreshes never import these records or their metadata back into shared data.

For example, this protected shared record was added using one baseline, later refreshed using another, and subsequently adapted manually:

```jsonc
{
  "description": "Manually reviewed wording based on the upstream description.",
  "modified-desc": true,
  "descriptionAddedIn": "1.142.0",
  "descriptionUpdatedIn": "1.143.1",
  "descriptionBasedOn": "1.143.1",
}
```

If its addition and latest upstream text update had both used `1.143.1`, omit `descriptionUpdatedIn`. Validate field types/version syntax; when both history fields are known, reject an update version earlier than the addition version and omit equality during candidate normalization. These fields affect documentation history only; they grant no category membership and never appear in compiled theme JSON.

### Optional nonStandard usage context

- Optional `use` is a nonempty string on individual nonStandard UI, semantic, or syntax detail records. Allow it on nonStandard shared UI/semantic definition leaves as generator documentation metadata. It does not belong on the category container or in theme styling descriptors.
- Describe verified extension display name/ID, language/provider, and the relevant visible object or state. For example, `When Example Blame (example.blame) is installed and its inline blame annotation is visible beside an editor line.` This extension identity is illustrative.
- `description` states purpose; `use` documents activation/display conditions. Installed extensions do not necessarily have their relevant UI or semantic provider active. For mixed syntax rules, identify the extension-specific scopes separately from ordinary ones.
- Omit unknown usage context. Reject empty/whitespace strings, arrays, and other nonstrings. Preserve authored context regardless of `modified-desc`; that flag protects only descriptions. Fill missing context from extraction only when evidence establishes it.
- Creating a detail record copies usage from shared details, or shared definitions if details have none. Preserve existing theme context and report conflicting shared values rather than silently replacing them.
- Applying an approved reclassification that would move `use` outside nonStandard requires reconciliation before category writes. A proposed category change alone does not block a description refresh; keep the accepted category and usage context until review. Transfer shared-definition usage into generated details, excluding it from theme styling and emitted JSON.

No category, `description`, `modified-desc`, description-version field, `use`, authoring `order`, or grouping object is emitted into a VS Code theme. Existing `colorReason`, `disabledReason`, aliases, and formatting retain their current roles.

## Format codec, schemas, and editor support

Use `tooling/tokens/formats.js` as the shared codec for definition/detail traversal, category order, canonical IDs, selector encoding, syntax ordering, and diagnostics. Normalize nested definitions/details into the existing compiler maps/arrays before collecting aliases, validating relationships, or rendering output. Preserve `ui.<canonical-id>`, `semantic.<exact-selector>`, `syntax.<id>`, and `variables.<path>` aliases; category names and semantic `default` never become alias components.

Recognize schema-specific records, including disabled/formatting-only definitions without colors, and continue traversing nodes that also contain children. Reject unknown scalar fields, malformed children, duplicate JSONC keys, duplicate normalized IDs, and reserved-field collisions. Keep the originating file and syntax-tree location alongside each normalized record.

Add local JSON Schemas under `tooling/tokens/schemas/` and associate them with final paths through `.vscode/settings.json`. Provide appropriate schemas for shared versus authored UI/semantic definitions, syntax definitions, shared versus theme-local categorized details, variable definitions/details, and source configuration. Accept `modified-desc` only in shared detail schemas and reject it in every theme-local family. Distinguish documentation-only `use` on shared definitions from actual theme styling fields.

Schemas provide completion and immediate structural checks for categories, descriptors, `description`, `modified-desc`, optional `descriptionAddedIn`/`descriptionUpdatedIn`/`descriptionBasedOn`, `use`, and syntax `order`. Reuse the contract's category/field vocabulary and verify schema/codec agreement on meaningful accepted and rejected examples. Build-time category membership, cross-file references, duplicate IDs, description-history ordering, and global order uniqueness stay in the semantic validators; editor feedback is not a replacement for build validation.

Attach schemas using file associations so category-only roots need no extra schema/version fields. Keep all schemas local: normal editing, builds, checks, and tests require no schema download. Update active examples to the same schemas, including the UI parent/child and semantic compound/language-qualified cases. Add a syntax example if needed to document categorized arrays and `order` without creating a shared syntax definition inventory.

## Token category validation

Implement `tooling/tokens/category-validation.js` using the codec and an injected classification snapshot from `tooling/tokens/data/load.js`.

| Family    | Membership and category authority                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI        | `src/token-data/ui/definitions.jsonc`, supplemented by `src/token-data/ui/details.jsonc` for evidenced nonStandard/sourceCode/deprecated IDs absent from definitions. |
| Semantic  | `src/token-data/semantic/definitions.jsonc`, supplemented by its shared details with the same restrictions.                                                           |
| Syntax    | Each effective rule's scopes and checked-in extension/grammar evidence; shared syntax details provide reference documentation, not a global ID-to-category allowlist. |
| Variables | Existing internal-role schema, aliases, and detail association; no shared category inventory.                                                                         |

Validation rules:

1. A UI or semantic token placed in `standard` must have an exact, case-sensitive canonical ID/selector in its shared definition file's `standard` object. A shared detail record cannot make an absent definition standard. Presence under another category is insufficient.
2. A token listed in shared definitions must use that category in its theme. A shared detail entry under a conflicting category fails shared-data validation rather than overriding the definition.
3. For IDs absent from shared definitions, allow evidenced sourceCode/nonStandard/deprecated membership from shared details. Unknown UI/semantic IDs may be authored only under nonStandard, with existing ID/style/details rules. `use` does not grant standard membership.
4. Audit source-only IDs before enabling enforcement. Add a verified missing standard registration to shared definitions explicitly and record its evidence; never relabel a genuine standard token to bypass validation. This is the allowed inventory correction during migration; do not bulk-add unverified IDs or prune entries.
5. Check disabled tokens, formatting-only selectors, exact compound/language-qualified selectors, and both members of a parent/child UI node. Check categories in matching theme details against their effective definitions too.
6. Validate syntax categories from each effective rule's actual scopes and reviewed extension/grammar evidence. Check declared IDs, order values, and matching theme details within that effective theme. Standard is the default for new rules; require evidence for `nonStandard`, `sourceCode`, or `deprecated` classification. Never reject a valid theme merely because a shared/reference rule has the same ID under another category, and never check syntax scopes against a UI/semantic allowlist.
7. Resolve independent whole-file fallback before validation and report both the target and actual source file. Do not mask a category mismatch introduced by inheriting definitions or details independently.
8. Missing, malformed, duplicate, or conflicting shared inputs fail with their exact path. Do not turn an unreadable file into an empty allowlist or silently skip enforcement. Palette-only builds remain independent of token data.

Run validation in `build`, `build:prod`, `build:dev`, build check mode/`check:generated`, source validation in `check:theme`, and generators' prepared-input validation. A failure precedes output replacement, stale cleanup, manifest updates, and preview sync. Do not auto-move a token or edit an authority file to make a build succeed.

Errors include target, actual input path, syntax-tree line/column where available, exact canonical token ID, actual category, expected category when known, authority path, and a concrete failure reason. For example:

```text
prod/default: src/themes/prod/default/tokens/ui/definitions.jsonc:12:7: UI token "widget.unknownBackground" is in "standard", but src/token-data/ui/definitions.jsonc has no entry for this token in its "standard" object.
```

If an authority lists the token elsewhere, name that expected category and the relevant path. Report the exact token rather than just its component object or a count. Use red errors, a nonzero command status, and actionable correction guidance in the established action color.

## Prepare once for build and check

Expose reusable preparation through `tooling/themes/` and share its result across write/check workflows:

1. Discover selected groups/targets and snapshot their required local/default inputs. Load shared token data once and reuse the required default theme/palette across prod and dev preparation.
2. Parse, normalize, validate categories/details/aliases, generate palettes, and compile each required target once. Keep side effects out of this phase; retain the same snapshot through all preparation stages.
3. Prepare one artifact map containing formatted output text and explicitly scheduled removals, including palette reports/notes, generated themes, and prod manifest contribution edits where applicable. Resolve stale-output ownership and collisions before committing any destination.
4. Validate the complete prepared map. A combined build prepares both groups before either writes. A malformed dev input cannot leave newly written prod files behind.
5. Check mode compares that same prepared map with disk and reports missing, changed, or removable outputs. It makes no writes, creates no staging/cache folders, and never syncs previews. Do not run a second compilation merely to check freshness.
6. Write mode stages the prepared changes, applies replacements/removals, and reports accurate changed/removed paths. Retain rollback data and restore prior files on an application failure; report any restoration failure explicitly rather than claiming cross-file filesystem atomicity.
7. Successful build/watch workflows sync the preview once after writes. Compilation/preparation APIs never synchronize extensions themselves. Palette-only and check modes never sync previews.

Preserve existing cleanup boundaries: only matching script-generated notices authorize stale theme removal; unrecognized stale outputs still fail. Retain symlink protections, regular-file/direct-directory restrictions, selected-group isolation, palette mode independence, and snapshot/archive exclusions. Keep generated notices tied to existing npm commands so moving code does not break ownership detection.

Expose preparation, checking, and application as coherent interfaces instead of duplicating business rules between CLI wrappers. An explicit standalone `check:theme` invocation still validates its own inputs, but a build pass reuses its loaded/compiled results internally. Keep the existing conditional reload reminder based on registration/setup changes, not source reorganization or descriptions.

## Watch invalidation and recovery

Watch theme sources, the source manifest, `preview/snapshots/`, and the five exact shared definition/detail files at their final paths. Treat removal/recreation and file renames as dependency events. Filter `preview/themes/` and generated/temp directories to prevent rebuild loops; retain serialized, debounced scheduling.

For each shared-data edit, reload and structurally validate one snapshot, then compare its normalized classification projection: family, exact canonical ID, category in shared definitions when present, and category in shared details when present. Keep definition membership distinct from detail-only membership: moving an ID between files can change its validity even if its category name is unchanged. Ignore description/protection/usage text, description-version metadata, comments, key ordering, and generator placeholder styling in that projection.

- Classification changes invalidate the relevant category checks and rebuild through the prepared workflow where needed. Include categories supplied only by shared details, not just the two definition inventories.
- Valid description/usage/version-metadata-only changes update the data snapshot without recompiling palettes/themes, writing generated artifacts, syncing previews, or printing a reload reminder. A later explicit generator still sees the new documentation and placeholders.
- Invalid edited data still produces a precise error even if its classification projection would otherwise be unchanged. A corrected source or shared-data edit retries the failed pass; skipping unchanged classification must never hide pending dirty sources or a previous failed validation.
- Definition, palette, metadata, manifest, and snapshot events retain their appropriate build/registration behavior. Ordinary authored detail edits still undergo detail schema/reference validation; do not treat all files named `details.jsonc` as shared-description-only events.
- Keep one current snapshot per pass, queue edits arriving mid-pass, close every watcher on shutdown, and preserve recovery after malformed inputs. No watcher invokes upstream retrieval or extraction.

`upstream-sources.jsonc` affects explicit extraction, not ordinary styling/category matching. Read its tracking policy and recorded resolutions on the next updater invocation; editing it does not initiate a download or refresh. No file event independently establishes that VS Code needs a reload; keep the existing preview-registration/setup comparison.

## Description updater and latest upstream extraction

Add the command wrapper and package entry:

```json
{
  "update:token-details": "node scripts/token-data/update-token-details.js"
}
```

Delegate loading, source resolution/retrieval, extraction, and refresh to their final `tooling/tokens/data/` modules. Store tracking policy, extraction input configuration, and last successful resolved source identities in `src/token-data/upstream-sources.jsonc`. The default online updater must discover the latest published stable VS Code release on every invocation, even when an older snapshot is cached. Exclude draft/prerelease releases; latest means the stable release, not Insiders or the installed editor version. Resolve supplemental `main` to its current commit once per run, preserving stable-first extraction precedence.

Resolve the stable release through Microsoft's `microsoft/vscode` release metadata, using GitHub's [latest release endpoint](https://docs.github.com/en/rest/releases/releases#get-the-latest-release), then resolve the actual release tag to its commit. Record the stable version/tag and commit, supplemental main commit, and required extraction input identities. Fetch and extract only those exact revisions for the entire run, even if upstream advances during extraction. A failed metadata lookup or invalid release response is an error; never silently reuse the previous resolution while claiming to have checked latest.

The catalog's existing stable version `1.143.1` and supplemental main revision `1184ad4d45794110deb6b897ea83b15aac44ed89` are historical provenance, not default update targets. Preserve them on migrated records where applicable; the first successful online refresh records the newly resolved versions. Updating the recorded revisions must not change the policy away from following latest. Reproducibility comes from recording each successful run's exact inputs and retaining revision-keyed source caches.

Updater behavior:

1. Validate shared definitions/details and authored inventories. For UI and semantic tokens, refresh the union of definition IDs, existing shared detail IDs, and authored IDs. For syntax, refresh existing shared/reference records using the default/reference rule definitions; inventory other themes with their theme-qualified IDs and actual scopes instead of collapsing them by ID. Report dev-only or different-scope rules for review without merging them into shared syntax records automatically. Preserve differing inventories without expanding definitions, deleting detail entries, materializing inherited theme files, or rewriting theme-specific documentation.
2. Resolve protection and associated known version metadata from shared detail records only. Refresh unprotected shared descriptions from extracted inputs; retain shared protection flags and authored `use` context. Do not import theme-local descriptions or protection. Apply description addition/update/basis rules to successful extraction, preserving unknown history and protected metadata and omitting `descriptionUpdatedIn` whenever it equals `descriptionAddedIn`.
3. Extract UI descriptions from `registerColor` calls and contributed color definitions at the resolved revisions. Extract semantic type/modifier descriptions from registry definitions and extension contributions. Prefer the resolved latest stable registration data, then verified additions from the resolved main commit absent from stable. Report newly discovered registrations and inventory/category differences for review; retain the existing rule that description refresh does not silently expand shared definitions or populate themes.
4. Use a TypeScript AST parser for supported static registrations, localization string/message forms, and referenced/imported static constants. Add an explicit development dependency and lockfile change if needed. Read manifests as data, report unresolved dynamic expressions, and never execute upstream code to extract descriptions.
5. Derive semantic combination descriptions from the extracted type/modifier definitions without inventing provider behavior. Extract default/reference syntax names, ordered scopes, descriptive comments, and available grammar descriptions; preserve protected shared syntax wording. A different theme's same-named rule cannot replace that reference description or category. Derive internal-variable purposes locally through the authoring generator without introducing shared variable data.
6. For unresolved existing IDs, retain reviewed text and report missing evidence. For unresolved new IDs, add a nonempty `UNREVIEWED` description and warn. Never convert an extraction failure into fabricated reviewed text or automatically set `modified-desc: true`.
7. Report evidenced category changes for review while retaining accepted categories in every prepared detail record. Preserve relationships where present, protected descriptions, flags, usage, provenance, and licenses. Do not infer retirement from absence. Proposed category changes do not block otherwise valid description refreshes; malformed or conflicting already-accepted data remains a fatal validation error.
8. Format and validate all three shared detail candidates, their explicit provenance headers ending with the updater command, and the updated `upstream-sources.jsonc` resolution record before applying replacements. Stage them as one set with rollback on application failure, advancing the last successful resolution only when the entire refresh succeeds. Write changed files only and leave unrelated themes/definitions and their headers untouched. Repeated identical input leaves content and timestamps unchanged; review dates change only when the recorded source/review inputs actually change. Do not write a new wall-clock timestamp solely because another latest-version check ran.
9. Report counts and changed paths using existing terminal colors: yellow headings, blue information/paths, green additions/success, bright yellow warnings, red errors, magenta actions/important notices, and default text for uncategorized output. Refreshing shared details does not itself require a reload.

### Category change reports and review

Use a report-and-review workflow for classification changes discovered upstream. `update:token-details` refreshes eligible descriptions and known description-version metadata while preserving checked-in categories, definition inventories, and all theme files. It never moves a token between category objects, adds a newly discovered upstream token to definitions, or applies a proposed classification as a side effect of extraction.

For each proposal, print the family, exact canonical ID, current accepted category or absence, proposed category, evidence/reason, resolved upstream version and commit, and affected shared/theme file paths. For syntax, include the theme and actual scopes so same-named rules with different coverage remain distinct; identify affected files by scope evidence rather than ID alone. Include tokens present only in shared details, inherited theme inputs, and any usage context requiring reconciliation. Distinguish an upstream proposal from a validation failure in already-accepted data. Report newly discovered registrations without inventing an accepted category record or inserting them merely to make a proposal persist.

A pending proposal is informational and does not fail an otherwise successful refresh. Updater `--check` reports the same proposals but fails only for actual checked-in refresh drift, invalid inputs, or other existing fatal conditions; a proposal by itself neither changes files nor forces a nonzero exit. File processing provenance may advance with a successful description refresh, but this does not claim that the proposed classification has been accepted.

Apply an approved change through a separate reviewed edit or migration:

1. Confirm the upstream evidence and affected IDs, including whether shared definitions need an explicit inventory addition.
2. Update shared definitions where applicable, shared detail placement, and affected theme definitions/details together. Preserve configured styles, comments, description protection, version metadata, aliases, and syntax order. Resolve `use` context if its destination category no longer allows it.
3. Validate the full prepared edit set before writes, then run category validation, focused regression checks, and generated-output checks. Commit the reviewed category changes together; do not leave a checkpoint with conflicting accepted authorities.

Do not introduce automatic category application into the description updater. Test an upstream `sourceCode`-to-`standard` proposal and a `nonStandard` proposal involving `use`: descriptions may refresh, accepted object placement and theme files remain unchanged, and builds still validate against the accepted classification. Also test report contents, proposal-only check success, and continued failure for an actual existing category conflict.

### Retrieval and modes

- Default online update resolves latest stable and current main first, then uses the ignored `.cache/token-details/` keyed by exact commits, fetching missing source snapshots only. Cache presence never skips latest-version discovery. Report old/new source versions and whether extraction inputs were cached or downloaded.
- Accept `--vscode-source <path>` and `--vscode-main-source <path>` to supply source contents instead of downloading them. On a default online run, validate these checkouts against the newly resolved revisions; a stale checkout cannot silently override latest selection. Support repeatable `--extension-source <path>` inputs for provider/extension descriptions absent from core, recording their identity/revision in extraction provenance; do not infer an extension's identity from an unverified token name.
- `--offline` forbids all network access, including version discovery, and replays the last successful recorded revisions using cache or matching supplied checkouts. Clearly report replay mode and that latest was not checked. Missing resolution records or sources produce actionable errors directing the user to run an online update.
- `--check` replays the last successful recorded revisions, prepares refreshed details in memory, and reports drift without network access or writes to details, configuration, or cache. It requires an existing resolution record and cache or matching supplied checkouts, and explicitly does not verify whether a newer upstream release exists. Combining it with `--offline` retains that same replay behavior. Ordinary aggregate checks validate checked-in structures/coverage without requiring upstream configuration, cache, or TypeScript source snapshots.
- Version discovery, revision validation, retrieval, parse, formatting, and unresolved-override conflicts are fatal before destination writes. Keep checked-in details and the last successful resolution unchanged on failure; downloaded cache entries do not count as a completed refresh. Unknown individual registrations follow the explicit review-warning behavior above.
- Ordinary builds, checks, generators, and tests do not fetch sources. Extraction tests use small local fixtures. Parser dependencies are absent from the normal build import path.

## Authoring generators and file migration

Move reusable `add:theme`/`add:properties` implementation into `tooling/generators/` while retaining their command wrappers and flags. Use the same codecs, current shared snapshot, category validation, and final family paths as the compiler.

`add:theme` copies default metadata and preview naming as today, creates categorized UI/semantic definitions and applicable details, and uses the shared placeholder inventory. It preserves minimal scaffolding, optional whole-file inheritance, existing file-reservation/rollback protections, terminal colors, descriptive path output, and both group-specific/all-build guidance.

`add:properties` adds missing inventory entries at nested paths without changing existing styles, disabled states, comments, or reviewed details. It fills missing descriptions, propagates known description-version metadata and `use` where appropriate without copying `modified-desc`, assigns required missing syntax IDs, and derives variable/syntax purposes through their existing responsibilities. Preserve explicit target lists and the configurable default allowlist. Validate and format every selected candidate before writing any theme input, omit redundant equal-version `descriptionUpdatedIn`, and keep unchanged runs idempotent.

Use a repeatable one-time migration utility with these guarantees:

- Inventory all discovered prod/dev targets, all local and inherited files, normalized tokens/details, template-only/source-only IDs, and current emitted outputs before mutation. Do not hardcode the current default/test/beta/reviewer names or force local copies of inherited files.
- Move theme inputs into their final family paths while retaining independent definitions/details fallback. Preserve local empty files using the new applicable shape, including categorized empty syntax arrays. Preserve internal variables' current nested role structure and `variables.*` aliases.
- Rename every local palette config to `palette/config.jsonc` while preserving its contents and explicit-per-target requirement. Move preview assets to `preview/` and static snapshots to `preview/snapshots/` with snapshot bytes intact; update registrations, asset links, fixtures, cleanup paths, and watcher filters in the same checkpoint.
- Rename token category roots from `source`/`non-standard` to `sourceCode`/`nonStandard` using JSONC syntax-tree paths, preserving attached comments. Update readers, schemas, examples, and fixtures together; reject collisions and legacy spellings after cutover without altering actual token IDs or extraction configuration.
- Split shared details directly into final family paths, retaining every record, description, provenance header, and required license. Reshape shared definitions directly at their final paths, with only audited missing-standard corrections to inventory.
- Reparent UI/semantic definitions and matching details using syntax-tree spans so comments stay attached to their records. Do not rebuild authored JSONC solely through parse/stringify. Preserve scope expressions, ordinary comment blocks, deliberate token order, and disabled definitions.
- Rename `for` to `description` in every detail family, preserving text and relationships. Fail if conflicting old/new values would otherwise be discarded; collapse identical duplicates explicitly. Remove legacy field support and proposed generic per-entry source attribution after all sources/fixtures have migrated.
- Remove any theme-local `modified-desc` field during migration while preserving its description, known version metadata, usage, and relationships. Retain shared protection flags; do not transfer a removed theme flag into shared data. Update examples and fixture schemas to enforce the shared-only boundary.
- Preserve any evidenced description-version metadata, omit redundant equal-version `descriptionUpdatedIn`, and leave unknown per-description history absent. Do not derive addition/update versions from the migration run, file header, or a manual wording change.
- Group syntax rules/details with standard as default and verified extension-specific rules as nonStandard. Preserve mixed-scope rules and IDs, assign the original array index as `order`, and verify exact compiled precedence.
- Reconcile categories against final shared definitions/details before enabling the validator. Do not run property addition as part of conversion or insert every missing starter entry into existing themes.
- Refresh active UI/semantic examples and syntax-order documentation with the same codec. Retain omitted files, comments, aliases, colors/reasons, flags, relationships, and source membership.
- Prepare and validate the entire selected migration set before replacements; support retry/no-op after a completed migration and restoration after application failures. After each stage's readers and fixtures have migrated, remove obsolete paths rather than retaining permanent dual-format guessing.

## Grammar samples, documentation, and packaging

### Grammar samples

Move `docs/grammar-samples/` as one set to `samples/grammar/`. Describe them as language samples for inspecting highlighting. Keep `tsconfig.json` beside TS, TSX, and JavaScript samples so editor discovery and sibling imports continue to work. Preserve language probes and comments while updating embedded paths and optional validation commands, including the Python example path.

Keep usage instructions in the consolidated development guide and automated test inputs in `tests/fixtures/`. Grammar samples require no execution, and optional language-toolchain checks remain outside `npm run check`. Update README links, guide tables/commands, `.prettierignore`'s Svelte entry, editor/formatter/linter rules, and source comments using the old sample location.

### Documentation consolidation

Make `docs/guides/development-guide.md` the only guide under `docs/guides/`, rewritten around development tasks and the completed refactor implementation. Publish the consolidated guide alongside the implemented paths, formats, and updater so its instructions describe working behavior. This subsection supersedes predecessor instructions to maintain separate token, color-system, or workbench-audit guides.

| Existing guide             | Content to retain or remove                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `development-guide.md`     | Retain setup, previewing, builds, tests, packaging, publication, and recovery. Remove duplicated explanations, exhaustive module/function inventories, and line-by-line pipeline narration.                                                 |
| `token-details.md`         | Integrate aliases, alpha replacement, formatting, disabled entries, detail fields, and relationship semantics. Rewrite all examples for the final family paths and schemas.                                                                 |
| `color-system-proposal.md` | Retain implemented palette configuration, tone generation, gamut handling, overrides, and report interpretation. Remove proposal language, historical comparisons, candidate palettes/measurements, obsolete templates, and adoption steps. |
| `workbench-color-audit.md` | Retain concise registration-evidence and classification principles. Remove dated counts, missing-token inventories, deprecation tables, token-specific findings, audit results, and reproduction history.                                   |

Use a simple linked table of contents and these eight sections:

1. **Quick start and preview.** Prerequisites, `npm ci`, initial build, preview selection, watch mode, and when VS Code needs reloading.
2. **Project structure and ownership.** One compact directory map distinguishing authored inputs, shared token data, tooling, generated outputs, preview assets, samples, and preserved references. Explain independent per-file fallback and explicit empty inputs.
3. **Editing palettes.** Palette selection, family anchors, optional base chroma, numbered tones, muted variants, neutrals, gamut limits, overrides, and `colorReason`. Explain generated reports and checking actual foreground/background pairs without historical measurement tables.
4. **Editing tokens and details.** Family-based definitions/details, categories, aliases, exact semantic selectors, syntax IDs/order, alpha replacement, formatting, disabled entries, and relationship fields. Use small examples and link to complete maintained examples.
5. **Creating themes and maintaining shared token data.** Explain `add:theme`, `add:properties`, and `update:token-details` separately. Cover placeholders, classification failures, latest-stable/main resolution, `upstream-sources.jsonc`, provenance headers with the final updater-command line, offline/check replay, and description-version metadata. Explain report-and-review category changes, shared-only `modified-desc`, and locally authored theme documentation.
6. **Validation, tests, and troubleshooting.** One command reference, generated-output checks, safe stale-output cleanup, watcher recovery, and focused test execution. Include short error-to-action guidance for invalid categories, unresolved aliases, stale outputs, preview setup, and unavailable updater sources.
7. **Visual inspection.** Use `samples/grammar/`, token/scope inspection, and preview snapshots. Replace the exhaustive language-feature catalog with compact sample links and essential configuration/provider requirements; sample execution and optional language-toolchain checks remain separate from ordinary project checks.
8. **Packaging, releases, and recovery.** Keep a compact runbook for local VSIX packaging, version/changelog preparation, required publication configuration, submitting remote `main`, publication order, retained artifacts, and GitHub-only recovery. Link to release scripts/YAML for implementation details instead of narrating every pipeline step.

Verify retained statements against the implementation and this specification rather than treating old proposals as established behavior. For example, do not copy a proposed yellow anchor or candidate contrast measurement as a claim about the current palette. Distinguish palette primitives, internal variables, VS Code semantic tokens, and TextMate rules. Retain the principles that matching colors do not prove inheritance/runtime precedence, missing upstream evidence does not establish deprecation, and registrations can depend on a surface, extension, or active provider. Describe current measurements through generated reports rather than preserving historical numbers as current findings.

After useful content has been transferred, delete `token-details.md`, `color-system-proposal.md`, and `workbench-color-audit.md`; do not create replacement archives. Git preserves their historical versions. Remove obsolete brace-wrapped token references, embedded detail objects, `for` fields, old category spellings, retired paths, fixed audit totals, and completed migration instructions. Keep necessary authoring contracts in the guide and implementation-level function contracts in code documentation.

Repair incoming links and anchors in README, source headers, palette references, and relevant archived documents. Preserve historical claims without presenting them as current behavior. Keep historical palette/reference artifacts outside `guides/`; move `hex-opacity.md` directly to `docs/references/hex-opacity.md`, and retain maintained examples under `docs/references/examples/`. Keep `src/token-data/README.md` as a brief ownership/provenance index linking to the appropriate development-guide sections, without duplicating the workflows or data contracts.

For consolidation verification, require working local links and heading anchors, maintained examples validated against implemented schemas/codecs, and commands checked against npm scripts and release helpers. Clearly identify partial excerpts. Confirm that essential authoring, preview, updater, packaging, and recovery instructions survived and that only `development-guide.md` remains directly under `docs/guides/`. Run Markdown linting and formatting checks, and commit the consolidation with its link repairs. Do not invoke live publication as verification or change runtime behavior as part of documentation cleanup.

### Packaging and remaining consumers

Audit imports, npm scripts, test discovery, CI/release workflows, generated notices, editor settings, hooks, caches, and packaging consumers. Preserve release behavior, snapshot contents, and historical plans/changelog claims while applying the explicit preview path migrations. Repair historical links if a moved active target would break them without rewriting historical behavior.

Exclude `tooling/`, `samples/`, and `preview/` from the VSIX explicitly, replacing the former development-extension directory exclusion and preserving current exclusions for src/tests/docs/scripts and developer configuration. Update any moved generated-asset ignore paths and ignore the upstream cache. Add a meaningful package-content check that verifies required distributable assets and absence of development inputs; inspect the packaged file list in the final stage. Do not run live publication as verification.

Update `CHANGELOG.md` and active documentation when implementation is complete. This planning task itself changes no runtime code, theme sources, commands, or generated assets. Every authored JavaScript module, including scripts, fixtures, configuration, and samples, follows `AGENTS.md` documentation and spacing requirements.

## Staged implementation and verification gates

Each stage must end with relevant passing checks and a commit using the repository's existing sentence-case imperative style. Keep integrated schema/source cutovers in one coherent stage; a committed checkpoint must build rather than requiring later repairs. Record completion and evidence in this checklist. Run the final aggregate suite once integrated, broadening/repeating tests only when subsequent changes or failures justify it.

| Stage                               | Work                                                                                                                                                                                                                                                                | Gate before committing                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Baseline                         | Capture canonical token/detail/alias inventories, fallback ownership, scope/rule order, generated files, snapshot bytes, and current shared/authored membership differences.                                                                                        | Establish the current check results and reproducible output baseline; distinguish existing failures before migration.                                                                                                                                                                                  |
| 2. Tooling and artifact preparation | Move reusable implementation into final tooling boundaries, thin CLI wrappers, centralize paths, and introduce the prepare-once artifact interface without changing source formats.                                                                                 | Focused CLI/build/check/preview tests; combined-build failure before writes; unchanged outputs and no script imports from tooling.                                                                                                                                                                     |
| 3. Theme and preview paths          | Move local definitions/details into final family paths, rename palette configs to `palette/config.jsonc`, and move preview themes/snapshots to their final paths. Preserve old token data shapes temporarily and update readers/generators/fixtures/links together. | Independent fallback, omitted/empty files, explicit palette inputs, stable aliases/styling, preserved snapshot bytes, correct preview manifest paths, and safe checkout-owned link repair.                                                                                                             |
| 4. Shared formats and validation    | Move shared data directly to final paths; implement codec/schemas, categories, detail fields, syntax ordering, and source category validation; migrate sources/examples and all affected readers and generator writers together.                                    | Schema/codec agreement, inventory/text/comment preservation, generator compatibility with the new format, exact source errors, no missing/duplicate IDs, and normalized output/precedence comparison.                                                                                                  |
| 5. Extraction and generators        | Implement latest-stable/main resolution, revision-keyed retrieval, extraction/updater, recorded successful inputs, protection/context merging, and final generator behavior.                                                                                        | Fixture-based release advancement despite an old cache, stable-versus-prerelease selection, fixed per-run revisions, lookup/retrieval failures, atomic resolution/detail updates, offline/check replay, protection/conflicts, and unchanged reruns.                                                    |
| 6. Watch dependency handling        | Watch final shared-data paths; compare classification projections and preserve serial scheduling/recovery.                                                                                                                                                          | Category or definition/detail membership edits revalidate; description-only changes validate without compilation/writes; malformed edits and source/registry corrections recover; registration reminders remain conditional.                                                                           |
| 7. Samples and consumers            | Move grammar samples, consolidate useful guide content into the final development guide, delete the three superseded guides, repair links, and finalize editor/formatting, test discovery, CI, and VSIX exclusions.                                                 | One development guide matching implemented contracts, working links/anchors and maintained examples, retained compact release/recovery instructions, working sample configuration/imports, meaningful package-list checks, no active stale destinations, and preserved optional sample-check behavior. |
| 8. Final integrated acceptance      | Complete active docs/changelog, record reviewed inventory/category corrections and any harmless UI/semantic output-order changes, and retire obsolete inputs.                                                                                                       | Relevant remaining focused checks, `npm run check`, repeatable build/check, isolated preview sync, and package-content inspection. Commit completed implementation and generated changes.                                                                                                              |

Migration tooling/tests themselves use local fixtures and injectable roots. Test nested discovery explicitly so moving suites cannot silently drop coverage. Move shared project builders into `tests/helpers/`, color math tests into `tests/shared/`, palette tests into `tests/palette/`, shared-data tests into `tests/tokens/data/`, and CLI/workflow tests into their responsibility directories. Keep upstream fixture snapshots in `tests/fixtures/` and avoid tests that merely mirror implementation steps.

## Acceptance criteria

1. This document's final paths are authoritative. Runtime readers, generators, updater, validators, fixtures, editor schemas, docs, and packaging use them; retired intermediate paths are not accepted as silent fallbacks.
2. Theme families use paired `definitions.jsonc`/`details.jsonc` with independent whole-file fallback, and every target explicitly supplies `palette/config.jsonc`. Shared UI/semantic data uses the family filenames, syntax shared data is details-only, and variables remain theme-owned. Token-category roots are exactly `standard`, `sourceCode`, `nonStandard`, and `deprecated`; legacy category spellings fail after cutover.
3. All canonical authored IDs/styles/aliases, description text during structural migration, comments, reviewed relationship arrays, omission/empty-file behavior, and static snapshot bytes are preserved. Any shared standard-inventory correction has recorded evidence.
4. Nested UI parent/child records, exact semantic default/compound/language-qualified selectors, disabled definitions, and formatting-only records survive normalization. No authoring metadata appears in emitted themes.
5. Syntax defaults to standard with verified extension-specific rules in nonStandard; mixed-scope rules retain IDs/scopes. IDs and order values are unique within each effective theme file, with valid reuse across themes. Categories derive from actual scopes/evidence rather than a shared ID alone; description reuse requires matching scope coverage. Order metadata preserves exact rule/scope precedence across categories, with no missing, fractional, negative, or duplicate orders. Cross-theme same-ID variants, inherited-detail mismatches, and theme-local alias resolution are covered by regression tests.
6. UI/semantic standard membership is enforced against the exact family's shared definitions. Wrong placement, absent membership, malformed authorities, inherited category conflicts, and duplicate IDs fail before output/cleanup/manifest/preview mutation, naming the exact token, input location, expected/actual categories, authority, and reason.
7. Detail records use `description`, optional description history/basis fields, and optional nonStandard `use`, without a generic per-entry source field. Only shared details accept optional boolean `modified-desc`; theme-local details reject it and preserve authored descriptions without a flag. Extraction preserves protected shared text, its known version metadata, and independent usage context; false/absent shared protection permits extracted refresh. Generators exclude the shared flag, and shared refreshes never import theme-local overrides. Invalid values and conflicting shared context/metadata fail accurately.
8. Shared data loads locally once per pass; source discovery/retrieval/parser machinery is confined to explicit updater operations. Default online refreshes discover the latest stable release and current supplemental main revision on every run, recording exact successful inputs in `src/token-data/upstream-sources.jsonc`. Old caches never freeze the update target; failures never silently fall back or advance successful provenance. Offline/check modes replay recorded inputs without claiming latest verification; check makes no network requests or writes. Clean checkout builds/checks/tests and editor schemas need neither network nor upstream configuration/cache. Test these behaviors with mocked release discovery and local source fixtures, including new release and main revisions, draft/prerelease exclusion, partial failure, protected descriptions, and no-op repeats.
9. Combined builds prepare one validated artifact map before writes; check uses the same preparation without filesystem mutation or preview sync. Generated preview themes use `preview/themes/`, snapshots use `preview/snapshots/` with bytes preserved, and registrations/asset links/watchers target those final paths. Current stale-output ownership, cleanup boundaries, symlink protections, and palette-only independence are retained; packaging excludes `preview/`.
10. Shared category or definition/detail membership changes trigger category validation; valid shared description-only changes update the snapshot without compilation/writes/sync/reload. Errors remain visible and corrected source/data edits retry through the serialized watcher.
11. Editor schema associations match actual source shapes, examples, and validator contracts. Samples exist under `samples/grammar/`, with adjacent working TS configuration, updated active links, and preserved highlighting probes.
12. Every stage has a passing checkpoint and commit; final aggregate checks, idempotence, isolated preview behavior, and VSIX contents are verified. UI/semantic serialization-order changes, if unavoidable, are explicitly reviewed while styling equality and exact syntax precedence remain required.
13. Every shared definition/detail file has a purpose/provenance comment header whose last line is `// Updater (run from the repository root): npm run update:token-details`. Headers preserve required licenses and identify evidenced source versions/commits without fabricating unknown history. Verify detail-header advancement with successful refreshes, unchanged definition headers during details-only refreshes, preservation on failure/check, and unchanged reruns. No header metadata becomes a root token field or emitted theme data.
14. Description-version tests cover first extraction, later text updates, same-version update omission, unchanged text with newer upstream inputs, unknown migrated history, unresolved/local descriptions, protected shared manual adaptations and metadata conflicts, removing shared protection, generator copying without the flag, shared-versus-theme schema validation, and no-op/check behavior. Verify that a shared refresh preserves theme-local wording and metadata, a theme copy cannot re-protect a shared entry, and theme-local flags are rejected. `descriptionUpdatedIn` is omitted whenever it equals `descriptionAddedIn`; manual edits never masquerade as upstream refreshes, and all description-version fields stay out of styling definitions, classification projections, and emitted themes.
15. Upstream classification changes produce precise proposals without automatically reparenting tokens, expanding definitions, or rewriting theme files. Valid description refreshes and proposal-only updater checks succeed while existing category conflicts still fail. Approved category edits update all affected accepted authorities/themes coherently, preserve usage/styling/order, and pass validation before their commit.
16. `docs/guides/` contains only `development-guide.md`, organized into the eight task-oriented sections above and describing the implemented refactor. Useful authoring contracts and the compact release/recovery runbook remain; superseded guides, dated audit results, obsolete system proposals, and duplicate instructions are removed. Verify incoming links/anchors, schema-valid maintained examples, command accuracy, Markdown formatting/linting, and a brief token-data README linking to the guide. Preserve historical reference artifacts and claims outside the retired guides without introducing runtime changes or invoking publication.

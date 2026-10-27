# Consolidate theme authoring, shared token data, and tooling

Status: planned. This is the consolidated implementation specification for [refactor-2-plan.md](archive/refactor-2-plan.md) and [token-catalog-and-nested-sources-plan.md](archive/token-catalog-and-nested-sources-plan.md). Original differences are resolved in favor of `refactor-2-plan.md`; subsequent naming revisions recorded here supersede both predecessors. Both predecessor files are archived historical inputs; implement the destinations and contracts in this document directly.

## Scope and retained behavior

Keep the current prod/dev target directories, theme styling, JavaScript ES modules, command names, and release behavior. Group each theme's definitions and details by token family; move shared authoring/validation data into `src/token-data/`; move preview assets to `preview/`; rename palette configuration to `palette/config.jsonc`; separate command wrappers from reusable tooling; adopt categorized nested tokens; and add pinned description extraction and category validation.

Theme definitions and their effective palette supply styling. Shared definitions provide token inventory, category membership, and generator placeholders; shared details provide reusable documentation. Generators optionally copy those inputs into authored files. Builds consult shared classification data without copying shared styling or descriptions into themes.

The historical catalog inventory is 1,031 UI entries, 59 semantic entries, and 46 syntax entries, totaling 1,136. The UI and semantic starter inventories contain 1,002 and 65 entries respectively. The default theme has 29 UI IDs and two semantic selectors absent from those starter inventories; eight starter semantic selectors are absent from that theme. Recompute these inventories at implementation start and record differences rather than relying on these counts as permanent constants.

Preserve every authored token, configured color, alpha, reason, enabled state, formatting flag, alias, syntax ID, scope expression, reviewed relationship, comment, and independently inherited file. Correct classifications using evidence without changing appearance or populating existing themes with missing starter entries.

## Authoritative layout and path migration

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
  references/
    examples/
  plans/

themes/
preview/
  package.json
  themes/
  snapshots/
images/
```

| Current input or responsibility                               | Final destination                                     |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| `docs/templates/all-ui-tokens.json`                           | `src/token-data/ui/definitions.jsonc`                 |
| `docs/templates/all-semantic-tokens.json`                     | `src/token-data/semantic/definitions.jsonc`           |
| UI section of `docs/lookups/token-details.jsonc`              | `src/token-data/ui/details.jsonc`                     |
| Semantic section of that catalog                              | `src/token-data/semantic/details.jsonc`               |
| Syntax section of that catalog                                | `src/token-data/syntax/details.jsonc`                 |
| Upstream extraction configuration                             | `src/token-data/sources.jsonc`                        |
| Each theme's `tokens/<family>.jsonc`                          | `tokens/<family>/definitions.jsonc` in the same theme |
| Each theme's `details/<family>.jsonc`                         | `tokens/<family>/details.jsonc` in the same theme     |
| `docs/lookups/hex-opacity.md`                                 | `docs/references/hex-opacity.md`                      |
| `docs/grammar-samples/`                                       | `samples/grammar/`                                    |
| Reusable implementation in command scripts and `scripts/lib/` | The corresponding `tooling/` modules                  |
| Shared test project helpers                                   | `tests/helpers/`                                      |
| Each theme's `palette/palette-config.jsonc`                   | `palette/config.jsonc` in the same theme              |
| `dev-extension/`                                              | `preview/`                                            |
| `dev-extension/themes/`                                       | `preview/themes/`                                     |
| `dev-extension/static-snapshots/`                             | `preview/snapshots/`                                  |

The theme families are `variables`, `ui`, `semantic`, and `syntax`; keep those family directories as the final directory level. Internal variables remain theme-owned and expose `variables.*` aliases. Shared syntax data remains details-only: add neither shared syntax definitions nor a shared variables family.

Move inputs directly to these paths. Do not implement the predecessor's intermediate `docs/lookups/tokens/`, `docs/templates/tokens/`, `*-template.jsonc`, or split `*-details.jsonc` destinations. Remove the old combined catalog, starter files, and theme-level `details/` directories only after all active consumers have migrated. Remove `docs/templates/` and `docs/lookups/` when empty.

Keep `metadata.jsonc`, palette reports/notes, prod outputs under `themes/`, and images in their current locations. Every target requires an explicit `palette/config.jsonc`, retaining the current palette settings and `useDefaultPalette` behavior. Preview-generated themes live under `preview/themes/`, preserved snapshots under `preview/snapshots/`, and the generated preview manifest at `preview/package.json`. Definitions and details independently use existing whole-file prod-default fallback. Creating a family directory never materializes omitted files or changes fallback to apply to the whole family. Explicit empty inputs retain their existing suppression semantics after conversion to the applicable new schema.

Update preview output discovery, manifest contribution paths, asset links, watcher subscriptions, cleanup ownership checks, packaging/ignore rules, tests, and docs together. Preserve snapshot bytes, generated theme filenames/notices, extension identity, theme labels, and reload-detection behavior. Repair an existing installed preview link only after verifying that it points to this checkout's former directory; unrelated real paths or links remain protected. Update the palette input-path constant and every generator, fixture, palette-only command, and documentation example to use `palette/config.jsonc`.

## Tooling boundaries and dependency direction

| Directory              | Responsibility                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `tooling/palette/`     | Palette generation and report rendering.                                                                         |
| `tooling/tokens/`      | Format normalization, category validation, aliases, compilation, and theme rendering.                            |
| `tooling/tokens/data/` | Loading checked-in definitions/details, retrieving pinned sources, extraction, and detail refresh orchestration. |
| `tooling/themes/`      | Discovery, fallback, manifests, generated-theme validation, artifact preparation, and build/watch workflows.     |
| `tooling/generators/`  | Theme scaffolding, property addition, syntax ID assignment, and JSONC source edits.                              |
| `tooling/preview/`     | Preview synchronization, asset links, registrations, and reload guidance.                                        |
| `tooling/shared/`      | Color math, repository paths, JSONC parsing, filesystem helpers, terminal output, and artifact staging.          |

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

Shared definitions and shared details intentionally have different inventories. Definition files control supported inventory and generator placeholders. Detail refreshes do not expand definitions, prune entries, or overwrite theme-specific documentation implicitly.

UI, semantic, and syntax definitions/details use root categories in this order: `standard`, `sourceCode`, `nonStandard`, `deprecated`. Keep empty category objects, except syntax definition categories, which each contain a `rules` array. Variables retain their existing nested role definitions and corresponding canonical-path detail map without these category wrappers.

Rename the legacy JSONC token-category keys `source` to `sourceCode` and `non-standard` to `nonStandard` in shared data, authored definitions/details, examples, schemas, and fixtures. Perform this at the category-root paths using the syntax tree; do not globally replace token ID segments, scope strings, descriptions, `sources.jsonc`, or extraction source options. Retain `modified-desc` exactly as named. Reject old/new category collisions with their paths during migration, and accept only the new category spellings after the source/reader cutover.

| Category      | UI and semantic meaning                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `standard`    | Properties/selectors supported by the pinned published schema or standard type/modifier definitions.             |
| `sourceCode`  | Verified pinned core registrations absent from the corresponding published schema or standard definition set.    |
| `nonStandard` | Extension-owned, provider-defined, or custom entries; unverified entries remain explicitly marked for review.    |
| `deprecated`  | Explicitly retired, removed, or deprecated entries with evidence. Absence from a snapshot alone is insufficient. |

Use existing sections/examples as the classification seed, then reconcile them with pinned evidence and record corrections. Category membership belongs to the canonical token ID independently of its style or enabled state. Reject duplicate canonical IDs across categories. Syntax uses its family-specific category rules below.

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

Source syntax definitions use the four category objects, each with a `rules` array. Shared and theme syntax details use the four category objects containing exact stable rule-ID maps. Do not split rule IDs or TextMate scope expressions into nested paths.

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
- Assign `order` from the original array index during migration. Merge category arrays and sort globally by `order` before compiling. Require globally unique nonnegative integer orders and unique IDs within each effective syntax definition file; reject missing, fractional, negative, and duplicate orders.
- Retain existing ID requirements: every default-theme rule needs an ID; other targets retain optional IDs, validating uniqueness when declared. Do not invent aliases or details targets for unnamed nondefault rules. Required ID assignment remains an explicit generator responsibility.
- New generated rules append after the highest order unless an insertion is explicitly requested. Category/object ordering cannot change precedence. Strip `order` from emitted rules.

Preserve syntax rule and scope order exactly, including disabled rules, names, stable IDs, formatting-only rules, and background descriptors. Empty local syntax definitions have four objects with empty `rules` arrays; empty local syntax details have four empty objects. Both continue to suppress their respective whole-file fallback.

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

The example demonstrates metadata shape, not a verified extension registration. Verify actual contributors before documenting usage.

### Description protection

- Optional `modified-desc` is a boolean. Exactly `true` protects the existing nonempty `description` from extracted replacement. An absent or false flag permits refresh; removing it or setting it false restores that behavior. Reject nonboolean flags and empty protected descriptions.
- The updater refreshes shared details. Generators preserve existing theme-specific descriptions and relationships; they copy shared descriptions/protection flags when creating missing detail records. Builds never refresh either document as a side effect.
- Preserve description text in the structural migration without automatically marking every migrated or unresolved entry protected. A preservation decision requires an explicit flag.
- Preserve protected shared records. Import protected descriptions from `src/themes/prod/default/tokens/<family>/details.jsonc` when applicable; if both locations protect conflicting descriptions, fail with both paths before writes. Dev-theme protections remain local and cannot replace shared records.
- With no protection, extract UI/semantic descriptions from registrations, syntax descriptions from local rule/scopes and available grammar descriptions, and variables descriptions from local role definitions. Variables have no shared detail file.
- Do not introduce a per-entry `source` attribution property. Keep provenance, pins, license, and review information in file headers/configuration. The category named `sourceCode` remains supported.

### Optional nonStandard usage context

- Optional `use` is a nonempty string on individual nonStandard UI, semantic, or syntax detail records. Allow it on nonStandard shared UI/semantic definition leaves as generator documentation metadata. It does not belong on the category container or in theme styling descriptors.
- Describe verified extension display name/ID, language/provider, and the relevant visible object or state. For example, `When Example Blame (example.blame) is installed and its inline blame annotation is visible beside an editor line.` This extension identity is illustrative.
- `description` states purpose; `use` documents activation/display conditions. Installed extensions do not necessarily have their relevant UI or semantic provider active. For mixed syntax rules, identify the extension-specific scopes separately from ordinary ones.
- Omit unknown usage context. Reject empty/whitespace strings, arrays, and other nonstrings. Preserve authored context regardless of `modified-desc`; that flag protects only descriptions. Fill missing context from extraction only when evidence establishes it.
- Creating a detail record copies usage from shared details, or shared definitions if details have none. Preserve existing theme context and report conflicting shared values rather than silently replacing them.
- Reclassification that would move `use` outside nonStandard requires reconciliation before writes. Transfer shared-definition usage into generated details, excluding it from theme styling and emitted JSON.

No category, `description`, `modified-desc`, `use`, authoring `order`, or grouping object is emitted into a VS Code theme. Existing `colorReason`, `disabledReason`, aliases, and formatting retain their current roles.

## Format codec, schemas, and editor support

Use `tooling/tokens/formats.js` as the shared codec for definition/detail traversal, category order, canonical IDs, selector encoding, syntax ordering, and diagnostics. Normalize nested definitions/details into the existing compiler maps/arrays before collecting aliases, validating relationships, or rendering output. Preserve `ui.<canonical-id>`, `semantic.<exact-selector>`, `syntax.<id>`, and `variables.<path>` aliases; category names and semantic `default` never become alias components.

Recognize schema-specific records, including disabled/formatting-only definitions without colors, and continue traversing nodes that also contain children. Reject unknown scalar fields, malformed children, duplicate JSONC keys, duplicate normalized IDs, and reserved-field collisions. Keep the originating file and syntax-tree location alongside each normalized record.

Add local JSON Schemas under `tooling/tokens/schemas/` and associate them with final paths through `.vscode/settings.json`. Provide appropriate schemas for shared versus authored UI/semantic definitions, syntax definitions, categorized details, variable definitions/details, and source configuration. Distinguish documentation-only `use` on shared definitions from actual theme styling fields.

Schemas provide completion and immediate structural checks for categories, descriptors, `description`, `modified-desc`, `use`, and syntax `order`. Reuse the contract's category/field vocabulary and verify schema/codec agreement on meaningful accepted and rejected examples. Build-time category membership, cross-file references, duplicate IDs, and global order uniqueness stay in the semantic validators; editor feedback is not a replacement for build validation.

Attach schemas using file associations so category-only roots need no extra schema/version fields. Keep all schemas local: normal editing, builds, checks, and tests require no schema download. Update active examples to the same schemas, including the UI parent/child and semantic compound/language-qualified cases. Add a syntax example if needed to document categorized arrays and `order` without creating a shared syntax definition inventory.

## Token category validation

Implement `tooling/tokens/category-validation.js` using the codec and an injected classification snapshot from `tooling/tokens/data/load.js`.

| Family    | Membership and category authority                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI        | `src/token-data/ui/definitions.jsonc`, supplemented by `src/token-data/ui/details.jsonc` for evidenced nonStandard/sourceCode/deprecated IDs absent from definitions. |
| Semantic  | `src/token-data/semantic/definitions.jsonc`, supplemented by its shared details with the same restrictions.                                                           |
| Syntax    | `src/token-data/syntax/details.jsonc` plus evidence-backed syntax classifications; new rules default to standard and have no shared-definition allowlist.             |
| Variables | Existing internal-role schema, aliases, and detail association; no shared category inventory.                                                                         |

Validation rules:

1. A UI or semantic token placed in `standard` must have an exact, case-sensitive canonical ID/selector in its shared definition file's `standard` object. A shared detail record cannot make an absent definition standard. Presence under another category is insufficient.
2. A token listed in shared definitions must use that category in its theme. A shared detail entry under a conflicting category fails shared-data validation rather than overriding the definition.
3. For IDs absent from shared definitions, allow evidenced sourceCode/nonStandard/deprecated membership from shared details. Unknown UI/semantic IDs may be authored only under nonStandard, with existing ID/style/details rules. `use` does not grant standard membership.
4. Audit source-only IDs before enabling enforcement. Add a verified missing standard registration to shared definitions explicitly and record its evidence; never relabel a genuine standard token to bypass validation. This is the allowed inventory correction during migration; do not bulk-add unverified IDs or prune entries.
5. Check disabled tokens, formatting-only selectors, exact compound/language-qualified selectors, and both members of a parent/child UI node. Check categories in matching theme details against their effective definitions too.
6. Validate syntax categories, rule IDs where present, order metadata, and details association against shared syntax evidence. Standard is the default for new rules; require evidence for `nonStandard`, `sourceCode`, or `deprecated` classification. Never check syntax scopes against a UI/semantic allowlist.
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

For each shared-data edit, reload and structurally validate one snapshot, then compare its normalized classification projection: family, exact canonical ID, category in shared definitions when present, and category in shared details when present. Keep definition membership distinct from detail-only membership: moving an ID between files can change its validity even if its category name is unchanged. Ignore description/protection/usage text, comments, key ordering, and generator placeholder styling in that projection.

- Classification changes invalidate the relevant category checks and rebuild through the prepared workflow where needed. Include categories supplied only by shared details, not just the two definition inventories.
- Valid description/usage-only changes update the data snapshot without recompiling palettes/themes, writing generated artifacts, syncing previews, or printing a reload reminder. A later explicit generator still sees the new documentation and placeholders.
- Invalid edited data still produces a precise error even if its classification projection would otherwise be unchanged. A corrected source or shared-data edit retries the failed pass; skipping unchanged classification must never hide pending dirty sources or a previous failed validation.
- Definition, palette, metadata, manifest, and snapshot events retain their appropriate build/registration behavior. Ordinary authored detail edits still undergo detail schema/reference validation; do not treat all files named `details.jsonc` as shared-description-only events.
- Keep one current snapshot per pass, queue edits arriving mid-pass, close every watcher on shutdown, and preserve recovery after malformed inputs. No watcher invokes upstream retrieval or extraction.

`sources.jsonc` affects explicit extraction, not ordinary styling/category matching. Read its updated pins on the next updater invocation. No file event independently establishes that VS Code needs a reload; keep the existing preview-registration/setup comparison.

## Description updater and pinned extraction

Add the command wrapper and package entry:

```json
{
  "update:token-details": "node scripts/token-data/update-token-details.js"
}
```

Delegate loading, source retrieval, extraction, and refresh to their final `tooling/tokens/data/` modules. Store extraction configuration only in `src/token-data/sources.jsonc`, starting from the catalog's existing stable version `1.143.1` and supplemental main revision `1184ad4d45794110deb6b897ea83b15aac44ed89`. Verify availability and accuracy during implementation; a pin correction is an explicit documented input change, never an automatic switch to latest.

Updater behavior:

1. Validate shared definitions/details and authored inventories. Refresh the union of definition IDs, existing shared detail IDs, and authored IDs. Preserve differing inventories without expanding definitions, deleting detail entries, materializing inherited theme files, or rewriting theme-specific documentation.
2. Resolve protected descriptions and default-theme protection conflicts before preparing changes. Refresh unprotected descriptions from extracted inputs; retain protection flags and authored `use` context.
3. Extract UI descriptions from pinned `registerColor` calls and contributed color definitions. Extract semantic type/modifier descriptions from registry definitions and extension contributions. Prefer stable registration data, then verified pinned-main additions absent from stable.
4. Use a TypeScript AST parser for supported static registrations, localization string/message forms, and referenced/imported static constants. Add an explicit development dependency and lockfile change if needed. Read manifests as data, report unresolved dynamic expressions, and never execute upstream code to extract descriptions.
5. Derive semantic combination descriptions from the extracted type/modifier definitions without inventing provider behavior. Extract local syntax names, ordered scopes, descriptive comments, and available grammar descriptions; preserve protected syntax wording. Derive internal-variable purposes locally through the authoring generator without introducing shared variable data.
6. For unresolved existing IDs, retain reviewed text and report missing evidence. For unresolved new IDs, add a nonempty `UNREVIEWED` description and warn. Never convert an extraction failure into fabricated reviewed text or automatically set `modified-desc: true`.
7. Reconcile evidenced category changes, preserving relationships where present, protected descriptions, flags, usage, provenance, and licenses. Do not infer retirement from absence. Require reconciliation for category/context conflicts before applying any candidate.
8. Format and validate all three shared detail candidates before applying replacements. Write changed files only, stage the set with rollback on application failure, and leave unrelated themes/definitions untouched. Repeated identical input leaves content and timestamps unchanged; review dates change only when the recorded source/review inputs actually change.
9. Report counts and changed paths using existing terminal colors: yellow headings, blue information/paths, green additions/success, bright yellow warnings, red errors, magenta actions/important notices, and default text for uncategorized output. Refreshing shared details does not itself require a reload.

Retrieval and modes:

- Default update uses an ignored `.cache/token-details/` for pinned snapshots, fetching exact revisions only when needed. Record pins/input identities so extraction is reproducible.
- Accept `--vscode-source <path>` and `--vscode-main-source <path>` for matching local checkouts and validate revisions. Support repeatable `--extension-source <path>` inputs for provider/extension descriptions absent from core, recording their identity/revision in extraction provenance; do not infer an extension's identity from an unverified token name.
- `--offline` forbids downloads and reports actionable missing-source errors.
- `--check` prepares the same refreshed details in memory and reports drift without writing details or cache files. It requires existing cache or supplied checkouts and never fetches implicitly. Ordinary aggregate checks validate checked-in structures/coverage without requiring that cache or TypeScript source snapshots.
- Retrieval, pin, parse, formatting, and unresolved-override conflicts are fatal before writes. Unknown individual registrations follow the explicit review-warning behavior above.
- Ordinary builds, checks, generators, and tests do not fetch sources. Extraction tests use small local fixtures. Parser dependencies are absent from the normal build import path.

## Authoring generators and file migration

Move reusable `add:theme`/`add:properties` implementation into `tooling/generators/` while retaining their command wrappers and flags. Use the same codecs, current shared snapshot, category validation, and final family paths as the compiler.

`add:theme` copies default metadata and preview naming as today, creates categorized UI/semantic definitions and applicable details, and uses the shared placeholder inventory. It preserves minimal scaffolding, optional whole-file inheritance, existing file-reservation/rollback protections, terminal colors, descriptive path output, and both group-specific/all-build guidance.

`add:properties` adds missing inventory entries at nested paths without changing existing styles, disabled states, comments, or reviewed details. It fills missing descriptions, propagates explicit `modified-desc` and `use` where appropriate, assigns required missing syntax IDs, and derives variable/syntax purposes through their existing responsibilities. Preserve explicit target lists and the configurable default allowlist. Validate and format every selected candidate before writing any theme input, and keep unchanged runs idempotent.

Use a repeatable one-time migration utility with these guarantees:

- Inventory all discovered prod/dev targets, all local and inherited files, normalized tokens/details, template-only/source-only IDs, and current emitted outputs before mutation. Do not hardcode the current default/test/beta/reviewer names or force local copies of inherited files.
- Move theme inputs into their final family paths while retaining independent definitions/details fallback. Preserve local empty files using the new applicable shape, including categorized empty syntax arrays. Preserve internal variables' current nested role structure and `variables.*` aliases.
- Rename every local palette config to `palette/config.jsonc` while preserving its contents and explicit-per-target requirement. Move preview assets to `preview/` and static snapshots to `preview/snapshots/` with snapshot bytes intact; update registrations, asset links, fixtures, cleanup paths, and watcher filters in the same checkpoint.
- Rename token category roots from `source`/`non-standard` to `sourceCode`/`nonStandard` using JSONC syntax-tree paths, preserving attached comments. Update readers, schemas, examples, and fixtures together; reject collisions and legacy spellings after cutover without altering actual token IDs or extraction configuration.
- Split shared details directly into final family paths, retaining every record, description, provenance header, and required license. Reshape shared definitions directly at their final paths, with only audited missing-standard corrections to inventory.
- Reparent UI/semantic definitions and matching details using syntax-tree spans so comments stay attached to their records. Do not rebuild authored JSONC solely through parse/stringify. Preserve scope expressions, ordinary comment blocks, deliberate token order, and disabled definitions.
- Rename `for` to `description` in every detail family, preserving text and relationships. Fail if conflicting old/new values would otherwise be discarded; collapse identical duplicates explicitly. Remove legacy field support and proposed per-entry attribution after all sources/fixtures have migrated.
- Group syntax rules/details with standard as default and verified extension-specific rules as nonStandard. Preserve mixed-scope rules and IDs, assign the original array index as `order`, and verify exact compiled precedence.
- Reconcile categories against final shared definitions/details before enabling the validator. Do not run property addition as part of conversion or insert every missing starter entry into existing themes.
- Refresh active UI/semantic examples and syntax-order documentation with the same codec. Retain omitted files, comments, aliases, colors/reasons, flags, relationships, and source membership.
- Prepare and validate the entire selected migration set before replacements; support retry/no-op after a completed migration and restoration after application failures. After each stage's readers and fixtures have migrated, remove obsolete paths rather than retaining permanent dual-format guessing.

## Grammar samples, documentation, and packaging

Move `docs/grammar-samples/` as one set to `samples/grammar/`. Describe them as language samples for inspecting highlighting. Keep `tsconfig.json` beside TS, TSX, and JavaScript samples so editor discovery and sibling imports continue to work. Preserve language probes and comments while updating embedded paths and optional validation commands, including the Python example path.

Keep usage guides in `docs/guides/` and automated test inputs in `tests/fixtures/`. Grammar samples require no execution, and optional language-toolchain checks remain outside `npm run check`. Update README links, guide tables/commands, `.prettierignore`'s Svelte entry, editor/formatter/linter rules, and source comments using the old sample location.

Move `hex-opacity.md` directly to `docs/references/hex-opacity.md` and repair active references. Keep active examples under `docs/references/examples/`. Update README, development/token guides, workbench audit instructions, command/path tables, and examples for the final paths, four categories, exact selectors, syntax order, `description`, protection flags, and usage context. Document ownership, command flags, source pins, and validation-versus-generator roles in `src/token-data/README.md`.

Audit imports, npm scripts, test discovery, CI/release workflows, generated notices, editor settings, hooks, caches, and packaging consumers. Preserve release behavior, snapshot contents, and historical plans/changelog claims while applying the explicit preview path migrations. Repair historical links if a moved active target would break them without rewriting historical behavior.

Exclude `tooling/`, `samples/`, and `preview/` from the VSIX explicitly, replacing the former development-extension directory exclusion and preserving current exclusions for src/tests/docs/scripts and developer configuration. Update preview manifest ignore paths, and ignore the upstream cache. Add a meaningful package-content check that verifies required distributable assets and absence of development inputs; inspect the packaged file list in the final stage. Do not run live publication as verification.

Update `CHANGELOG.md` and active documentation when implementation is complete. This planning task itself changes no runtime code, theme sources, commands, or generated assets. Every authored JavaScript module, including scripts, fixtures, configuration, and samples, follows `AGENTS.md` documentation and spacing requirements.

## Staged implementation and verification gates

Each stage must end with relevant passing checks and a commit using the repository's existing sentence-case imperative style. Keep integrated schema/source cutovers in one coherent stage; a committed checkpoint must build rather than requiring later repairs. Record completion and evidence in this checklist. Run the final aggregate suite once integrated, broadening/repeating tests only when subsequent changes or failures justify it.

| Stage                               | Work                                                                                                                                                                                                                                                                | Gate before committing                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baseline                         | Capture canonical token/detail/alias inventories, fallback ownership, scope/rule order, generated files, snapshot bytes, and current shared/authored membership differences.                                                                                        | Establish the current check results and reproducible output baseline; distinguish existing failures before migration.                                                                                                        |
| 2. Tooling and artifact preparation | Move reusable implementation into final tooling boundaries, thin CLI wrappers, centralize paths, and introduce the prepare-once artifact interface without changing source formats.                                                                                 | Focused CLI/build/check/preview tests; combined-build failure before writes; unchanged outputs and no script imports from tooling.                                                                                           |
| 3. Theme and preview paths          | Move local definitions/details into final family paths, rename palette configs to `palette/config.jsonc`, and move preview themes/snapshots to their final paths. Preserve old token data shapes temporarily and update readers/generators/fixtures/links together. | Independent fallback, omitted/empty files, explicit palette inputs, stable aliases/styling, preserved snapshot bytes, correct preview manifest paths, and safe checkout-owned link repair.                                   |
| 4. Shared formats and validation    | Move shared data directly to final paths; implement codec/schemas, categories, detail fields, syntax ordering, and source category validation; migrate sources/examples and all affected readers and generator writers together.                                    | Schema/codec agreement, inventory/text/comment preservation, generator compatibility with the new format, exact source errors, no missing/duplicate IDs, and normalized output/precedence comparison.                        |
| 5. Extraction and generators        | Implement pinned retrieval/extraction/updater at final paths, protection and context merging, and final generator behavior.                                                                                                                                         | Local extraction fixtures, true/false/absent protection, conflicts, unknown IDs, no network during ordinary operations, no-write checks, and unchanged reruns.                                                               |
| 6. Watch dependency handling        | Watch final shared-data paths; compare classification projections and preserve serial scheduling/recovery.                                                                                                                                                          | Category or definition/detail membership edits revalidate; description-only changes validate without compilation/writes; malformed edits and source/registry corrections recover; registration reminders remain conditional. |
| 7. Samples and consumers            | Move grammar samples, finalize links/editor associations/formatting, updater documentation, test directory discovery, CI and VSIX exclusions.                                                                                                                       | Working sample configuration/relative imports, meaningful package-list checks, no active stale destinations, and preserved optional sample-check behavior.                                                                   |
| 8. Final integrated acceptance      | Complete active docs/changelog, record reviewed inventory/category corrections and any harmless UI/semantic output-order changes, and retire obsolete inputs.                                                                                                       | Relevant remaining focused checks, `npm run check`, repeatable build/check, isolated preview sync, and package-content inspection. Commit completed implementation and generated changes.                                    |

Migration tooling/tests themselves use local fixtures and injectable roots. Test nested discovery explicitly so moving suites cannot silently drop coverage. Move shared project builders into `tests/helpers/`, color math tests into `tests/shared/`, palette tests into `tests/palette/`, shared-data tests into `tests/tokens/data/`, and CLI/workflow tests into their responsibility directories. Keep upstream fixture snapshots in `tests/fixtures/` and avoid tests that merely mirror implementation steps.

## Acceptance criteria

1. This document's final paths are authoritative. Runtime readers, generators, updater, validators, fixtures, editor schemas, docs, and packaging use them; retired intermediate paths are not accepted as silent fallbacks.
2. Theme families use paired `definitions.jsonc`/`details.jsonc` with independent whole-file fallback, and every target explicitly supplies `palette/config.jsonc`. Shared UI/semantic data uses the family filenames, syntax shared data is details-only, and variables remain theme-owned. Token-category roots are exactly `standard`, `sourceCode`, `nonStandard`, and `deprecated`; legacy category spellings fail after cutover.
3. All canonical authored IDs/styles/aliases, description text during structural migration, comments, reviewed relationship arrays, omission/empty-file behavior, and static snapshot bytes are preserved. Any shared standard-inventory correction has recorded evidence.
4. Nested UI parent/child records, exact semantic default/compound/language-qualified selectors, disabled definitions, and formatting-only records survive normalization. No authoring metadata appears in emitted themes.
5. Syntax defaults to standard with verified extension-specific rules in nonStandard; mixed-scope rules retain IDs/scopes. Globally unique order metadata preserves exact rule/scope precedence across categories, with no missing, fractional, negative, or duplicate orders.
6. UI/semantic standard membership is enforced against the exact family's shared definitions. Wrong placement, absent membership, malformed authorities, inherited category conflicts, and duplicate IDs fail before output/cleanup/manifest/preview mutation, naming the exact token, input location, expected/actual categories, authority, and reason.
7. Detail records use `description`, optional boolean `modified-desc`, and optional nonStandard `use`, with no per-entry source attribution. Extraction preserves protected text and independent usage context; false/absent protection permits extracted refresh. Invalid values and conflicting protections/context fail accurately.
8. Shared data loads locally once per pass; source retrieval/parser machinery is confined to explicit updater operations. Clean checkout builds/checks/tests and editor schemas need neither network nor a populated upstream cache.
9. Combined builds prepare one validated artifact map before writes; check uses the same preparation without filesystem mutation or preview sync. Generated preview themes use `preview/themes/`, snapshots use `preview/snapshots/` with bytes preserved, and registrations/asset links/watchers target those final paths. Current stale-output ownership, cleanup boundaries, symlink protections, and palette-only independence are retained; packaging excludes `preview/`.
10. Shared category or definition/detail membership changes trigger category validation; valid shared description-only changes update the snapshot without compilation/writes/sync/reload. Errors remain visible and corrected source/data edits retry through the serialized watcher.
11. Editor schema associations match actual source shapes, examples, and validator contracts. Samples exist under `samples/grammar/`, with adjacent working TS configuration, updated active links, and preserved highlighting probes.
12. Every stage has a passing checkpoint and commit; final aggregate checks, idempotence, isolated preview behavior, and VSIX contents are verified. UI/semantic serialization-order changes, if unavoidable, are explicitly reviewed while styling equality and exact syntax precedence remain required.

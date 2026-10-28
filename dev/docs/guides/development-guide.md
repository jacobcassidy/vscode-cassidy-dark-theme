# Development guide

- [Quick start and preview](#quick-start-and-preview)
- [Project structure and ownership](#project-structure-and-ownership)
- [Editing palettes](#editing-palettes)
- [Editing tokens and details](#editing-tokens-and-details)
- [Creating themes and maintaining shared token data](#creating-themes-and-maintaining-shared-token-data)
- [Validation, tests, and troubleshooting](#validation-tests-and-troubleshooting)
- [Visual inspection](#visual-inspection)
- [Packaging, releases, and recovery](#packaging-releases-and-recovery)

## Quick start and preview

Use Node.js 24 from [`.nvmrc`](../../../.nvmrc), npm, and VS Code. Install locked dependencies and start the local preview:

```bash
npm ci
npm run build
npm run watch
```

Theme builds generate both groups before applying their combined artifacts, then synchronize the separate `jacobcassidy.cassidy-dark-dev` extension. Its manifest is written directly into `~/.vscode/extensions/jacobcassidy.cassidy-dark-dev/package.json`; checkout assets are linked there. There is no preview manifest in the checkout. Tests inject a temporary destination and never use your installed extension.

After moving to this layout from an earlier checkout, inspect `~/.vscode/extensions/jacobcassidy.cassidy-dark-dev/preview`. If it is a symbolic link to this checkout's old `preview/` directory, remove that link and rerun `npm run build`; synchronization will create a link to `dev/preview/`. Do not remove a real directory or a link to another location.

After initial setup, run **Developer: Reload Window**, then choose **Cassidy Dark Preview** or a named preview. Ordinary color changes load live. A magenta reload reminder appears only when registrations or asset setup change. Preview snapshots use **Cassidy Dark Snapshot** labels. `previewName` in a theme's metadata overrides its named preview suffix without changing production labels.

Watch coalesces saves, validates stable inputs, and serializes application. Ctrl+C closes its subscriptions and waits for active work. If preview synchronization fails after application, generated artifacts remain available; rerun `npm run build` to retry. Watch automatically retries pending preview synchronization without recompiling themes while continuing to process source events.

## Project structure and ownership

```text
src/themes/{prod,dev}/<name>/
  metadata.jsonc
  palette/config.jsonc
  tokens/{variables,ui,semantic,syntax}/{definitions,details}.jsonc
src/data/tokens/{ui,semantic}/{definitions,details}.jsonc
src/data/tokens/generated/syntax/details.jsonc
src/data/tokens/generated/upstream-sources.jsonc
dev/tooling/                 reusable workflows, codecs, schemas, validation
dev/scripts/                 command wrappers and release helpers
dev/tests/                   recursive behavioral suites and local fixtures
themes/                  generated production themes
dev/preview/{themes,snapshots}/
dev/packages/               local VSIX packages
dev/samples/grammar/         visual language probes and adjacent tsconfig.json
dev/docs/references/         maintained and historical reference artifacts
```

The production default at `src/themes/prod/default/` supplies **independent whole-file fallback** for omitted metadata, definitions, and details. A family directory alone creates no override. A local definition file replaces only definitions; a local detail file independently replaces details. Empty categorized inputs suppress their own fallback: UI files and theme semantic files contain four empty category objects; shared semantic definitions contain four empty arrays; syntax definitions contain four objects with empty `rules` arrays. Variables remain theme-owned nested roles, with a flat canonical-path detail map.

Every target explicitly supplies `palette/config.jsonc`. Set `useDefaultPalette: true` to use the default palette; otherwise provide complete custom settings. Shared definitions provide inventory and categories; shared details provide reusable documentation. Builds validate those authorities without importing shared descriptions into themes. Shared syntax has no definition inventory, and shared variables do not exist.

Generated production themes stay in `themes/`. Reports stay beside each theme's palette. Preserved snapshots are historical bytes, independent from generated preview themes. [Shared-data ownership](../../../src/data/tokens/README.md) and [schemas](../../tooling/tokens/schemas/) provide focused references.

## Editing palettes

Edit the [default configuration](../../../src/themes/prod/default/palette/config.jsonc), then run `npm run build:palette`. Custom themes have the same configuration contract. Recognized dormant settings may remain beside `useDefaultPalette: true` for later custom generation.

Each chromatic family defines `hue` and `lightness`, optionally `baseChroma`. The generator produces numbered tones `300`, `400`, `500`, `600` and `400-muted`. `chroma.strength` controls default chroma and `chroma.gamutFraction` limits its share of the available sRGB gamut. Neutral keys map to lightness values; `palette.gray.<key>` aliases identify their generated colors. The default theme's current anchors are the values in its configuration, rather than historical candidate palettes.

Overrides choose exactly one of `hex` or `oklch` and require a nonempty `colorReason`. Hex overrides retain alpha; OKLCH overrides remain within sRGB. A custom palette generates `palette/generated/palette.json`, `palette.md`, and `palette.svg`. Reports distinguish requested, gamut-limited, and exported measurements; exported values account for rounded hex. The [current report](../../../src/themes/prod/default/palette/generated/palette.md) includes contrast references and override reasons. Check actual foreground/background pairs and composite translucent colors over their real backdrop.

Default-palette targets generate only `palette/default-palette.txt`, removing their generated report directory. Returning to custom generation recreates reports and removes the note. Palette-only mode is independent from token data, does no theme cleanup, and never synchronizes previews.

## Editing tokens and details

UI, semantic, and syntax inputs have exactly these category roots, in order: `standard`, `sourceCode`, `nonStandard`, `deprecated`. Category membership belongs to the canonical token independently of its color or disabled state.

| Category      | Accepted evidence                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standard`    | Exact UI/semantic membership in the pinned shared definition inventory; ordinary syntax scopes default here.                                                     |
| `sourceCode`  | Reviewed core registrations/scopes absent from the corresponding published baseline.                                                                             |
| `nonStandard` | Extension/provider/custom entries; unverified UI/semantic compatibility entries remain explicitly marked for review. Syntax needs exact reviewed scope evidence. |
| `deprecated`  | Explicit retirement/deprecation evidence. Absence from a snapshot or disabled styling is insufficient.                                                           |

UI splits dotted IDs into nested objects. Parent records can also have children, such as `testing.iconFailed` and `testing.iconFailed.retired`. Semantic shared definitions list exact selectors in category arrays, matching the upstream inventory. Theme semantic definitions and semantic details use flat selector keys within each category: `parameter`, `*.builtin.deprecated`, and `variable.readonly:typescript` remain exact selectors. Modifier order/case and language qualifiers remain exact. `default` is reserved for the unmodified selector; modifier combinations imply no inheritance. A deprecated modifier is an active selector, independent of the retired category.

See the default theme’s [UI](../../../src/themes/prod/default/tokens/ui/definitions.jsonc), [semantic](../../../src/themes/prod/default/tokens/semantic/definitions.jsonc), and [syntax](../../../src/themes/prod/default/tokens/syntax/definitions.jsonc) source files for complete definitions. This smaller UI example is a complete definitions file:

<!-- token-example: ui definitions theme -->

```jsonc
{
  "standard": {
    "editor": {
      "background": { "color": "variables.surface.editor" },
    },
  },
  "sourceCode": {},
  "nonStandard": {},
  "deprecated": {},
}
```

Definitions contain styling; details contain `description`, optional history/usage, and reviewed `inherits`, `overrides`, or `globallyOverriddenBy` arrays. The default theme requires a nonempty description for every entry and an ID on every syntax rule. Other themes may omit individual documentation records; their supplied records must still match their effective definitions/categories.

Aliases remain `variables.<role.path>`, `ui.<canonical-id>`, `semantic.<exact-selector>`, and `syntax.<id>`. Categories and semantic `default` never become alias components. All aliases are collected before resolution; unknown references and cycles fail even in unused or disabled styles. Every literal hex descriptor requires `colorReason`. Optional `alpha` replaces inherited opacity instead of multiplying it; see [hex opacity](../references/hex-opacity.md). Internal variables accept colors only and emit no theme entries.

Semantic formatting supports `bold`, `italic`, `underline`, and `strikethrough`, including explicit false values. Syntax uses `fontStyle`, including the empty string to reset formatting, and may have a background descriptor. Disabled entries require `disabled: true` and `disabledReason`; retained styles/aliases still validate and appear as explained comments in generated JSONC. Disabled placeholders may omit styling. Metadata, grouping, descriptions, reasons, and syntax order never appear in parsed theme JSON.

Each syntax category contains `rules`. Every rule has a unique nonnegative integer `order` across the effective file; missing, fractional, negative, or duplicate values fail. Compilation merges categories by that global order and preserves scope-expression order exactly. Declared IDs must be unique within a theme, while different themes may reuse IDs/orders and resolve their own aliases. Newly added rules append after the highest order unless deliberately inserted. A mixed ordinary/extension scope rule stays intact under its evidenced category.

Relationships document reviewed behavior and never create runtime precedence or color aliases. Matching colors do not prove inheritance. `inherits` describes fallback sources; `overrides` includes conditional precedence. `globallyOverriddenBy` asserts complete replacement across every consumer and fallback path, requires a disabled corresponding entry, and is forbidden for variables. Do not infer it by reversing `overrides`. Relationship arrays contain unique nonempty names, retaining reviewed order; they may reference documented upstream tokens/scopes absent from this theme.

Shared syntax details alone may contain `scopeEvidence.scopes`: an ordered, nonempty array with exact `selector`, `category`, `inputId`, immutable `revision`, and source-relative `path`. Extension/provider evidence also needs a verified `extensionId` or `providerId`. Revisions are full Git commits or `sha256:<content-manifest-digest>`. Conflicting exact-selector ownership/classification fails with both origins. Compound expressions require their own evidence; names, prefixes, prose, and installed extensions are not proof. Reference scope coverage must match before copying shared syntax wording/history. An independent local scope variant needs matching local details if inherited details no longer agree. Ordinary builds validate accepted historical evidence locally, without extraction configuration, caches, or network access. Generators never copy `scopeEvidence` into themes.

## Creating themes and maintaining shared token data

Create one target with `npm run create -- dev/my-theme` or `prod/my-theme`. It prepares six minimal files: copied metadata with a target-derived preview name, explicit default-palette selection, UI/semantic definitions, and matching documentation. Syntax/variables and their details independently inherit the default. Inventory entries receive `#0ff` and an `UNREVIEWED` reason; replace those with intentional choices. Existing names/paths are protected, and validation precedes source application. Creation prints build guidance without building or synchronizing previews.

Shared UI definitions map each dotted group path to an array of exact property names, preserving parent and child tokens without marker fields. Empty categories use `[]`. Shared semantic definitions list exact selectors in category arrays. Styling belongs in theme definitions; the generator owns the common placeholder color and explanation.

`npm run fill -- dev/my-theme prod/default` adds missing shared UI/semantic inventory entries and completes missing documentation for selected targets. With no arguments, `includedThemes` in [the generator](../../tooling/generators/add-properties.js) initially selects `prod/default` and `dev/test`. It preserves authored styles, disabled states, comments, wording, relationships, history, and usage. Required missing default syntax IDs are assigned once without changing rule/scope order. Eligible shared descriptions/history/usage are copied without shared protection flags or scope evidence. Unknown documentation gets a review marker. Unchanged inherited files remain omitted; repeated runs are idempotent.

`npm run refresh` explicitly refreshes shared descriptions. Its online policy always resolves the latest published stable `microsoft/vscode` release and current supplemental main once per invocation, with stable-first precedence. [The configuration](../../../src/data/tokens/generated/upstream-sources.jsonc) records tracking policy, exact successful revisions, per-input coverage, and reviewed coverage acceptances. The initial historical stable tag and known main commit are provenance, not fixed updater targets; unknown historical commits/history stay unknown until verified.

To recreate shared token files, remove `src/data/tokens/generated/` and run `npm run bootstrap`, repeating `--extension-source <checkout>` for each extension that contributes nonstandard UI or semantic tokens. Bootstrap verifies immutable VS Code and extension sources, captures the exact stable release's `vscode://schemas/color-theme` schema and its referenced color registries, and applies generated shared files together. If `prod/default` is absent, bootstrap creates it with every standard palette family and neutral tone, plus definitions and matching details for every verified standard UI color and semantic type/modifier selector. Its neutral styles are reviewable starting values; the TextMate comment rule remains an authored example because the TextMate schema does not enumerate scopes. An existing generated directory, even if empty, blocks bootstrap; existing manual data and theme files are preserved and validated. Missing descriptions receive an `UNREVIEWED` marker. Run `npm run build` after bootstrap.

Generated shared records live in `src/data/tokens/generated/`. Optional authored additions and documentation overrides live in `src/data/tokens/manual/`; bootstrap and refresh leave manual files untouched. Manual definitions can add nonstandard IDs with sorted `Publisher.extension` source attribution in matching details, or reviewed `sourceCode` and `deprecated` IDs whose details include `classificationEvidence` (`inputId`, immutable `revision`, source-relative `path`, and `reason`). They cannot duplicate generated definitions or introduce unverified standard IDs. Manual detail fields override matching generated fields, while generated source attribution and syntax scope evidence remain immutable. The merged snapshot is validated against every authored theme before bootstrap applies changes and during ordinary builds.

Bootstrap and every successful refresh save the versioned schema snapshot and a readable difference report under `dev/docs/refreshes/`. The report lists newly registered, removed, and changed UI colors and semantic types/modifiers, plus registrations missing from static source extraction. `refresh --check` replays the recorded schema without writing. These reports are review evidence; refresh does not automatically add new token definitions.

Refresh displays the current stage and elapsed time with an animated terminal spinner. When output is redirected, progress is written to stderr as plain stage messages. Feedback covers local validation, upstream resolution/retrieval, extraction, description refresh, and final validation/application; the display clears before the result or error.

The updater statically parses registrations, imported constants, localization messages, and extension manifests without executing upstream code. Git inputs must match relevant blobs at the recorded commit; non-Git contributors require verified manifest identity and deterministic SHA-256 dependency manifests. Sources are frozen and rechecked before application. Verified caches live in ignored `dev/.cache/token-details/`; incomplete staging is never a completed entry. Existing checkouts can rename an old `.cache/` directory to `dev/.cache/` before running these commands, provided the new path does not already exist. Concurrent publishers use private staging and guarded publication. Defaults bound each request to 30 seconds, three attempts, and five minutes total; transient failures retry within those limits. SIGINT/SIGTERM cancel retrieval and follow normal rollback once application starts.

Source overrides are `--vscode-source <path>`, `--vscode-main-source <path>`, and repeatable `--extension-source <path>`. Online overrides still must match newly discovered revisions. `--offline` replays the last successful inputs without networking. `--check` also replays those inputs, performs no network/cache/source writes, and reports refresh drift; neither replay mode checks whether a newer release exists. Supply recorded extension sources in their original order. Initial replay needs a successful online record and verified cache or matching checkouts. Ordinary builds/checks/generators never fetch upstream sources.

Every successful replay record requires `localSyntax`, identifying the reference syntax path and SHA-256 content revision. Records missing that identity require an online refresh before replay.

Every shared definition/detail file begins with purpose/provenance/license comments. The last header line is `// Updater (run from the repository root): npm run refresh`. Successful refreshes advance detail headers together with their contents and resolution record; definition headers advance only when definitions themselves are verified/refreshed. No-op runs preserve bytes and timestamps. Headers describe file processing, not the version of every protected or unresolved sentence.

Shared detail records alone accept boolean `modified-desc`; exactly true protects a nonempty description and known history. False/absent permits refresh. Theme-local wording is authored documentation and accepts no protection flag. Shared refresh never imports theme overrides. NonStandard records may have nonempty `use` describing verified activation/display context; omit unknown context, preserve authored usage independently from protection, and reconcile conflicting shared usage explicitly.

Description history is optional and uses normalized stable versions. `descriptionAddedIn` records the first known successful description extraction, not token introduction. `descriptionUpdatedIn` records the latest upstream text-changing refresh; omit it when equal to `descriptionAddedIn`. `descriptionBasedOn` records the known extracted baseline or basis of a manual adaptation. New local/unresolved text receives no stamps. Unchanged wording or newer source versions alone do not advance known text history. Unknown history remains absent; manual edits never masquerade as upstream refreshes.

Upstream inventory/category/scope changes are informational proposals, with exact IDs/scopes, evidence, revisions, and affected files. The updater preserves accepted categories/definition inventory and never rewrites themes. Required-source zero results or loss of prior resolved evidence fails before publication unless an exact checked-in reviewed transition exception applies. Its recorded accepted outcome authorizes only identical-identity/coverage replay; more loss or a newer empty revision needs renewed review. Apply approved category/evidence edits separately across authorities and affected themes, reconcile `use`, then validate and commit together.

## Validation, tests, and troubleshooting

| Command                                    | Purpose                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `npm run build`                            | Prepare/apply both groups and synchronize preview once.                                     |
| `npm run build:prod` / `npm run build:dev` | Build a selected group, then synchronize current previews.                                  |
| `npm run build:palette`                    | Generate production palettes without token/shared-data dependencies.                        |
| `npm run check:generated`                  | Compare prepared artifacts and pending cleanup without writes/sync.                         |
| `npm run check:theme`                      | Prepare sources once, compare generated artifacts, and validate registrations/assets.       |
| `npm run check:docs`                       | Validate maintained local links/anchors and complete examples without networking/writes.    |
| `npm run check:visual`                     | Compare published-theme screenshots in pinned Linux VS Code (Docker required).              |
| `npm run check:reachability`               | Audit executable references, module reachability, and consumed exports.                     |
| `npm test`                                 | Discover only recursive `.test.js` suites, excluding fixture programs and language samples. |
| `npm run check`                            | Run combined theme/generated checks, docs, reachability, formatting, lint, and tests.       |

Focused tests use `node --test dev/tests/tokens/formats.test.js` or another explicit suite. Native watcher/process/symlink/rollback acceptance requires macOS and Linux with locked tools and isolated projects. Native Windows development tooling is unverified and outside this required matrix; published theme engine/platform compatibility retains its existing scope. Grammar samples are visual probes, excluded from runtime lint/execution.

Invalid categories name the exact ID, source origin, expected category, and authority. Review evidence instead of moving a token to bypass validation. Unknown aliases require fixing the referenced family/ID or a cycle. Stale output checks require rebuilding; only immediate theme JSON files with the exact matching generated notice authorize automatic stale removal. Unrecognized stale files, unrelated links, and real installed entries remain protected.

All writers share canonical checkout/destination guards and recheck prepared inputs. A busy writer needs a safe retry after it finishes; stale input diagnostics mean reprepare rather than apply an old candidate. Watch handles those retries serially. Controlled application failures restore prior artifacts when still owned, preserve newer outside edits, and report restoration conflicts/failures. Preview failure is separate: successful generated artifacts stay applied and synchronization remains pending.

An interrupted generation fails closed while retained external detection state exists. Restore its **entire affected set** to the recorded pre-application bytes/entry types, then use the owning command's `--recover=verify-restored` mode. For shared updates:

```bash
npm run refresh -- --recover=verify-restored
```

This verifies every recorded affected path and local contracts under the normal guard, then clears only that exact marker. It performs no extraction/network/cache/source writes. Partial or mixed restoration fails even if structurally valid. Alternatively, `npm run refresh -- --recover` freshly resolves/replays sources and prepares a complete validated generation from repaired current files; failed recovery remains blocked. `--check` is incompatible with recovery. Build and generator restoration verifiers use their owning commands. These markers detect interruption while temporary state survives; they provide no automatic crash replay or power-loss/reboot durability claim.

A blocked watcher observes existing external state at bounded intervals, reports an unchanged condition once, and resumes retained work after explicit recovery even when source bytes/timestamps do not change. Corrected source edits still retry malformed inputs. For unavailable updater sources, use matching recorded checkouts or run an explicit online refresh; ordinary project checks need no upstream cache/configuration. Never repair a user's installed preview directory by deleting an unrelated link or real folder.

## Visual inspection

Run `npm run check:visual` with Docker running for repeatable screenshots of the published **Cassidy Dark** theme. The command uses a digest-pinned Ubuntu container on Linux/amd64, VS Code **1.143.1** (with its exact build commit checked), fixed fonts and viewport, and a fresh isolated profile. It covers JavaScript, TypeScript with semantic highlighting off/on, TSX, Python, Markdown, Problems, and terminal colors. The bundled TypeScript provider must return semantic tokens before semantic-on captures. The fixture does not execute language samples.

The first run downloads the container, locked dependencies, and VS Code; subsequent runs reuse downloads in `dev/.cache/visual/`. The checkout is mounted read-only during comparisons. This separate command runs automatically in the Ubuntu validation job and stays outside `npm run check`. macOS also uses the same Linux/amd64 container, so Docker must support that platform.

Review intentional styling changes with `npm run check:visual -- --update`, inspect the changed PNGs in [the baseline directory](../../tests/visual/baselines/), then commit those images with the theme change. This flag explicitly permits baseline writes. Failed comparisons preserve actual/expected/diff images in `dev/.cache/visual/results/` and an HTML report in `dev/.cache/visual/report/index.html`; Ubuntu CI uploads the report as `visual-comparisons`. Runtime logs are written to `dev/.cache/visual/vscode.log`. Runtime or container upgrades require the same explicit baseline review.

Open [language samples](../../samples/grammar/) with a preview theme and use **Developer: Inspect Editor Tokens and Scopes**. Compare semantic highlighting on/off to distinguish provider tokens from TextMate grammar scopes. Registration availability can depend on the application surface, extension, or active language provider. Matching colors alone establish no inheritance or precedence.

The adjacent [TypeScript configuration](../../samples/grammar/tsconfig.json) keeps TS/TSX/JavaScript sibling imports discoverable. [JavaScript](../../samples/grammar/javascript.js), [TypeScript](../../samples/grammar/typescript.ts), [TSX](../../samples/grammar/tsx.tsx), [Python](../../samples/grammar/python.py), [Vue](../../samples/grammar/vue.vue), and [Svelte](../../samples/grammar/svelte.svelte) provide representative probes; other adjacent samples cover markup, styles, configuration, and logs. Specialized grammars/providers may require their corresponding extensions. Samples require no execution. Optional language-toolchain checks remain outside `npm run check`.

Use [preserved snapshots](../../preview/snapshots/) for historical comparisons. Snapshot bytes are preserved; editing current sources does not regenerate them. Dated palette/comparison references remain historical evidence, rather than current contrast or support claims.

## Packaging, releases, and recovery

Run `npm run package` for full local validation and VSIX creation. Local and pipeline packaging run the full checks once before creating the VSIX. It preserves production theme/image assets and excludes authored inputs, development files, and caches. Local VSIX output defaults to `dev/packages/`; CI can provide its artifact-staging path. Inspect the archive before release. Packaging performs no publication.

Prepare the intended `package.json` version with aligned lockfile root metadata and a matching nonempty `## [VERSION] - YYYY-MM-DD` changelog section. Validate locally and inspect notes with `bash dev/scripts/release/publish/get-changelog-notes.sh`. Commit and push the intended release commit to remote `main` before explicitly submitting publication; local changes are not uploaded by the queue command.

`npm run publish` queues the Azure pipeline that builds the VSIX and publishes it to the VS Code Marketplace and GitHub. It requires local `main`, Azure CLI authentication, and its DevOps extension. It queues remote `main` in organization `https://dev.azure.com/jacobcassidy`, project **Cassidy Dark Theme**, pipeline **jacobcassidy.vscode-cassidy-dark-theme**. The [publication pipeline](../../../azure-pipelines.yml) has no automatic push/PR trigger. Its `vscode_publishing_connection` service connection/identity needs Marketplace publisher authorization for `jacobcassidy`; GitHub requires a secret pipeline `GH_TOKEN` with repository Contents write access and an available authenticated `gh` CLI. The repository does not grant those permissions.

The pipeline validates, packages once, preserves `extension-vsix`, publishes that VSIX to the Marketplace first, then creates/updates the GitHub release with the same asset. The [GitHub helper](../../scripts/release/publish/create-github-release.js) derives `vVERSION` and changelog notes, targeting `BUILD_SOURCEVERSION` or local HEAD for a new release. Before any GitHub request, it requires the embedded package JSON and VSIX XML identities (name, publisher, version) to match the checkout. Existing lightweight or annotated tags must resolve to that exact commit. Existing same-name assets are downloaded and compared by SHA-256; different bytes fail with an actionable error. Only missing assets are uploaded, using frozen validated bytes. Existing notes and tag targets are preserved; authentication/API failures cannot be treated as missing releases.

If only GitHub publication failed after Marketplace success, download the original `extension-vsix` artifact, use the exact release commit with matching manifest/changelog, securely configure `GH_TOKEN`, then run `npm run recover -- /absolute/path/to/cassidy-dark-VERSION.vsix`. This performs only GitHub recovery. Rerunning the whole publication pipeline repeats Marketplace publication; it does not skip an already-published version. Review incorrect existing GitHub assets/notes/tags explicitly. See [release helpers](../../scripts/release/publish/) for implementation details.

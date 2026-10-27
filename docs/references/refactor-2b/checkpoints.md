# Refactor 2b checkpoint evidence

## Baseline

Captured at `19c498c` on macOS with Node `v24.18.0` (repository `.nvmrc`: 24) and the checked-in lockfile. The independent fixture in `tests/fixtures/migration-baseline/baseline.json` records every discovered target, original compiler records including disabled styling, parsed authored inputs and original text/comments, independently selected fallback paths, and SHA-256 snapshot hashes. This fixture is frozen; later approved differences belong in a separate record.

Recomputed inventories match the plan: catalog UI 1,031, semantic 59, syntax 46; starter UI 1,002 and semantic 65. The default theme has 29 UI IDs and two semantic selectors absent from starters; eight starter semantic selectors are absent from the default. Exact IDs are in the fixture. No missing starter entries were added to authored themes.

Timing capture used the original production/development APIs in one Node process, all four targets, no installed preview extension, one warm-up and three measured runs per scenario. Milliseconds:

| Scenario        | Median | Range         |
| --------------- | ------ | ------------- |
| Combined build  | 116.66 | 104.50–152.69 |
| Unchanged build | 111.43 | 100.96–116.62 |
| Generated check | 98.80  | 98.61–106.12  |

These are local measurements, not CI budgets. The original watcher has no shared-data dependency or description-only path; those scenarios require final implementation measurements. Native Linux verification remains required before final acceptance; local macOS results cannot establish it.

## Tooling boundaries and suite discovery

Moved reusable implementations into `tooling/`, retained thin command wrappers, and relocated all 189 existing behavioral tests by responsibility. Recursive discovery runs all relocated suites; CLI fixtures copy both wrappers and tooling. No source formats or generated styling changed. The independent oracle passes for all four targets and preserved snapshots. ESLint and generated-output checks pass. All 189 relocated tests pass on macOS outside the sandbox; the sandbox reports `EMFILE` from native filesystem watching even with serial execution. The original watcher suite also passes outside the sandbox.

Removed `scripts/lib/` and `scripts/dev-extension/`; current consumers import their owning tooling modules directly. Build API retirement follows the prepared-pass checkpoint.

## Prepared application and coordination

Combined builds now prepare one artifact map before any replacement, reuse default work, and compare that same map in read-only mode. Added canonical resource guards outside the checkout, dependency/destination fingerprints, controlled-failure rollback, retained interrupted-generation markers, and exact restored-set verification. Preview errors retain successful artifacts and identify `npm run sync:preview`, which retries without compilation. Preview destination and checkout guards coordinate shared installations.

The focused build/workflow/oracle suite passes 88 cases; preview/workflow coverage passes 36 cases. Tests cover malformed development inputs before production writes, later replacement failure, new-file rollback, newer editor edits during rollback, stale preparation, canonical contention, and complete-set recovery verification. Full platform/process/recovery evidence remains open until the integrated acceptance checkpoint.

## Theme and preview paths

Moved local definitions/details into paired family files without creating omitted inputs; renamed every explicit palette configuration. Moved generated previews and snapshots, updated tooling/fixtures/packaging, and centralized family filenames in `tooling/shared/paths.js`. Only verified checkout-owned former installed asset links are repaired, including dangling links. Snapshot files retain their original bytes. The full 196-case suite passes on macOS with native watcher access; final-path oracle and preview tests pass. Generated outputs differ only in palette provenance paths and preview placement; styling and syntax precedence are unchanged.

## Categorized formats and source cutover

Shared UI/semantic definitions and all three detail families now live under `src/token-data/`; removed the combined catalog and starter paths. Added the shared codec, exact family authorities, scope-based evidence validation, local editor schemas, and source-preserving nested generator edits. Theme details use `description`, and shared-only protection/evidence cannot enter theme files. Syntax original indices become global order and disappear before compilation. Unknown historical stable commit/history remains explicitly unknown. Reviewed category/inventory corrections and serialization differences are recorded separately in `approved-differences.json`.

The independent oracle passes for all targets and snapshot bytes, and a lexical comment inventory matches every original effective source. The focused generator/build/format/schema suite passes 106 cases. Generator suites now assert prepared nested workflows, paired minimal scaffolds, eligible metadata copying, syntax ID stability, independent fallback isolation, and actual CLI fixtures instead of retired flat insertion layouts. Existing compilation, fallback, cleanup, palette, preview, and failure suites retain their distinct behavior coverage. A replacement-save fixture still needs its temporary candidate encoded before rename; native validation will be repeated after that correction.

## Explicit description extraction and immutable replay

Added `update:token-details` with latest-stable/current-main resolution, bounded transport/cancellation, actual Git blob verification and contributor-addressed content manifests, verified revision caches, static TypeScript/localization/import extraction, per-input coverage transitions, protected description history, informational category/scope proposals, no-write replay/check, and explicit recovery. All three shared detail files and successful resolution metadata share one guarded application; definition headers and theme files stay untouched. TypeScript 6 supplies its stable compiler AST API; TypeScript 7's replacement API is not used. Parser modules remain outside normal build/generator imports.

The local updater/retrieval/coverage/transaction suite passes 32 cases, and the expanded updater/schema suite passes 45 cases. Three native separate-process barrier tests pass for canonical contention, abandoned-owner marker retention, and competing cache publication/readers. All extraction tests use checked-in miniature sources copied to temporary Git/contributor projects. No online upstream refresh has been applied to the repository's historical descriptions or successful revision record.

## Watch dependencies and idle recovery

Watch now uses the common combined prepared workflow, caches only the current stable local snapshot, and compares classification/evidence projections independently from descriptions/history/usage/placeholders. Authored input fingerprints filter generated-directory notifications without hiding real source/comment changes. Valid shared documentation-only changes do no preparation, artifact application, or preview synchronization. Pending failed source work survives unchanged projections. Preview-only retries run on bounded observation without compilation; native events continue to queue through one serialized scheduler.

Six deterministic scheduler tests pass without wall-clock waits, covering fast paths, filters, mid-pass coalescing, persistent recovery state/replacement writers, preview retries, and shutdown. Ten macOS native watcher cases pass, including a real interrupted-generation marker cleared by updater restored-set verification: source bytes/timestamps stay unchanged and the idle watcher resumes exactly once without another source event. Existing replacement-save, deletion/discovery, malformed-input, manifest, snapshot, and generated-output filters remain covered.

## Samples, documentation, and final consumers

Moved the complete language-probe set and its adjacent TypeScript configuration to `samples/grammar/`. Consolidated setup, palette/token authoring, generators/updater, validation, visual inspection, and release/recovery guidance into the eight-section development guide; removed the three superseded guides and repaired incoming maintained/reference links. Complete UI, semantic, and syntax examples use the final codec and schemas. README and changelog describe the final workflows. Sample probes retain their source examples and remain outside executable suite discovery and runtime linting.

Added read-only `check:docs` and `check:legacy` to ordinary `npm run check`. Documentation checks cover five maintained documents, local Markdown links/reference links/anchors, three complete examples, schema agreement, and shared provenance headers. The consumer audit follows 66 executable modules from 11 runtime/configuration roots, literal dynamic imports, module URLs, and subprocess/configuration consumers. Regression fixtures reject missing links, malformed examples, dead modules/exports, unresolved dynamic roots, and retired contracts. Historical baseline/upstream fixtures and the exact owned former-link repair have narrow recorded exceptions in `tooling/maintenance/inventory.js`.

Retired production-only group wrappers in favor of the single prepare/apply interface; fixture convenience functions live in `tests/helpers/builds.js`. Extracted formatting, generated-theme validation, and palette reporting into their owning modules with actual runtime consumers. Removed unused production exports and arguments rather than keeping compatibility shims. Runtime unused locals/parameters and unused lint directives now fail; highlighting-probe exceptions are limited to `samples/grammar/`. The new Ajv, Markdown parser, Acorn, and TypeScript dependencies each have concrete schema, documentation, reachability, or extraction consumers. Normal build imports never load the upstream parser/retrieval modules.

Integrated regressions additionally cover preserving parent/child detail records and attached comments, scope-variant generator documentation, interrupted new-directory cleanup and clean retry, static import barrels and lexical shadowing, grammar display-name handling, immutable local-syntax processing identity, bounded Git fetch retries, stale-file removal failure, and restoration failure. Guard ownership is published atomically with a unique owner filename, so reclaiming a dead owner cannot delete a competing new owner's metadata. Generated checks compare prepared bytes without a second formatting pass or candidate-map mutation. Snapshot events arriving during synchronization retain a later serialized preview-only pass instead of being overwritten by completion of the active sync. Owned former asset links are recognized from link text even when dangling; unrelated entries remain protected.

The separate `azure-validation.yml` matrix runs Node 24, `npm ci`, and `npm run check` on macOS and Ubuntu without publication tasks, credentials, or installed-extension access. Existing release behavior and VS Code engine compatibility remain unchanged. Native Windows development tooling remains explicitly unverified and outside the required acceptance matrix.

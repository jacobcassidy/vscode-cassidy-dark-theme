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

## Final integrated acceptance

Completed on 2026-10-28 (Asia/Bangkok; 2026-10-27 UTC), at implementation commit `a0765da`. Earlier open notes above describe their checkpoint state; the final checks below close those items. The independent fixture remains unchanged from its initial capture, and `approved-differences.json` remains the separate review of category/inventory and harmless serialization/provenance changes.

| Checkpoint                                                     | Commit    |
| -------------------------------------------------------------- | --------- |
| Independent baseline                                           | `751d873` |
| Tooling and suite boundaries                                   | `acb7a87` |
| Prepared artifacts, coordinated application, and recovery      | `0daa753` |
| Theme/preview paths                                            | `a87a6f2` |
| Categorized shared/theme formats and validation                | `d81d08d` |
| Explicit extraction and immutable replay                       | `d92d99d` |
| Watch dependency/recovery handling                             | `5ec9483` |
| Samples, consumers, documentation, and integration regressions | `a0765da` |

Both complete aggregate runs passed **236 tests, zero failures, zero cancellations, zero skips**, including the independent styling/comment/fallback/snapshot oracle, actual CLI fixtures, documentation/legacy audits, package inventory, deterministic scheduler/failure matrices, and native watcher/process/symlink/replacement/rollback suites. These runs used isolated projects and preview destinations, with no installed user extension or release credentials:

| Platform | Environment and command                                                                                                                                                                                                                | Result                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| macOS    | macOS 26.7.1 (25G241), arm64, Node `v24.18.0`, npm `12.0.1`; `npm run check` with the locked installation and native filesystem access                                                                                                 | All aggregate checks passed; 236 tests passed. |
| Linux    | Docker `node:24.18.0-bookworm`, digest `sha256:5711a0d445a1af54af9589066c646df387d1831a608226f4cd694fc59e745059`, aarch64, kernel `7.2.12-orbstack-00394-gbecdd6130068`, Node `v24.18.0`, npm `11.16.0`; `npm ci` then `npm run check` | All aggregate checks passed; 236 tests passed. |

The Linux run mounted the checkout read-only, copied it without dependencies/Git/cache into an ephemeral container's native filesystem, installed the lockfile there, and removed the container after validation. macOS's sandbox does not provide usable native recursive watchers, so its required native tests ran outside that sandbox. Neither platform substitutes silent skips. The Linux run exposed Node's recursive watcher retaining a replaced file's inode; subscriptions now refresh after a pass, and the native replacement fixture also verifies the next in-place edit. Repeated macOS validation exposed a snapshot event arriving during sync; the new deterministic barrier test covers retained preview-only work. The native manifest fixture now waits for completed build work rather than assuming independent event streams arrive together.

`npx tsc -p samples/grammar/tsconfig.json --noEmit` also passed as an optional sample-configuration check. The declaration-documentation audit and `git diff --check` passed. Ordinary `npm run check` does not execute grammar samples or access upstream sources.

The baseline oracle reports identical compiled styling, disabled styles, aliases, syntax precedence, source ownership, and snapshot SHA-256 values for all four targets. Unchanged/check operation tests preserve artifact bytes and timestamps, load one shared snapshot per pass, compile each required target once, and reuse default palette work. Shared-documentation-only events perform no preparation/application/sync; preview-only retries and events perform no compilation. The retained historical descriptions have not been refreshed from the live network; updater acceptance uses verified local Git/content-addressed fixtures and deterministic retrieval adapters.

### Timing evidence

[Raw measurements and method](performance.json) retain every measured run. The final comparison reran historical `19c498c` and final `a0765da` workflows in separate temporary copies on the same macOS machine and Node version, using the current locked dependency installation for both. Their historical build/preview dependencies retain the original versions; audit-related dependency-position changes are disclosed in the raw evidence. Each steady-state scenario had one warm-up and three measurements. The four targets were `prod/default`, `dev/beta`, `dev/reviewer`, and `dev/test`.

Combined and unchanged scenarios rebuild already generated targets, matching the original capture. Historical builds call the original prod then dev APIs; final builds prepare/apply one combined pass. Build/check timings exclude preview. Watch timings include source writing, a zero-millisecond debounce timer, real build/sync work, and an isolated preview destination. Native delivery is replaced with controlled subscription events for this timing comparison; the native platform tests above establish filesystem behavior independently. Milliseconds, median (range):

| Scenario                         | Historical rerun                | Final                  |
| -------------------------------- | ------------------------------- | ---------------------- |
| Combined build                   | 116.02 (108.25–117.73)          | 184.64 (179.93–201.70) |
| Unchanged build                  | 109.75 (106.04–122.26)          | 174.70 (173.88–177.90) |
| Generated check                  | 105.85 (102.91–114.23)          | 169.88 (168.06–182.06) |
| Watch styling edit               | 121.19 (117.35–183.46)          | 190.58 (173.99–231.52) |
| Watch shared classification edit | Unsupported by original watcher | 194.77 (190.78–211.26) |
| Watch shared description edit    | Unsupported by original watcher | 21.43 (18.90–22.10)    |

First-build setup, excluded from these steady-state results, took 405.10 ms historically and 225.35 ms finally. Styling alternates an editor background palette alias; classification adds/removes an unused nonStandard UI definition branch; description edits an existing shared UI sentence. The new categorized validation and filesystem freshness/coordination checks increase steady-state full-pass cost. Documentation-only changes avoid that work. These are review measurements, not CI timing budgets; no persistent build cache was added.

### Actual package inspection

After aggregate validation, `bash scripts/release/package-vsix.sh /private/tmp/cassidy-dark-refactor-2b-validation.vsix` passed its generated check and created an actual local VSIX without publication. ZIP inspection found exactly 12 entries: two VSIX metadata files plus ten extension files (manifest, README, changelog, license, five images, and the production theme). No authored inputs, tooling, scripts, tests, grammar samples, preview assets, docs, caches, or validation configuration entered the archive. `package.json` matches the source manifest; the production theme bytes match the checked-in generated artifact. VSCE performs its existing Markdown link rewriting for packaged README/changelog content.

The artifact is 539,852 bytes with SHA-256 `d7c6f848abbe4b6af3fb90133cd71d6bddefc9c4abadd2292abba601113591bc`. Identity remains `jacobcassidy.cassidy-dark`, version `1.2.1`, VS Code engine `^1.64.2`. No release version, publication pipeline behavior, Marketplace state, or GitHub release was changed.

### Acceptance coverage

| Acceptance criteria                            | Evidence                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01–AC-07, AC-11, AC-13–AC-14                | Final paths/codec/schemas, independent fallback/style/comment oracle, authority/selector/order/evidence matrices, and protected metadata/generator fixtures.                                                                   |
| AC-08, AC-15, AC-20, AC-26–AC-31               | Static extraction, immutable source/cache verification, bounded transport/cancellation, exact coverage transitions/replay, coordinated updater replacement/recovery, and native competing publisher fixtures.                  |
| AC-09–AC-10, AC-17, AC-21, AC-23–AC-25, AC-33  | Prepared operation counts, immutable check map, controlled replacement/removal/restoration failures, separate-process ownership, native/deterministic watch recovery and preview retry/coalescing, plus timing evidence above. |
| AC-12, AC-16, AC-18–AC-19, AC-22, AC-32, AC-34 | Checkpoint commits, consolidated guide/samples, read-only audits, recursive suites/CLI fixtures, frozen baseline, actual VSIX inspection, and complete macOS/Linux runs above.                                                 |

No temporary conversion utility, legacy reader/schema branch, unexplained unreachable production export, or persistent build cache remains in active tooling. Native Windows tooling remains outside this acceptance claim.

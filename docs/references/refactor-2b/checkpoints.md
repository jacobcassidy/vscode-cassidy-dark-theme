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

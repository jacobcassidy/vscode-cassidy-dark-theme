/**
 * Retired consumer inventory.
 * @file Declare final cutovers, executable roots, and exact retained historical/test interfaces for the read-only legacy audit.
 */

/** Superseded locations may not exist or be referenced by active consumers. */
export const retiredPaths = [
  "scripts/lib",
  "scripts/dev-extension",
  "docs/lookups",
  "docs/templates",
  "docs/grammar-samples",
  "dev-extension",
  "palette-config.jsonc",
  "static-snapshots",
  "docs/guides/token-details.md",
  "docs/guides/color-system-proposal.md",
  "docs/guides/workbench-color-audit.md",
];

/** Configuration-loaded executable roots that have no ordinary module importer. */
export const configurationRoots = ["eslint.config.js", "prettier.config.js"];

/** Narrow current behaviors requiring literal recognition of historical locations. */
export const legacyOccurrences = [
  {
    path: "docs/TODO.md",
    text: "palette-config.jsonc",
    maximum: 1,
    reason: "Git-ignored personal task notes are outside maintained documentation and runtime consumption.",
  },
  {
    path: "tooling/preview/sync.js",
    text: "dev-extension",
    maximum: 1,
    reason: "Repair only verified checkout-owned former installed asset links, including dangling links.",
  },
  {
    path: "tests/preview/sync.test.js",
    text: "dev-extension",
    maximum: 4,
    reason: "Isolated negative/repair fixture for the required owned former-link behavior.",
  },
  {
    path: "tests/workflows/migration-baseline.test.js",
    text: "dev-extension",
    maximum: 1,
    reason: "Map frozen historical snapshot paths to final destinations for independent byte comparison.",
  },
  {
    path: "tests/workflows/migration-baseline.test.js",
    text: "static-snapshots",
    maximum: 1,
    reason: "Same exact historical snapshot mapping; no runtime fallback.",
  },
];

/** Focused pure-contract/test interfaces retained with concrete current consumers. */
export const testInterfaces = [
  {
    path: "tooling/shared/color-math.js",
    symbol: "inGamut",
    consumer: "tests/palette/generation.test.js",
    reason: "Independent numeric gamut assertions for generated colors.",
  },
  {
    path: "tooling/tokens/formats.js",
    symbol: "semanticId",
    consumer: "tests/tokens/formats.test.js",
    reason: "Exact selector bijection contract, including compound/language-qualified selectors.",
  },
  {
    path: "tooling/tokens/data/update-details.js",
    symbol: "refreshDescription",
    consumer: "tests/tokens/data/update-details.test.js",
    reason: "Pure description history/protection matrix, independently from filesystem orchestration.",
  },
  {
    path: "tooling/tokens/data/update-details.js",
    symbol: "validateCoverage",
    consumer: "tests/tokens/data/update-details.test.js",
    reason: "Exact reviewed transition and immutable replay acceptance matrix.",
  },
  {
    path: "tooling/tokens/data/sources.js",
    symbol: "retryDelay",
    consumer: "tests/tokens/data/sources.test.js",
    reason: "Deterministic server retry-delay parsing without real waits.",
  },
];

/** Historical source snapshots are data, not executable runtime entry points. */
export const historicalFixtures = ["tests/fixtures/migration-baseline/", "tests/fixtures/upstream/"];

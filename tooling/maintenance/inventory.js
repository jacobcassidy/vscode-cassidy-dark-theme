/**
 * Executable entry-point inventory.
 * @file Declare configuration entry points and focused test interfaces for the reachability audit.
 */

/** Configuration-loaded executable roots that have no ordinary module importer. */
export const configurationRoots = ["eslint.config.js", "prettier.config.js"];

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

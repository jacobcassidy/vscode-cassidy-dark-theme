/**
 * Prepared workflow operation budgets.
 * @file Count actual shared loads, palette generation, and compilation while asserting unchanged artifact timestamps and read-only checks.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { createBuildProject, writeDefaultPaletteConfig, readBuildOutputs } from "../helpers/projects.js";
import { prepareBuild, applyBuild } from "../../tooling/themes/build.js";
import { loadTokenData } from "../../tooling/tokens/data/load.js";
import { compileTokens } from "../../tooling/tokens/compilation.js";
import { generatePalette } from "../../tooling/palette/generation.js";

test("combined/unchanged/check passes load once, compile each required target once, and reuse default palettes", async (t) => {
  /** Two targets deliberately share every independently inherited input and palette. */
  const root = await createBuildProject(t);

  await writeDefaultPaletteConfig(join(root, "src/themes/dev/inherited"));

  /** Narrow adapters count the real operations and delegate unchanged implementation behavior. */
  const counts = { loads: 0, compilations: 0, palettes: 0 };

  /** Narrow adapters counting actual workflow operations without changing their behavior. */
  const operations = {
    /**
     * Count complete checked-in shared snapshots.
     * @param options - Local snapshot options.
     */
    loadTokenData(options) {
      counts.loads++;
      return loadTokenData(options);
    },

    /**
     * Count actual compiler calls, including required default validation.
     * @param args - Actual supplied compiler inputs.
     */
    compileTokens(...args) {
      counts.compilations++;
      return compileTokens(...args);
    },

    /**
     * Count actual palette generation rather than default-palette reuse.
     * @param config - Explicit custom palette configuration.
     */
    generatePalette(config) {
      counts.palettes++;
      return generatePalette(config);
    },
  };

  await applyBuild(await prepareBuild({ root, operations }));
  assert.deepEqual(counts, { loads: 1, compilations: 2, palettes: 1 });

  /** Existing bytes and timestamps make unchanged replacements observable. */
  const before = await readBuildOutputs(root),
    timestamps = new Map();

  for (const path of before.keys()) timestamps.set(path, (await stat(join(root, path))).mtimeMs);

  for (const check of [false, true]) {
    counts.loads = counts.compilations = counts.palettes = 0;

    /** Application and checking consume exactly the same prepared map. */
    const prepared = await prepareBuild({ root, operations });

    /** Read-only checking must consume immutable prepared bytes instead of rewriting the map. */
    prepared.output.set = () => {
      throw new Error("Prepared artifact map must remain unchanged during application.");
    };

    /** Completed operation result retained for subsequent validation. */
    const result = await applyBuild(prepared, { check });

    assert.deepEqual(result.changed, []);
    assert.deepEqual(counts, { loads: 1, compilations: 2, palettes: 1 });
    assert.deepEqual(await readBuildOutputs(root), before);

    for (const [path, timestamp] of timestamps) assert.equal((await stat(join(root, path))).mtimeMs, timestamp);
  }
});

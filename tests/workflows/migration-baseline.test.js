/**
 * Independent migration oracle.
 * @file Compare every effective theme against frozen pre-refactor styling and authored records.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { discoverTargets, readTargetInput, paletteInputPath, themeSections } from "../../tooling/themes/inputs.js";
import { generatePalette } from "../../tooling/palette/generation.js";
import { compileTokens } from "../../tooling/tokens/compilation.js";

/** Repository root for the independent historical comparison. */
const root = fileURLToPath(new URL("../../", import.meta.url));

/** Frozen records captured with the original implementation, before changing readers. */
const baseline = JSON.parse(await readFile(new URL("../fixtures/migration-baseline/baseline.json", import.meta.url)));

test("all discovered targets retain independently captured styling, documentation, and fallback ownership", async () => {
  /** Current targets, compared with the complete original inventory. */
  const targets = await discoverTargets(root);

  assert.deepEqual(
    targets.map(({ group, name }) => `${group}/${name}`),
    baseline.targets.map(({ target }) => `${target.group}/${target.name}`),
  );

  /** Original default palette still supplies independently inherited target palettes. */
  const palette = generatePalette((await readTargetInput(root, targets[0], paletteInputPath)).value);

  for (const [index, target] of targets.entries()) {
    /** Original effective files and compiled records for this target. */
    const expected = baseline.targets[index];

    /** Current effective token and documentation families. */
    const tokens = {},
      details = {};

    for (const family of themeSections) {
      for (const [group, collection] of [
        ["tokens", tokens],
        ["details", details],
      ]) {
        /** Current independently selected effective file. */
        const input = await readTargetInput(root, target, `${group}/${family}.jsonc`);

        assert.equal(input.fallback, expected.inputs[`${group}/${family}.jsonc`].fallback);
        assert.deepEqual(JSON.parse(JSON.stringify(input.value)), expected.inputs[`${group}/${family}.jsonc`].value);
        collection[family] = input.value;
      }
    }

    /** Target-local palette selection, without inferred token ownership. */
    const config = (await readTargetInput(root, target, paletteInputPath)).value;

    /** Actual compilation compared to independently frozen expected records. */
    const { colors, semanticTokenColors, tokenColors } = compileTokens(
      tokens,
      details,
      config.useDefaultPalette ? palette : generatePalette(config),
      target.name === "default",
    );

    assert.deepEqual(JSON.parse(JSON.stringify({ colors, semanticTokenColors, tokenColors })), expected.compiled);
  }
});

test("preserved snapshot bytes match their independent hashes", async () => {
  for (const [path, hash] of Object.entries(baseline.snapshots)) {
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex"),
      hash,
      path,
    );
  }
});

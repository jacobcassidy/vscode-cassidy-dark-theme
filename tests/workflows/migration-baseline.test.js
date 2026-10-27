/**
 * Independent migration oracle.
 * @file Compare every effective theme against frozen pre-refactor styling and authored records.
 */

import { paletteInputPath, themeSections } from "../../tooling/shared/paths.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createScanner, SyntaxKind } from "jsonc-parser";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { discoverTargets, readTargetInput } from "../../tooling/themes/inputs.js";
import { decode } from "../../tooling/tokens/formats.js";
import { generatePalette } from "../../tooling/palette/generation.js";
import { compileTokens } from "../../tooling/tokens/compilation.js";

/** Repository root for the independent historical comparison. */
const root = fileURLToPath(new URL("../../", import.meta.url));

/** Frozen records captured with the original implementation, before changing readers. */
const baseline = JSON.parse(await readFile(new URL("../fixtures/migration-baseline/baseline.json", import.meta.url)));

/**
 * Extract comment text independently from the new codec, retaining repeated occurrences.
 * @param source - Original or migrated JSONC source.
 */
function comments(source) {
  /** Lexical scanner ignores comment-like strings inside authored values. */
  const scanner = createScanner(source, false),
    result = [];

  while (scanner.scan() !== SyntaxKind.EOF) {
    if ([SyntaxKind.LineCommentTrivia, SyntaxKind.BlockCommentTrivia].includes(scanner.getToken()))
      result.push(
        source
          .slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength())
          .replace(/\s+/g, " "),
      );
  }

  return result.sort();
}

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
        const input = await readTargetInput(
          root,
          target,
          `tokens/${family}/${group === "tokens" ? "definitions" : "details"}.jsonc`,
        );

        assert.equal(input.fallback, expected.inputs[`${group}/${family}.jsonc`].fallback);
        assert.deepEqual(comments(input.source), comments(expected.inputs[`${group}/${family}.jsonc`].source));

        /** Independently frozen records permit only the specified detail-field rename. */
        const original = JSON.parse(
          JSON.stringify(expected.inputs[`${group}/${family}.jsonc`].value).replaceAll('"for":', '"description":'),
        );

        /** Normalized family records with canonical identities and source origins. */
        const decoded = decode(input, family, group === "tokens" ? "definitions" : "details");

        assert.deepEqual(JSON.parse(JSON.stringify(decoded.value)), original);
        collection[family] = decoded.value;
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

    assert.deepEqual(
      JSON.parse(
        JSON.stringify({
          colors: colors.toSorted((a, b) => a.key.localeCompare(b.key)),
          semanticTokenColors: semanticTokenColors.toSorted((a, b) => a.key.localeCompare(b.key)),
          tokenColors,
        }),
      ),
      {
        ...expected.compiled,
        colors: expected.compiled.colors.toSorted((a, b) => a.key.localeCompare(b.key)),
        semanticTokenColors: expected.compiled.semanticTokenColors.toSorted((a, b) => a.key.localeCompare(b.key)),
      },
    );
  }
});

test("preserved snapshot bytes match their independent hashes", async () => {
  for (const [path, hash] of Object.entries(baseline.snapshots)) {
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(root, path.replace("dev-extension/static-snapshots/", "preview/snapshots/"))))
        .digest("hex"),
      hash,
      path,
    );
  }
});

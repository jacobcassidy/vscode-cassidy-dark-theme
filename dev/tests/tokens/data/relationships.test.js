/**
 * Upstream fallback relationship contracts.
 * @file Verify evidenced fallback extraction and propagation of reviewed relationships into starter themes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { extractSource } from "../../../tooling/tokens/data/extraction.js";
import { completeStarterTheme } from "../../../tooling/tokens/data/starter.js";

test("UI inheritance follows imported registrations and transforms without inventing precedence", async () => {
  /** Frozen source fixture covers imports, fallback variants, transforms, and unresolved calls. */
  const source = {
    identity: { id: "vscode-stable", kind: "core", revision: "a".repeat(40) },
    files: new Map([
      [
        "base.ts",
        Buffer.from(`
        export const base = registerColor('base.foreground', '#fff', 'Base.');
        export const fallback = registerColor('fallback.foreground', '#000', 'Fallback.');
        export const transformed = transparent(base, 0.5);
      `),
      ],
      [
        "widget.ts",
        Buffer.from(`
        import { base, fallback, transformed } from './base.js';
        export const widget = registerColor('widget.foreground', {
          dark: darken(transformed, 0.2),
          light: oneOf(fallback, base),
          hcDark: 'not.registered'
        }, 'Widget.');
        export const literal = registerColor('literal.foreground', '#fff', 'Literal.');
        export const unknown = registerColor('unknown.foreground', mystery(base), 'Unknown.');
        export const cycleA = cycleB;
        export const cycleB = cycleA;
        export const cycle = registerColor('cycle.foreground', cycleA, 'Cycle.');
      `),
      ],
    ]),
  };

  /** Relationships must come from direct, statically evidenced color dependencies. */
  const extracted = await extractSource(source);

  assert.deepEqual(extracted.ui.get("widget.foreground").inherits, ["base.foreground", "fallback.foreground"]);
  assert.equal(extracted.ui.get("literal.foreground").inherits, undefined);
  assert.equal(extracted.ui.get("unknown.foreground").inherits, undefined);
  assert.equal(extracted.ui.get("cycle.foreground").inherits, undefined);
  assert.equal(extracted.ui.get("widget.foreground").overrides, undefined);
  assert.equal(extracted.ui.get("widget.foreground").globallyOverriddenBy, undefined);
});

test("starter details retain history and relationships and honor reviewed global replacements", () => {
  /** Effective shared UI records include a reviewed complete replacement and fallback documentation. */
  const snapshot = {
    definitions: {
      ui: { records: new Map([["widget.foreground", { category: "standard" }]]) },
      semantic: { records: new Map() },
    },
    details: {
      ui: {
        records: new Map([
          [
            "widget.foreground",
            {
              value: {
                description: "Widget.",
                descriptionAddedIn: "1.2.3",
                inherits: ["foreground"],
                overrides: ["legacy.foreground"],
                globallyOverriddenBy: ["replacement.foreground"],
                "modified-desc": true,
              },
            },
          ],
        ]),
      },
      semantic: { records: new Map() },
    },
  };

  /** In-memory bootstrap output avoids changing authored theme files. */
  const output = completeStarterTheme(new Map(), snapshot);

  /** Serialized theme records must preserve metadata while omitting shared-only flags. */
  const details = JSON.parse(output.get("src/themes/prod/default/tokens/ui/details.jsonc"));
  const definitions = JSON.parse(output.get("src/themes/prod/default/tokens/ui/definitions.jsonc"));

  assert.deepEqual(details.standard.widget.foreground, {
    description: "Widget.",
    descriptionAddedIn: "1.2.3",
    inherits: ["foreground"],
    overrides: ["legacy.foreground"],
    globallyOverriddenBy: ["replacement.foreground"],
  });
  assert.equal(definitions.standard.widget.foreground.disabled, true);
  assert.match(definitions.standard.widget.foreground.disabledReason, /replacement.foreground/);
  assert.equal(definitions.standard.widget.foreground.colorReason, undefined);
});

/**
 * Generated and manual token layer contracts.
 * @file Verify effective field overrides, manual-only membership, and immutable generated authority.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { createBuildProject, writeFixture } from "../../helpers/projects.js";
import { loadTokenData } from "../../../tooling/tokens/data/load.js";

test("manual details override fields while generated descriptions remain intact", async (t) => {
  /** Complete generated fixture and exact source file candidates. */
  const root = await createBuildProject(t);

  await writeFixture(
    join(root, "src/data/tokens/generated/ui/definitions.jsonc"),
    JSON.stringify({ standard: { editor: ["background"] }, sourceCode: [], nonStandard: [], deprecated: [] }),
  );
  await writeFixture(
    join(root, "src/data/tokens/generated/ui/details.jsonc"),
    JSON.stringify({
      standard: { editor: { background: { description: "Generated.", inherits: ["editor.foreground"] } } },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    }),
  );
  await writeFixture(
    join(root, "src/data/tokens/manual/ui/details.jsonc"),
    JSON.stringify({
      standard: { editor: { background: { description: "Authored." } } },
      sourceCode: {},
      nonStandard: {},
      deprecated: {},
    }),
  );

  /** Effective details combine layer fields without mutating the generated record. */
  const snapshot = await loadTokenData({ root });

  assert.equal(snapshot.details.ui.records.get("editor.background").value.description, "Authored.");
  assert.deepEqual(snapshot.details.ui.records.get("editor.background").value.inherits, ["editor.foreground"]);
  assert.equal(snapshot.generated.details.ui.records.get("editor.background").value.description, "Generated.");
});

test("manual nonstandard additions require attribution and cannot duplicate generated definitions", async (t) => {
  /** Independent generated fixture for manual membership validation. */
  const root = await createBuildProject(t),
    definitionPath = join(root, "src/data/tokens/manual/semantic/definitions.jsonc"),
    detailPath = join(root, "src/data/tokens/manual/semantic/details.jsonc");

  await writeFixture(
    definitionPath,
    JSON.stringify({ standard: [], sourceCode: [], nonStandard: ["custom"], deprecated: [] }),
  );
  await assert.rejects(loadTokenData({ root }), /matching detail with source attribution/);

  await writeFixture(
    detailPath,
    JSON.stringify({
      standard: {},
      sourceCode: {},
      nonStandard: { custom: { description: "Custom.", source: ["Example.extension"] } },
      deprecated: {},
    }),
  );

  assert.ok((await loadTokenData({ root })).definitions.semantic.records.has("custom"));

  await writeFixture(
    join(root, "src/data/tokens/generated/semantic/definitions.jsonc"),
    JSON.stringify({ standard: [], sourceCode: [], nonStandard: ["custom"], deprecated: [] }),
  );

  await assert.rejects(loadTokenData({ root }), /duplicate semantic definition custom/);
});

test("manual sourceCode additions require reviewed immutable classification evidence", async (t) => {
  /** Separate authored definition and detail candidates. */
  const root = await createBuildProject(t),
    definitionPath = join(root, "src/data/tokens/manual/semantic/definitions.jsonc"),
    detailPath = join(root, "src/data/tokens/manual/semantic/details.jsonc");

  await writeFixture(
    definitionPath,
    JSON.stringify({ standard: [], sourceCode: ["embedded"], nonStandard: [], deprecated: [] }),
  );
  await assert.rejects(loadTokenData({ root }), /requires reviewed classificationEvidence/);

  /** Reviewed record ties the category to one immutable source file. */
  const detail = {
    standard: {},
    sourceCode: {
      embedded: {
        description: "Embedded language.",
        classificationEvidence: {
          inputId: "vscode-stable",
          revision: "a".repeat(40),
          path: "src/language/embedded.ts",
          reason: "Verified registration and use in the host language.",
        },
      },
    },
    nonStandard: {},
    deprecated: {},
  };

  await writeFixture(detailPath, JSON.stringify(detail));
  assert.ok((await loadTokenData({ root })).definitions.semantic.records.has("embedded"));

  detail.sourceCode.embedded.classificationEvidence.path = "../outside.ts";
  await writeFixture(detailPath, JSON.stringify(detail));
  await assert.rejects(loadTokenData({ root }), /must be source-relative/);
});

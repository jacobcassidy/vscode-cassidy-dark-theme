/**
 * Missing theme property tests.
 * @file Verify alphabetical placeholders, comment preservation, source isolation, and validation before writes.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { addThemeProperties } from "../scripts/themes/add-properties.js";
import { buildProdThemes } from "../scripts/themes/build.js";
import { parseJsonc } from "../scripts/lib/jsonc-validation.js";
import { createBuildProject, readBuildOutputs, readThemeParts, writeDefaultPaletteConfig } from "./test-projects.js";

/**
 * Write a reference using deliberately irrelevant values and metadata.
 * @param root - Temporary project root.
 * @param colors - Workbench reference keys and values.
 * @param semanticTokenColors - Semantic reference keys and values.
 */
async function writeReference(root, colors, semanticTokenColors) {
  await mkdir(join(root, "docs/templates"), { recursive: true });
  await writeFile(
    join(root, "docs/templates/all-ui-tokens.json"),
    `// Template comments must be accepted.\n${JSON.stringify({ colors })}\n`,
  );
  await writeFile(
    join(root, "docs/templates/all-semantic-tokens.json"),
    `// Template comments must be accepted.\n${JSON.stringify({ semanticTokenColors })}\n`,
  );
}

/**
 * Create a complete default theme, an inheriting dev theme, and a small reference.
 * @param t - Node.js test context responsible for fixture cleanup.
 * @returns Temporary project root.
 */
async function createPropertyProject(t) {
  /** Isolated project with valid palette, token, and details inputs. */
  const root = await createBuildProject(t);

  await writeDefaultPaletteConfig(join(root, "src/themes/dev/test"));
  await writeReference(root, { "new.background": "#f0f" }, { "*.readonly:typescript": "#f00" });
  await writeFile(join(root, ".prettierrc.json"), JSON.stringify({ printWidth: 1, trailingComma: "none" }));

  for (const section of ["base", "ui", "semantic", "syntax"]) {
    await writeFile(join(root, `src/themes/prod/default/details/${section}.jsonc`), "{}");
  }

  return root;
}

/**
 * Read a token source with duplicate-key validation.
 * @param root - Temporary project root.
 * @param theme - Theme group/name identifier.
 * @param section - UI or semantic source section.
 * @returns Original source and its parsed value.
 */
async function readSection(root, theme, section) {
  /** Source path used in diagnostics and file reads. */
  const path = join(root, `src/themes/${theme}/tokens/${section}.jsonc`);

  /** Source text retained for comment and unchanged-file assertions. */
  const source = await readFile(path, "utf8");

  return { source, value: JSON.parse(JSON.stringify(parseJsonc(source, path).value)) };
}

/**
 * Snapshot every fixture file to detect any writes after validation failures.
 * @param root - Temporary project root.
 * @returns Path/content pairs for every file in the fixture.
 */
async function snapshot(root) {
  /** File paths returned recursively, including entries in nested source directories. */
  const paths = await readdir(root, { recursive: true, withFileTypes: true });

  return Promise.all(
    paths
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        /** Absolute fixture file path. */
        const path = join(entry.parentPath, entry.name);

        return [path, await readFile(path, "utf8")];
      }),
  );
}

test("missing UI and semantic properties are inserted alphabetically while values and comments survive", async (t) => {
  /** Fixture used to exercise insertion at every position in both source sections. */
  const root = await createPropertyProject(t);

  await writeReference(
    root,
    {
      "zeta.foreground": "#f00",
      "middle.foreground": "#f00",
      "beta.foreground": "#f00",
      "Alpha.foreground": "#f00",
      "delta.foreground": "#f00",
    },
    { zebra: "#f00", variable: "#f00", class: "#f00", method: "#f00", "*.readonly": "#f00" },
  );

  await writeFile(
    join(root, "src/themes/prod/default/tokens/ui.jsonc"),
    `{
  // Beta leading explanation.
  "beta.foreground": {"color": "palette.gray.900"}, // Beta inline explanation.
  // Middle leading explanation.
  "middle.foreground": {"disabled": true, "disabledReason": "Keep disabled."}, // Middle inline explanation.
  "omega.foreground": {"color": "ui.beta.foreground"} // Omega inline explanation.
}
`,
  );

  await writeFile(
    join(root, "src/themes/prod/default/tokens/semantic.jsonc"),
    `{
  // Class leading explanation.
  "class": {"bold": true}, /* Class inline explanation. */
  // Variable leading explanation.
  "variable": {"disabled": true, "disabledReason": "Intentionally omitted."} // Variable inline explanation.
}
`,
  );

  /** All files before adding properties, including unrelated source and metadata files. */
  const before = new Map(await snapshot(root));

  /** Per-section counts and added keys returned by the command's testable entry point. */
  const result = await addThemeProperties({ root, themes: ["prod/default"] });

  /** Updated UI entries and comments. */
  const ui = await readSection(root, "prod/default", "ui");

  /** Updated semantic entries and comments. */
  const semantic = await readSection(root, "prod/default", "semantic");

  assert.deepEqual(Object.keys(ui.value), [
    "Alpha.foreground",
    "beta.foreground",
    "delta.foreground",
    "middle.foreground",
    "omega.foreground",
    "zeta.foreground",
  ]);

  assert.deepEqual(Object.keys(semantic.value), ["*.readonly", "class", "method", "variable", "zebra"]);
  assert.deepEqual(ui.value["beta.foreground"], { color: "palette.gray.900" });
  assert.deepEqual(ui.value["middle.foreground"], { disabled: true, disabledReason: "Keep disabled." });
  assert.deepEqual(ui.value["omega.foreground"], { color: "ui.beta.foreground" });
  assert.deepEqual(semantic.value.class, { bold: true });
  assert.deepEqual(semantic.value.variable, { disabled: true, disabledReason: "Intentionally omitted." });
  assert.match(ui.source, /\/\/ Beta leading explanation\.\s+"beta\.foreground"/);
  assert.match(ui.source, /}, \/\/ Beta inline explanation\.\s+"delta\.foreground"/);
  assert.match(ui.source, /\/\/ Middle leading explanation\.\s+"middle\.foreground"/);
  assert.match(ui.source, /}, \/\/ Middle inline explanation\.\s+"omega\.foreground"/);
  assert.match(ui.source, /}, \/\/ Omega inline explanation\.\s+"zeta\.foreground"/);
  assert.match(semantic.source, /\/\/ Class leading explanation\.\s+"class"/);
  assert.match(semantic.source, /} \/\* Class inline explanation\. \*\/,\s+"method"/);
  assert.match(semantic.source, /\/\/ Variable leading explanation\.\s+"variable"/);
  assert.match(semantic.source, /}, \/\/ Variable inline explanation\.\s+"zebra"/);

  for (const update of result.filter((update) => ["ui", "semantic"].includes(update.section))) {
    assert.equal(update.added.length, 3);

    for (const key of update.added) {
      assert.deepEqual((update.section === "ui" ? ui : semantic).value[key], {
        color: "#0ff",
        colorReason: "UNREVIEWED: Added from a token template; choose an intentional color.",
      });
    }
  }

  for (const [path, source] of await snapshot(root)) {
    if (!result.some((update) => join(root, update.path) === path)) assert.equal(source, before.get(path));
  }

  /** Fully formatted source timestamps, which must not change on repeated runs. */
  const timestamps = await Promise.all(result.map(async (update) => (await stat(join(root, update.path))).mtimeMs));

  assert.ok((await addThemeProperties({ root, themes: ["prod/default"] })).every((update) => !update.added.length));
  assert.equal((await readSection(root, "prod/default", "ui")).source, ui.source);
  assert.equal((await readSection(root, "prod/default", "semantic")).source, semantic.source);
  assert.deepEqual(
    await Promise.all(result.map(async (update) => (await stat(join(root, update.path))).mtimeMs)),
    timestamps,
  );

  await buildProdThemes({ root });

  /** Generated theme proving that the new literal descriptors compile successfully. */
  const output = parseJsonc(await readFile(join(root, "themes/cassidy-dark-color-theme.json"), "utf8"), "output").value;

  assert.equal(output.colors["Alpha.foreground"], "#0ff");
  assert.equal(output.semanticTokenColors["*.readonly"].foreground, "#0ff");
});

test("inherited inputs are copied only into selected themes and only when additions are needed", async (t) => {
  /** Fixture with a dev theme inheriting both token sections. */
  const root = await createPropertyProject(t);

  /** Complete fixture snapshot before the dev-only update. */
  const before = new Map(await snapshot(root));

  /** Effective default-backed entries before any local copies are created. */
  const original = await readSection(root, "prod/default", "ui");

  await addThemeProperties({ root, themes: ["dev/test"] });

  /** Local source combines all inherited entries with the missing placeholder. */
  const local = await readSection(root, "dev/test", "ui");

  assert.equal(local.value["new.background"].color, "#0ff");

  for (const [key, value] of Object.entries(original.value)) {
    assert.deepEqual(local.value[key], value);
  }

  for (const [path, source] of before) {
    assert.equal(await readFile(path, "utf8"), source);
  }

  await rm(join(root, "src/themes/dev/test/tokens"), { recursive: true });
  await writeReference(root, { "editor.background": "#f0f" }, { variable: "#f00" });
  assert.ok((await addThemeProperties({ root, themes: ["dev/test"] })).every((update) => !update.added.length));
  await assert.rejects(stat(join(root, "src/themes/dev/test/tokens")), { code: "ENOENT" });
});

test("the initial allowlist updates both themes from their original effective inputs", async (t) => {
  /** Fixture with prod and dev selected by the script's built-in allowlist. */
  const root = await createPropertyProject(t);

  /** Both groups must receive additions even though the dev theme inherits the default. */
  const result = await addThemeProperties({ root });

  assert.deepEqual(
    result.filter((update) => ["ui", "semantic"].includes(update.section)).map((update) => update.theme),
    ["prod/default", "prod/default", "dev/test", "dev/test"],
  );

  assert.ok(
    result.filter((update) => ["ui", "semantic"].includes(update.section)).every((update) => update.added.length === 1),
  );
  assert.deepEqual(
    (await readSection(root, "dev/test", "ui")).value,
    (await readSection(root, "prod/default", "ui")).value,
  );
});

test("insertion handles empty objects, compact objects, trailing commas, and trailing comments", async (t) => {
  for (const source of [
    "{}",
    "{ /* Empty section explanation. */ }",
    '{"middle": {"bold":true}}',
    '{"middle": {"bold":true},}',
    '{\n"middle": {"bold":true}, // Inline explanation.\n// Closing explanation.\n}',
  ]) {
    await t.test(source, async (t) => {
      /** Independent project for each punctuation and comment layout. */
      const root = await createPropertyProject(t);

      await writeReference(root, {}, { zebra: "#f00", alpha: "#f00" });
      await writeFile(join(root, "src/themes/prod/default/tokens/semantic.jsonc"), source);
      await addThemeProperties({ root, themes: ["prod/default"] });

      /** Parsed and formatted section after insertion. */
      const updated = await readSection(root, "prod/default", "semantic");

      assert.deepEqual(
        Object.keys(updated.value),
        source.includes('"middle"') ? ["alpha", "middle", "zebra"] : ["alpha", "zebra"],
      );

      if (source.includes("Empty section explanation."))
        assert.match(updated.source, /\/\* Empty section explanation\. \*\//);

      if (source.includes("Inline explanation.")) {
        assert.match(updated.source, /}, \/\/ Inline explanation\.\s+"zebra"/);
        assert.match(updated.source, /\/\/ Closing explanation\./);
      }
    });
  }
});

test("unknown targets and malformed references or later source inputs fail before writing", async (t) => {
  for (const failure of [
    "target",
    "reference",
    "reference shape",
    "reference duplicates",
    "source",
    "source shape",
    "source duplicates",
    "details",
    "details shape",
    "details duplicates",
    "catalog",
    "catalog shape",
    "catalog entry",
    "syntax shape",
    "syntax IDs",
  ]) {
    await t.test(failure, async (t) => {
      /** Complete project with an intentionally invalid input for this scenario. */
      const root = await createPropertyProject(t);

      if (failure.startsWith("reference")) {
        await writeFile(
          join(root, "docs/templates/all-ui-tokens.json"),
          failure === "reference"
            ? "{"
            : failure === "reference shape"
              ? '{"colors":[]}'
              : '{"colors":{"a":"#f00","a":"#0ff"}}',
        );
      }

      if (failure.startsWith("source")) {
        await writeFile(
          join(root, "src/themes/prod/default/tokens/semantic.jsonc"),
          failure === "source" ? "{" : failure === "source shape" ? "[]" : '{"class":{},"class":{}}',
        );
      }

      if (failure.startsWith("details")) {
        await writeFile(
          join(root, "src/themes/prod/default/details/syntax.jsonc"),
          failure === "details" ? "{" : failure === "details shape" ? "[]" : '{"string":{},"string":{}}',
        );
      }

      if (failure.startsWith("catalog")) {
        await writeFile(
          join(root, "docs/references/lookups/token-details.jsonc"),
          failure === "catalog" ? "{" : failure === "catalog shape" ? "[]" : '{"ui":{"new.background":[]}}',
        );
      }

      if (failure.startsWith("syntax")) {
        await writeFile(
          join(root, "src/themes/prod/default/tokens/syntax.jsonc"),
          failure === "syntax shape" ? "[null]" : '[{"id":"string"},{"id":"string"}]',
        );
      }

      /** Snapshot after introducing invalid input but before invoking the updater. */
      const before = await snapshot(root);

      await assert.rejects(
        addThemeProperties({ root, themes: failure === "target" ? ["prod/default", "dev/unknown"] : ["prod/default"] }),
      );

      assert.deepEqual(await snapshot(root), before);
    });
  }
});

test("default details cover nested roles, disabled tokens, new reference keys, and every syntax rule", async (t) => {
  /** Fixture with existing details, missing descriptions, and unnamed syntax rules. */
  const root = await createPropertyProject(t);

  /** Original token values retained for assertions about styling and rule order. */
  const parts = await readThemeParts(join(root, "src/themes/prod/default"));

  parts.tokens.base.surface.extra = { color: "palette.gray.900" };
  parts.tokens.ui["retained.disabled"] = { disabled: true, disabledReason: "Use the default styling." };
  parts.tokens.syntax.push(
    { name: "String", scope: "string.one", fontStyle: "bold" },
    { name: "String", scope: ["string.two"], disabled: true, disabledReason: "Disabled rule." },
    { fontStyle: "italic" },
  );

  for (const section of ["base", "ui", "syntax"]) {
    await writeFile(
      join(root, `src/themes/prod/default/tokens/${section}.jsonc`),
      JSON.stringify(parts.tokens[section]),
    );
  }

  await writeFile(
    join(root, "src/themes/prod/default/details/ui.jsonc"),
    `{
      // Reviewed description and relationships must survive.
      "editor.background": {"for":"Keep this reviewed usage.","inherits":["upstream.surface"]},
      "editor.foreground": {"inherits":["upstream.text"]} // Keep the inline explanation.
    }`,
  );
  await writeFile(
    join(root, "docs/references/lookups/token-details.jsonc"),
    JSON.stringify({
      ui: {
        "editor.background": { for: "Do not overwrite the reviewed usage." },
        "editor.foreground": { for: "Reviewed editor text purpose." },
        "new.background": { for: "Reviewed new widget background." },
      },
      semantic: { "*.readonly:typescript": { for: "Read-only TypeScript symbols." } },
    }),
  );

  await addThemeProperties({ root, themes: ["prod/default"] });

  /** Complete source snapshot after token additions and detail generation. */
  const updated = await readThemeParts(join(root, "src/themes/prod/default"));

  assert.deepEqual(updated.details.ui["editor.background"], {
    for: "Keep this reviewed usage.",
    inherits: ["upstream.surface"],
  });
  assert.deepEqual(updated.details.ui["editor.foreground"], {
    for: "Reviewed editor text purpose.",
    inherits: ["upstream.text"],
  });
  assert.equal(updated.details.ui["new.background"].for, "Reviewed new widget background.");
  assert.equal(updated.details.semantic["*.readonly:typescript"].for, "Read-only TypeScript symbols.");
  assert.match(updated.details.ui["retained.disabled"].for, /^UNREVIEWED:/);
  assert.equal(updated.details.base["surface.extra"].for, "Shared surface extra color role.");
  assert.deepEqual(
    updated.tokens.syntax.map((rule) => rule.id),
    ["string", "string-2", "string-3", "rule-4"],
  );
  assert.deepEqual(
    updated.tokens.syntax.map((rule) => ({ ...rule, id: undefined })),
    parts.tokens.syntax.map((rule) => ({ ...rule, id: undefined })),
  );

  for (const rule of updated.tokens.syntax) {
    assert.ok(updated.details.syntax[rule.id].for.trim());
  }

  /** Comment-bearing detail text after insertion and updates to existing entries. */
  const source = await readFile(join(root, "src/themes/prod/default/details/ui.jsonc"), "utf8");

  assert.match(source, /\/\/ Reviewed description and relationships must survive\./);
  assert.match(source, /\/\/ Keep the inline explanation\./);

  /** No input files or timestamps should change after a complete run. */
  const before = await snapshot(root);

  assert.ok((await addThemeProperties({ root, themes: ["prod/default"] })).every((update) => !update.added.length));
  assert.deepEqual(await snapshot(root), before);
  await buildProdThemes({ root });
});

for (const section of ["base", "ui", "semantic", "syntax", "syntax ID", "description", "disabled"]) {
  test(`default builds reject missing ${section} documentation before writing outputs`, async (t) => {
    /** Complete default fixture with a successful output snapshot. */
    const root = await createBuildProject(t);

    await buildProdThemes({ root });

    /** Last successful artifacts must remain intact when documentation validation fails. */
    const before = await readBuildOutputs(root);

    if (section === "syntax ID") {
      await writeFile(
        join(root, "src/themes/prod/default/tokens/syntax.jsonc"),
        '[{"scope":"string","color":"palette.yellow.400"}]',
      );
    } else if (section === "description") {
      await writeFile(
        join(root, "src/themes/prod/default/details/base.jsonc"),
        '{"surface.editor":{"inherits":["upstream.background"]}}',
      );
    } else if (section === "disabled") {
      await writeFile(
        join(root, "src/themes/prod/default/tokens/ui.jsonc"),
        '{"editor.background":{"disabled":true,"disabledReason":"Default background."}}',
      );
      await writeFile(join(root, "src/themes/prod/default/details/ui.jsonc"), "{}");
    } else {
      await writeFile(join(root, `src/themes/prod/default/details/${section}.jsonc`), "{}");
    }

    await assert.rejects(buildProdThemes({ root }), /missing property details|require an id|for: expected a nonempty/);
    assert.deepEqual(await readBuildOutputs(root), before);
  });
}

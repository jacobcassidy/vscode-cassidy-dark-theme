/**
 * ESLint configuration.
 * @file Configure JavaScript lint rules, import checks, globals, and ignored paths.
 *
 * @author CassidyDC <info@cassidydc.com>
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @version 1.0.0
 */

import globals from "globals";
import js from "@eslint/js";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import { fileURLToPath } from "node:url";
import { importX } from "eslint-plugin-import-x";

/** Absolute path to repository ignore rules imported by ESLint. */
const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

/**
 * JavaScript rules and import validation applied to the checkout.
 * @type {import("eslint").Linter.Config[]}
 */
export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  globalIgnores(["**/*.min.js", "docs", "samples/grammar"]),
  {
    plugins: {
      "import-x": importX,
      js,
    },
    extends: [
      "import-x/recommended",
      "js/recommended",
    ],
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedInlineConfigs: "error",
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-unused-vars": ["error", { args: "all", argsIgnorePattern: "^_", caughtErrors: "all" }],
      yoda: ["warn", "never"],
    },
  },
]);

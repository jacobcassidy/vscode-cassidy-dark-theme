/**
 * ESLint configuration.
 *
 * @author CassidyDC <info@cassidydc.com>
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @type {import("eslint").Linter.Config[]}
 * @version 1.0.0
 */

import globals from "globals";
import js from "@eslint/js";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import { fileURLToPath } from "node:url";
import { importX } from "eslint-plugin-import-x";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  globalIgnores(["**/*.min.js", "docs"]),
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
        ...globals.browser,
      },
    },
    linterOptions: {
      reportUnusedInlineConfigs: "warn",
    },
    rules: {
      "no-unused-vars": "warn",
      yoda: ["warn", "never"],
    },
  },
]);

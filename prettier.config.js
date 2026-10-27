/**
 * Prettier configuration.
 * @file Configure formatting, multiline arrays, and JSON-specific layout overrides.
 *
 * @author CassidyDC <info@cassidydc.com>
 * @see https://prettier.io/docs/configuration
 * @version 1.0.0
 */

/**
 * Shared formatter settings and JSON-specific overrides.
 *
 * @type {import("prettier").Config}
 */
const config = {
  printWidth: 120,
  plugins: ["prettier-plugin-multiline-arrays"], // Keeps arrays formatted as is by default
  overrides: [
    {
      files: "*.{json,jsonc,json5}",
      options: {
        // Always put object properties and array items on a newline
        printWidth: 1,
        bracketSpacing: false,
        trailingComma: "none",
      },
    },
  ],
};
export default config;

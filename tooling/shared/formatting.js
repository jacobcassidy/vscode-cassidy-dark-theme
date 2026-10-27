/**
 * Authored JSONC formatting.
 * @file Format prepared source candidates through the repository's local settings without writing them.
 */

import { join } from "node:path";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";

/**
 * Format one authored JSONC candidate with local repository settings.
 * @param root - Checkout or fixture root.
 * @param path - Repository-relative source filename.
 * @param source - Prepared complete source.
 */
export async function formatSource(root, path, source) {
  /** Absolute formatter path and resolved local configuration. */
  const filepath = join(root, path),
    options = await prettier.resolveConfig(filepath);
  return prettier.format(source, { ...options, filepath, parser: "jsonc" });
}

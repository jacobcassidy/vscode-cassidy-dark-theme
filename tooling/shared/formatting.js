/**
 * Repository source formatting.
 * @file Format authored and generated candidates with local settings, preserving SVG and plain-text artifacts.
 */

import { join } from "node:path";
// Prettier's generated entry point hides its default export from the import resolver.
// eslint-disable-next-line import-x/default
import prettier from "prettier";

/**
 * Format one source candidate, using JSONC for authored inputs and generated themes.
 * @param root - Checkout or fixture root.
 * @param path - Repository-relative source filename.
 * @param source - Prepared complete source.
 */
export async function formatSource(root, path, source) {
  if (path.endsWith(".svg") || path.endsWith(".txt")) return source;

  /** Absolute formatter path and resolved local configuration. */
  const filepath = join(root, path),
    options = await prettier.resolveConfig(filepath);

  /** Theme JSON includes comments; other JSON and Markdown use their inferred parsers. */
  const jsonc = path.endsWith(".jsonc") || path.startsWith("themes/") || path.startsWith("preview/themes/");

  return prettier.format(source, { ...options, filepath, ...(jsonc ? { parser: "jsonc" } : {}) });
}

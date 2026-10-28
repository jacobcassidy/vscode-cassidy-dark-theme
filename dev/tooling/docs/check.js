/**
 * Maintained documentation validation.
 * @file Check local Markdown links/anchors and complete JSONC examples against local schemas/codecs without writes or networking.
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import MarkdownIt from "markdown-it";
import Ajv from "ajv";
import { parseFormat } from "../tokens/formats.js";
import { repositoryRoot, tokenDataPaths } from "../shared/paths.js";

/** Default strict scope excludes historical plans, snapshots, and dated reference artifacts. */
const maintained = [
  "README.md",
  "src/data/tokens/README.md",
  "dev/docs/guides/development-guide.md",
  "dev/docs/references/hex-opacity.md",
];

/**
 * Build GitHub-style heading/explicit-anchor IDs from parsed Markdown tokens.
 * @param tokens - Markdown parser tokens.
 */
function anchors(tokens) {
  /** Resolved IDs and duplicate-heading suffix counters. */
  const result = new Set(),
    counts = new Map();

  for (const [index, token] of tokens.entries()) {
    if (token.type === "heading_open") {
      /** Plain inline heading content excludes Markdown formatting punctuation. */
      const text = (tokens[index + 1]?.children ?? [])
        .map((child) => (child.type === "html_inline" ? "" : child.content))
        .join("");

      /** Registered semantic type description, or the wildcard type description. */
      const base = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s/g, "-");

      /** Previously observed duplicate heading count used for its unique anchor. */
      const count = counts.get(base) ?? 0;

      result.add(`${base}${count ? `-${count}` : ""}`);
      counts.set(base, count + 1);
    }

    if (["html_inline", "html_block"].includes(token.type)) {
      for (const match of token.content.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
    }

    for (const child of token.children ?? []) {
      if (child.type === "html_inline") {
        for (const match of child.content.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
      }
    }
  }

  return result;
}

/**
 * Validate maintained documentation links and complete inline JSONC examples.
 * @param [options] - Read-only checker options.
 * @param [options.root] - Checkout or isolated fixture root.
 * @param [options.files] - Explicit maintained Markdown inputs for focused tests.
 * @param [options.schemaDirectory] - Local schema directory; defaults to this checkout's bundled schemas.
 */
export async function checkDocs({
  root = repositoryRoot,
  files = maintained,
  schemaDirectory = join(repositoryRoot, "dev/tooling/tokens/schemas"),
} = {}) {
  /** Local parser/validator and per-pass document/schema caches. */
  const markdown = new MarkdownIt({ html: true }),
    ajv = new Ajv({ strict: false }),
    documents = new Map(),
    schemas = new Map();

  /** Read-only audit findings accumulated before reporting failure. */
  const failures = [];

  /**
   * Parse a local document once, retaining headings and source line information.
   * @param path - Absolute Markdown filename.
   */
  async function document(path) {
    if (!documents.has(path)) {
      /** Read-only Markdown source and full parsed tokens. */
      const source = await readFile(path, "utf8"),
        tokens = markdown.parse(source, {});
      documents.set(path, { source, tokens, anchors: anchors(tokens) });
    }

    return documents.get(path);
  }

  /**
   * Validate one complete JSONC example with the same codec and editor schema.
   * @param source - Example source.
   * @param path - Diagnostic label.
   * @param family - Token family.
   * @param kind - definitions or details.
   * @param shared - Whether shared-only metadata is accepted.
   */
  async function example(source, path, family, kind, shared) {
    /** Local schema filename follows the repository's explicit shared/theme family contracts. */
    const name = `${family === "variables" ? "" : shared ? "shared-" : "theme-"}${family}-${kind}`;

    if (!schemas.has(name))
      schemas.set(name, ajv.compile(JSON.parse(await readFile(join(schemaDirectory, `${name}.schema.json`), "utf8"))));

    /** The codec catches source-level ambiguity and semantic history/order constraints. */
    const decoded = parseFormat(source, path, family, kind, { shared }),
      validate = schemas.get(name);

    if (!validate(decoded.input.value))
      throw new Error(`${path}: schema validation failed: ${ajv.errorsText(validate.errors)}`);
  }

  for (const file of files) {
    /** Complete maintained document; archived targets are checked for existence but never traversed. */
    const path = resolve(root, file),
      parsed = await document(path);

    for (const token of parsed.tokens) {
      for (const item of [token, ...(token.children ?? [])]) {
        /** Actual Markdown link/image destinations, including resolved reference links. */
        const destination = item.attrGet("href") ?? item.attrGet("src");

        if (!destination || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination)) continue;

        try {
          /** URI-decoded local destination and optional heading/explicit anchor. */
          const [pathname, fragment] = destination.split("#"),
            target = pathname
              ? resolve(
                  pathname.startsWith("/") ? root : dirname(path),
                  decodeURIComponent(pathname.split("?")[0].replace(/^\//, "")),
                )
              : path;

          if (relative(resolve(root), target).startsWith("..")) throw new Error("local link escapes the checkout");

          /** Files and directories are both valid maintained links. */
          const entry = await stat(target);

          if (
            fragment &&
            extname(target).toLowerCase() === ".md" &&
            !(await document(target)).anchors.has(decodeURIComponent(fragment))
          )
            throw new Error(`missing anchor #${fragment}`);

          if (fragment && entry.isDirectory()) throw new Error("directory links cannot resolve heading anchors");
        } catch (error) {
          failures.push(`${file}:${(token.map?.[0] ?? 0) + 1}: ${destination}: ${error.message}`);
        }
      }

      if (token.type !== "fence" || token.info.trim() !== "jsonc") continue;

      /** Complete example markers are explicit; partial excerpts require a deliberate exemption marker. */
      const before = parsed.source.split("\n").slice(0, token.map[0]).slice(-3).join("\n");

      /** Explicit complete-example contract preceding this JSONC fence. */
      const marker = before.match(
        /<!-- token-example: (ui|semantic|syntax|variables) (definitions|details) (theme|shared) -->/,
      );

      if (!marker) {
        if (!before.includes("<!-- partial-jsonc -->"))
          failures.push(
            `${file}:${token.map[0] + 1}: JSONC fence needs a complete token-example contract or explicit partial-jsonc marker`,
          );

        continue;
      }

      try {
        await example(token.content, `${file}:${token.map[0] + 1}`, marker[1], marker[2], marker[3] === "shared");
      } catch (error) {
        failures.push(error.message);
      }
    }
  }

  if (root === repositoryRoot && files === maintained) {
    for (const path of tokenDataPaths) {
      /** Every shared opening header keeps its required final updater instruction and provenance/license. */
      const source = await readFile(join(root, path), "utf8"),
        header = source.slice(0, source.indexOf("\n{"));

      if (
        !header.startsWith("// Shared ") ||
        !header.trimEnd().endsWith("// Updater (run from the repository root): npm run refresh") ||
        !header.includes("Microsoft Corporation") ||
        !header.includes("Upstream inputs last processed:")
      )
        failures.push(`${path}: incomplete shared purpose/provenance/license/updater header`);
    }
  }

  if (failures.length) throw new Error(failures.join("\n"));

  return { documents: files.length };
}

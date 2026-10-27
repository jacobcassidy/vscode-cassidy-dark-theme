/**
 * JSONC parsing and validation.
 * @file Parse comment-bearing JSON with source diagnostics and validate basic configuration values.
 */

import { getNodeValue, parseTree, printParseErrorCode } from "jsonc-parser";

/**
 * Require a non-null object that is not an array.
 *
 * @param value - Configuration value expected to be a non-null, non-array object.
 * @param label - Human-readable context included in validation diagnostics.
 */
export function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: expected an object`);
  }
}

/**
 * Reject object properties outside an explicitly allowed field list.
 *
 * @param value - Configuration object whose property names are checked against the allowed list.
 * @param allowed - Object property names accepted by this configuration schema.
 * @param label - Human-readable context included in validation diagnostics.
 */
export function fields(value, allowed, label) {
  object(value, label);

  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label}: unknown field ${key}`);
    }
  }
}

/**
 * Require a finite numeric value within inclusive bounds.
 *
 * @param value - Candidate numeric configuration value checked against the inclusive bounds.
 * @param minimum - Inclusive lower numeric bound.
 * @param maximum - Inclusive upper numeric bound.
 * @param label - Human-readable context included in validation diagnostics.
 */
export function number(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label}: expected a finite number in ${minimum}–${maximum}`);
  }
}

/**
 * Parse JSONC, reject duplicate keys, and report errors with file labels and line/column locations.
 *
 * @param text - JSONC source text, including supported comments and trailing commas.
 * @param label - Human-readable context included in validation diagnostics.
 * @returns The parsed value and its comment-preserving syntax tree.
 */
export function parseJsonc(text, label) {
  /** Syntax diagnostics collected by the JSONC parser. */
  const errors = [];

  /** JSONC syntax tree retained for duplicate-key and source-edit checks. */
  const tree = parseTree(text, errors, { allowTrailingComma: true });

  /**
   * Throw a parse error with the source position derived from a character offset.
   *
   * @param message - Diagnostic or log message to record.
   * @param offset - Zero-based character offset within the original source.
   */
  function fail(message, offset) {
    /** Source lines preceding an error offset, used to calculate its position. */
    const before = text.slice(0, offset).split("\n");
    throw new Error(`${label}:${before.length}:${before.at(-1).length + 1}: ${message}`);
  }

  if (errors.length) {
    /** First parser diagnostic reported to the caller. */
    const error = errors[0];
    fail(printParseErrorCode(error.error), error.offset);
  }

  if (!tree) {
    fail("expected a JSONC value", 0);
  }

  /**
   * Walk the JSONC syntax tree and reject repeated keys within each object.
   *
   * @param node - JSONC syntax-tree node to inspect recursively.
   */
  function check(node) {
    if (node.type === "object") {
      /** Property names already encountered in the current object. */
      const keys = new Set();

      for (const property of node.children ?? []) {
        /** Property-name node checked against earlier siblings. */
        const key = property.children[0];

        if (keys.has(key.value)) {
          fail(`duplicate key ${key.value}`, key.offset);
        }

        keys.add(key.value);
      }
    }

    for (const child of node.children ?? []) {
      check(child);
    }
  }

  check(tree);

  return { value: getNodeValue(tree), tree };
}

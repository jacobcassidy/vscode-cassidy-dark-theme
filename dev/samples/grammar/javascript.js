#!/usr/bin/env node

/**
 * JavaScript grammar samples.
 * @file Provide ES module, literal, JSDoc, class, operator, and async syntax probes for theme inspection.
 *
 * Open in VS Code with language mode JavaScript and a Cassidy Dark Preview theme.
 * Use Developer: Inspect Editor Tokens and Scopes on declarations and usages.
 * Compare semantic highlighting enabled and disabled to inspect both layers.
 * JSX, TypeScript annotations, and proposal-only decorators need other grammars.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript
 */

/* eslint no-unused-vars: "off" -- Independent highlighting examples include unused bindings. */

"use strict";

import assert from "node:assert/strict";
import * as path from "node:path";
import { readFile as readText } from "node:fs/promises";

// A line comment: TODO inspect keywords such as const, class, and return here.
/* A block comment: "strings", /regex/, ${interpolation}, and <tags> stay comments. */

/**
 * @typedef {Object} Swatch
 * @property {string} name - Human-readable name.
 * @property {`#${string}`} color - Hexadecimal color string.
 * @property {number} [opacity=1] - Optional alpha channel.
 */

/** @typedef {"dark" | "light"} ThemeMode */

/**
 * @callback Formatter
 * @param {Swatch} swatch
 * @returns {string}
 */

/**
 * Numeric priority members used by object and template syntax probes.
 * @enum {number}
 */
export const Priority = { LOW: 1, NORMAL: 2, HIGH: 3 };

// Literal kinds: decimal, separators, different bases, exponents, and BigInt.

/** Literal kinds and built-in sentinel values used as highlighting probes. */
export const literals = {
  integer: 42,
  separated: 1_000_000,
  decimal: 3.14159,
  exponent: 6.022e23,
  hexadecimal: 0xff_aa_00,
  binary: 0b1010_0101,
  octal: 0o755,
  negative: -12.5,
  bigint: 9_007_199_254_740_993n,
  hexBigint: 0xdead_beefn,
  yes: true,
  no: false,
  missing: null,
  absent: undefined,
  infinity: Infinity,
  notANumber: NaN,
};

// Preserve both quote delimiters as grammar probes.

/** Single-quoted string with preserved quote and escape syntax. */
// prettier-ignore
export const singleQuoted = 'Single quotes: \'escaped\', newline\n, tab\t, slash\\';

/** Double-quoted string with hexadecimal, Unicode, and null escapes. */
// prettier-ignore
export const doubleQuoted = "Double quotes: \"escaped\", \x41, \u0042, \u{1F680}, \0";

/** Literal Unicode text for string highlighting. */
export const unicodeText = "Café — 日本語 — 🚀";

/** Multiline template with expressions, nesting, and escaped interpolation. */
export const multiline = `First line
Second line: ${literals.integer + 1}
Nested template: ${`color-${Priority.HIGH}`}
Escaped interpolation: \${literal}`;

/** Raw tagged template retaining backslashes as source text. */
export const rawString = String.raw`C:\themes\sample.json\n\u0041`;

// Regex scopes: anchors, groups, assertions, backreferences, escapes, and flags.

/** Regular expressions covering groups, assertions, flags, and Unicode sets. */
export const patterns = {
  identifier: /^(?<name>[\p{L}_][\p{L}\p{N}_]*)(?:\.(\d{1,3}))?$/du,
  assertions: /(?<=\s)(?!skip\b)[a-z]+(?=:)(?<!_)/gim,
  quoted: /(?<quote>["']).*?\k<quote>/gs,
  alternatives: /\b(?:red|green|blue)\b|[^\w\s]/gi,
  repetition: /a*b+c?d{2}e{1,3}f{2,}?/y,
  unicodeSets: /[\p{Letter}&&\p{Script=Latin}]+/v,
  escaped: /https?:\/\/[^/]+\/\w+\.json(?:\?q=\S+)?/i,
};

/** Unique symbol used as an object property key. */
export const marker = Symbol("marker");

/** Registry-backed symbol used as a computed object property. */
export const sharedMarker = Symbol.for("cassidy.sample");

// Shorthand, quoted keys, computed keys, numeric keys, spread, and methods.

/** Object literal demonstrating property names, accessors, methods, and spreads. */
export const options = {
  marker,
  "hyphenated-key": "value",
  0: "zero",
  [sharedMarker]: "symbol property",
  [`level-${Priority.HIGH}`]: Priority.HIGH,
  ...{ enabled: true },

  /** Read or replace the sample label through object accessor syntax. */
  get label() {
    return this["hyphenated-key"];
  },

  /**
   * Read or replace the sample label through object accessor syntax.
   *
   * @param value - Sample value used by this declaration or accessor probe.
   */
  set label(value) {
    this["hyphenated-key"] = value;
  },

  /**
   * Format the sample label with a caller-provided prefix.
   *
   * @param [prefix] - Text prepended to the sample label.
   */
  format(prefix = "theme") {
    return `${prefix}:${this.label}`;
  },

  /** Resolve the sample label through an asynchronous object method. */
  async resolve() {
    return await Promise.resolve(this.enabled);
  },

  /** Yield the sample label through generator-method syntax. */
  *values() {
    yield this.label;
    yield* ["red", "green", "blue"];
  },
};

/** Destructured bindings demonstrating aliases, defaults, omissions, and rest syntax. */
export const { enabled, "hyphenated-key": renamed, missing = "fallback", ...remainingOptions } = options;

/** Destructured bindings demonstrating aliases, defaults, omissions, and rest syntax. */
export const [firstColor, , thirdColor, ...otherColors] = ["red", "green", "blue", "pink"];

/** Mutable exported binding used to inspect let declarations. */
export let mutableCount = 0;

/** Exported var binding used to inspect legacy declarations. */
export var legacyCount = 0;

/**
 * Generic documentation, optional parameters, rest parameters, and return types.
 * @template T
 * @param {T} value - The value to repeat.
 * @param {number} [count=2] - Number of copies.
 * @param {...string} labels - Optional labels.
 * @returns {{value: T, labels: string[]}[]}
 * @throws {RangeError} If count is negative.
 * @example repeat("blue", 2, "syntax");
 */
export function repeat(value, count = 2, ...labels) {
  if (count < 0) {
    throw new RangeError("Count must be nonnegative");
  }

  return Array.from({ length: count }, () => ({ value, labels }));
}

/**
 * Collect destructured options and rest arguments through an arrow function.
 *
 * @param [options] - Options passed to this operation.
 * @param [options.name] - Sample swatch name, optionally aliased inside the function.
 * @param [options.color] - Sample color or its default hex value.
 * @param tags - Additional labels collected through a rest parameter.
 */
export const arrow = ({ name: alias = "anonymous", color = "#92c1fd" } = {}, ...tags) => ({
  alias,
  color,
  tags,
});

/**
 * Format a swatch through a named function expression.
 *
 * @param swatch - Sample object containing a name and color.
 * @param swatch.name - Sample swatch name, optionally aliased inside the function.
 * @param swatch.color - Sample color or its default hex value.
 */
export const namedExpression = function formatSwatch({ name, color }) {
  return `${name} (${color})`;
};

/**
 * Interleave template parts and substitutions through a tag function.
 *
 * @param parts - Ordered source sections or tagged-template string segments.
 * @param values - Iterable values or tagged-template substitutions to process.
 */
export function tagged(parts, ...values) {
  return parts.map((part, index) => `${part}${values[index] ?? ""}`).join("");
}

/** Tagged-template result combining literal parts and substitutions. */
export const taggedString = tagged`Color: ${firstColor}; priority: ${Priority.HIGH}`;

/** Provide an inherited identifier and JSON serializer for class-scope inspection. */
export class BaseRecord {
  /**
   * Initialize the inherited record identifier from optional settings.
   *
   * @param [options] - Options passed to this operation.
   * @param [options.id] - Inherited identifier assigned to the sample record.
   * @returns function Object() { [native code] }
   */
  constructor({ id = 0 } = {}) {
    this.id = id;
  }

  /** Serialize the inherited identifier as a plain object. */
  toJSON() {
    return { id: this.id };
  }
}

/**
 * Class and member scopes, including private names and inherited methods.
 * @extends BaseRecord
 */
export class HighlightRecord extends BaseRecord {
  /** Shared category used to inspect static class fields. */
  static kind = "syntax";

  /** Private count of constructed highlighting records. */
  static #created = 0;

  /** Private string payload used by accessors and serialization. */
  #value;

  /** Public field used to inspect boolean member initialization. */
  enabled = true;

  /** Public field declared with a computed property name. */
  ["computedField"] = "computed";

  /** Format the private value through an arrow-function class field. */
  describe = () => this.#format();

  /** Initialize private class state through a static initialization block. */
  static {
    this.#created = 0;
  }

  /**
   * Initialize a sample value, inherited settings, and the private creation counter.
   *
   * @param [value] - Sample value used by this declaration or accessor probe.
   * @param [settings] - Inherited record settings passed to the base constructor.
   * @returns function Object() { [native code] }
   */
  constructor(value = "sample", settings = {}) {
    super(settings);
    this.#value = value;
    HighlightRecord.#created++;
  }

  /** Read the private static creation counter. */
  static get created() {
    return this.#created;
  }

  /** Read or validate and replace the private sample value. */
  get value() {
    return this.#value;
  }

  /**
   * Read or validate and replace the private sample value.
   *
   * @param next - Replacement string to validate before storing.
   */
  set value(next) {
    if (typeof next !== "string") {
      throw new TypeError("Expected a string");
    }

    this.#value = next;
  }

  /** Combine the inherited identifier and private value into a label. */
  #format() {
    return `${this.id}:${this.#value}`;
  }

  /** Expose a computed symbol accessor for built-in object tagging. */
  get [Symbol.toStringTag]() {
    return "HighlightRecord";
  }

  /** Extend the inherited JSON representation with the private sample value. */
  toJSON() {
    return { ...super.toJSON(), value: this.#value };
  }

  /** Yield the private value and inherited/public fields through a computed iterator method. */
  *[Symbol.iterator]() {
    yield this.#value;
    yield* [this.id, this.enabled];
  }

  /** Yield asynchronously resolved values from the record iterator. */
  async *entries() {
    for (const value of this) {
      yield await Promise.resolve(value);
    }
  }

  /**
   * Resolve a serialized record unless the optional abort signal has fired.
   *
   * @param [options] - Options passed to this operation.
   * @param [options.signal] - Abort signal checked before returning the sample result.
   */
  async save({ signal } = {}) {
    await Promise.resolve();

    if (signal?.aborted) {
      throw new Error("Aborted", { cause: signal.reason });
    }

    return this.toJSON();
  }
}

/**
 * Exercise arithmetic, bitwise, logical, assignment, and optional-access syntax.
 *
 * @param input - Sample operand used to exercise runtime operators.
 * @param [fallback] - Value used when the input is null or undefined.
 */
export function operators(input, fallback = 0) {
  /** Mutable numeric operand for assignment and arithmetic probes. */
  let count = input ?? fallback;

  /** Mutable bit mask for bitwise and shift probes. */
  let mask = 0b1010;

  /** Nullable binding used to inspect nullish assignment. */
  let optional = null;

  /** Boolean binding used to inspect logical assignment. */
  let active = Boolean(input);

  count += 2;
  count -= 1;
  count *= 3;
  count /= 2;
  count %= 7;
  count **= 2;
  mask &= 0b1111;
  mask |= 0b0001;
  mask ^= 0b0010;
  mask <<= 1;
  mask >>= 1;
  mask >>>= 1;
  optional ??= "default";
  active &&= count > 0;
  active ||= input === 0;
  count++;
  --count;

  /** Disposable object property used to inspect delete syntax. */
  const temporary = { remove: true };

  delete temporary.remove;

  return {
    arithmetic: (((count + 1 - 2) * 3 ** 2) / 4) % 5,
    bitwise: (~mask & 0xff) | (mask ^ 3),
    shifts: [mask << 1, mask >> 1, mask >>> 1],
    comparison: count >= 0 && count <= 100 && count !== Infinity,
    equality: input == fallback || input === fallback,
    inequality: input != fallback && input !== fallback,
    logical: !active || (Boolean(input) && active),
    conditional: active ? "active" : "inactive",
    unary: [+input, -count, typeof input, void input],
    membership: "remove" in temporary,
    instance: temporary instanceof Object,
    optionalCall: input?.toString?.(),
    optionalIndex: input?.[0] ?? optional,
  };
}

/**
 * Exercise labels, loops, branching, switch cases, and early exits.
 *
 * @param [values] - Iterable values or tagged-template substitutions to process.
 */
export function controlFlow(values = [1, 2, 3]) {
  /** Accumulator shared by the control-flow syntax probes. */
  let total = 0;

  outer: for (let index = 0; index < values.length; index++) {
    for (const value of values) {
      if (value < 0) {
        continue outer;
      } else if (value > 100) {
        break outer;
      } else {
        total += value;
      }
    }
  }

  for (const key in options) {
    if (Object.hasOwn(options, key)) {
      total += key.length;
    }
  }

  while (total > 20) {
    total -= 5;
  }

  do {
    total++;
  } while (total < 3);

  switch (total) {
    case 0:
      return "zero";
    case 1:
    case 2:
      return "small";
    default:
      return total;
  }
}

/**
 * Parse JSON while demonstrating assertions, chained errors, and finally blocks.
 *
 * @param text - Text to parse, escape, or format.
 */
export function parseSample(text) {
  /** Flag assigned in finally to demonstrate cleanup syntax. */
  let completed = false;

  try {
    /** Parsed JSON value checked before constructing the sample result. */
    const result = JSON.parse(text);

    assert.ok(result !== null);

    return { result, location: path.basename(import.meta.filename) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid sample JSON", { cause: error });
    }

    throw error;
  } finally {
    completed = true;
  }
}

/**
 * Parse JSON with a catch block that omits the error binding.
 *
 * @param text - Text to parse, escape, or format.
 */
export function optionalCatch(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Yield sentinels and numeric steps while accepting a command from the caller.
 *
 * @param [limit] - Maximum number of numeric steps to yield.
 */
export function* sequence(limit = 3) {
  yield "start";

  for (let index = 0; index < limit; index++) {
    /** Command sent back into the generator by its caller. */
    const received = yield index;

    if (received === "stop") {
      return;
    }
  }

  yield* ["end", ...new Set([1, 1, 2])];
}

/**
 * Collect an asynchronous iterable and settle its values through promise callbacks.
 *
 * @param stream - Asynchronous iterable supplying values to collect.
 */
export async function collect(stream) {
  /** Values collected from the asynchronous input stream. */
  const values = [];

  for await (const value of stream) {
    values.push(value);
  }

  return Promise.allSettled(values.map(async (value) => await Promise.resolve(value)));
}

/** Load this sample’s source with dynamic imports and inspect its metadata. */
export async function loadSample() {
  /** Destructured bindings demonstrating aliases, defaults, omissions, and rest syntax. */
  const { inspect: inspectValue } = await import("node:util");

  /** UTF-8 contents of this grammar sample. */
  const source = await readText(new URL(import.meta.url), "utf8");

  return inspectValue({ source, url: import.meta.url });
}

/**
 * Return a value after an intentional debugger-statement syntax probe.
 *
 * @param value - Sample value used by this declaration or accessor probe.
 */
export function inspectInDebugger(value) {
  // eslint-disable-next-line no-debugger -- Intentional debugger keyword highlighting probe.
  debugger;

  return value;
}

// Built-in constructors, namespaces, static properties, and function calls.

/** Built-in constructors, namespaces, and ordinary call expressions. */
export const builtins = {
  map: new Map([["accent", "#92c1fd"]]),
  set: new Set(["red", "green", "blue"]),
  weakMap: new WeakMap(),
  weakSet: new WeakSet(),
  date: new Date("2026-01-01T00:00:00Z"),
  bytes: new Uint8Array([0, 127, 255]),
  buffer: new ArrayBuffer(8),
  url: new URL("https://example.com/sample?mode=dark#syntax"),
  maximum: Math.max(1, 2, 3),
  safeInteger: Number.MAX_SAFE_INTEGER,
  reflection: Reflect.ownKeys(options),
  descriptor: Object.getOwnPropertyDescriptor(options, "label"),
};

/**
 * Construct a record through the deprecated function-declaration probe.
 *
 * @param value - Initial string payload stored by the record.
 * @returns A highlighting record initialized with the supplied value.
 * @deprecated Use HighlightRecord instead.
 */
export function legacyRecord(value) {
  return new HighlightRecord(value);
}

// Named exports, export aliases, namespace re-exports, default export, top-level await.
export { repeat as repeatValue };

export * as urlTools from "node:url";

/** Top-level awaited value used to inspect module initialization. */
export const moduleReady = await Promise.resolve(true);

export default HighlightRecord;

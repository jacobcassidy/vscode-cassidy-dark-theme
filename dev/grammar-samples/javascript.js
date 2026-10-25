#!/usr/bin/env node

/**
 * JavaScript highlighting sample: standard ES modules, no execution required.
 * Open in VS Code with language mode JavaScript and a Cassidy Dark Dev theme.
 * Use Developer: Inspect Editor Tokens and Scopes on declarations and usages.
 * Compare semantic highlighting enabled and disabled to inspect both layers.
 * JSX, TypeScript annotations, and proposal-only decorators need other grammars.
 *
 * @file Examples of comments, literals, imports, JSDoc, classes, and control flow.
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

/** @enum {number} */
export const Priority = { LOW: 1, NORMAL: 2, HIGH: 3 };

// Literal kinds: decimal, separators, different bases, exponents, and BigInt.
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
// prettier-ignore
export const singleQuoted = 'Single quotes: \'escaped\', newline\n, tab\t, slash\\';

// prettier-ignore
export const doubleQuoted = "Double quotes: \"escaped\", \x41, \u0042, \u{1F680}, \0";

export const unicodeText = "Café — 日本語 — 🚀";

export const multiline = `First line
Second line: ${literals.integer + 1}
Nested template: ${`color-${Priority.HIGH}`}
Escaped interpolation: \${literal}`;

export const rawString = String.raw`C:\themes\sample.json\n\u0041`;

// Regex scopes: anchors, groups, assertions, backreferences, escapes, and flags.
export const patterns = {
  identifier: /^(?<name>[\p{L}_][\p{L}\p{N}_]*)(?:\.(\d{1,3}))?$/du,
  assertions: /(?<=\s)(?!skip\b)[a-z]+(?=:)(?<!_)/gim,
  quoted: /(?<quote>["']).*?\k<quote>/gs,
  alternatives: /\b(?:red|green|blue)\b|[^\w\s]/gi,
  repetition: /a*b+c?d{2}e{1,3}f{2,}?/y,
  unicodeSets: /[\p{Letter}&&\p{Script=Latin}]+/v,
  escaped: /https?:\/\/[^/]+\/\w+\.json(?:\?q=\S+)?/i,
};

export const marker = Symbol("marker");

export const sharedMarker = Symbol.for("cassidy.sample");

// Shorthand, quoted keys, computed keys, numeric keys, spread, and methods.
export const options = {
  marker,
  "hyphenated-key": "value",
  0: "zero",
  [sharedMarker]: "symbol property",
  [`level-${Priority.HIGH}`]: Priority.HIGH,
  ...{ enabled: true },
  get label() {
    return this["hyphenated-key"];
  },
  set label(value) {
    this["hyphenated-key"] = value;
  },
  format(prefix = "theme") {
    return `${prefix}:${this.label}`;
  },
  async resolve() {
    return await Promise.resolve(this.enabled);
  },
  *values() {
    yield this.label;
    yield* ["red", "green", "blue"];
  },
};

export const { enabled, "hyphenated-key": renamed, missing = "fallback", ...remainingOptions } = options;

export const [firstColor, , thirdColor, ...otherColors] = ["red", "green", "blue", "pink"];

export let mutableCount = 0;

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

export const arrow = ({ name: alias = "anonymous", color = "#92c1fd" } = {}, ...tags) => ({
  alias,
  color,
  tags,
});

export const namedExpression = function formatSwatch({ name, color }) {
  return `${name} (${color})`;
};

export function tagged(parts, ...values) {
  return parts.map((part, index) => `${part}${values[index] ?? ""}`).join("");
}

export const taggedString = tagged`Color: ${firstColor}; priority: ${Priority.HIGH}`;

export class BaseRecord {
  constructor({ id = 0 } = {}) {
    this.id = id;
  }

  toJSON() {
    return { id: this.id };
  }
}

/**
 * Class and member scopes, including private names and inherited methods.
 * @extends BaseRecord
 */
export class HighlightRecord extends BaseRecord {
  static kind = "syntax";
  static #created = 0;
  #value;
  enabled = true;
  ["computedField"] = "computed";
  describe = () => this.#format();

  static {
    this.#created = 0;
  }

  constructor(value = "sample", settings = {}) {
    super(settings);
    this.#value = value;
    HighlightRecord.#created++;
  }

  static get created() {
    return this.#created;
  }

  get value() {
    return this.#value;
  }

  set value(next) {
    if (typeof next !== "string") {
      throw new TypeError("Expected a string");
    }

    this.#value = next;
  }

  #format() {
    return `${this.id}:${this.#value}`;
  }

  get [Symbol.toStringTag]() {
    return "HighlightRecord";
  }

  toJSON() {
    return { ...super.toJSON(), value: this.#value };
  }

  *[Symbol.iterator]() {
    yield this.#value;
    yield* [this.id, this.enabled];
  }

  async *entries() {
    for (const value of this) {
      yield await Promise.resolve(value);
    }
  }

  async save({ signal } = {}) {
    await Promise.resolve();

    if (signal?.aborted) {
      throw new Error("Aborted", { cause: signal.reason });
    }

    return this.toJSON();
  }
}

export function operators(input, fallback = 0) {
  let count = input ?? fallback;
  let mask = 0b1010;
  let optional = null;
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

export function controlFlow(values = [1, 2, 3]) {
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

export function parseSample(text) {
  let completed = false;

  try {
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

export function optionalCatch(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function* sequence(limit = 3) {
  yield "start";

  for (let index = 0; index < limit; index++) {
    const received = yield index;

    if (received === "stop") {
      return;
    }
  }

  yield* ["end", ...new Set([1, 1, 2])];
}

export async function collect(stream) {
  const values = [];

  for await (const value of stream) {
    values.push(value);
  }

  return Promise.allSettled(values.map(async (value) => await Promise.resolve(value)));
}

export async function loadSample() {
  const { inspect: inspectValue } = await import("node:util");
  const source = await readText(new URL(import.meta.url), "utf8");

  return inspectValue({ source, url: import.meta.url });
}

export function inspectInDebugger(value) {
  // eslint-disable-next-line no-debugger -- Intentional debugger keyword highlighting probe.
  debugger;

  return value;
}

// Built-in constructors, namespaces, static properties, and function calls.
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

/** @deprecated Use HighlightRecord instead. */
export function legacyRecord(value) {
  return new HighlightRecord(value);
}

// Named exports, export aliases, namespace re-exports, default export, top-level await.
export { repeat as repeatValue };

export * as urlTools from "node:url";

export const moduleReady = await Promise.resolve(true);

export default HighlightRecord;

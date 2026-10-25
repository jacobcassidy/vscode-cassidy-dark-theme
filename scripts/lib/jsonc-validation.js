import { getNodeValue, parseTree, printParseErrorCode } from "jsonc-parser";

export function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: expected an object`);
  }
}

export function fields(value, allowed, label) {
  object(value, label);

  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`${label}: unknown field ${key}`);
    }
  }
}

export function number(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label}: expected a finite number in ${minimum}–${maximum}`);
  }
}

export function parseJsonc(text, label) {
  const errors = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true });

  function fail(message, offset) {
    const before = text.slice(0, offset).split("\n");

    throw new Error(`${label}:${before.length}:${before.at(-1).length + 1}: ${message}`);
  }

  if (errors.length) {
    const error = errors[0];

    fail(printParseErrorCode(error.error), error.offset);
  }

  if (!tree) {
    fail("expected a JSONC value", 0);
  }

  function check(node) {
    if (node.type === "object") {
      const keys = new Set();

      for (const property of node.children ?? []) {
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

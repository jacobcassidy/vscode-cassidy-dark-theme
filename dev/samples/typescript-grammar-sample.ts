/**
 * Modern TypeScript highlighting sample; no execution required.
 * Open in VS Code with language mode TypeScript and a Cassidy Dark Dev theme.
 * Use Developer: Inspect Editor Tokens and Scopes on declarations and usages.
 * Compare semantic highlighting enabled and disabled to inspect both layers.
 *
 * Uses TypeScript 5.4+ features, standard decorators, and ESNext libraries.
 * The companion JavaScript module supplies examples of imports and re-exports.
 * Compiler validation needs allowJs, ESNext target, and an ES module mode.
 * JSX and legacy parameter decorators require different syntax/compiler modes.
 *
 * @packageDocumentation
 * @remarks This source deliberately mixes current and legacy declaration forms.
 */

import JavaScriptRecord, { Priority as JavaScriptPriority, type BaseRecord } from "./javascript-grammar-sample.js";
import * as JavaScriptSample from "./javascript-grammar-sample.js";
import type { HighlightRecord as ImportedRecord } from "./javascript-grammar-sample.js";

// Comments: TODO inspect interface, readonly, `${interpolation}`, and @decorators.
/* A block comment: public field!: string; and <Component /> remain comment text. */

// Primitive types, literal types, aliases, unions, intersections, and branded types.
export type PrimitiveCatalog = {
  text: string;
  number: number;
  bigint: bigint;
  boolean: boolean;
  symbol: symbol;
  absent: undefined;
  empty: null;
  object: object;
  anything: any;
  uncertain: unknown;
  noValue: void;
  impossible: never;
};

export type Mode = "dark" | "light";

export type HexColor = `#${string}`;

export type Dimension = `${number}${"px" | "rem" | "%"}`;

declare const colorBrand: unique symbol;

export type ColorId = string & { readonly [colorBrand]: true };

export const swatchKey: unique symbol = Symbol("swatch");

export interface Named {
  name: string;
}

/** A documented interface; compare type names, members, and usage-site tokens. */
export interface Swatch extends Named {
  readonly id: ColorId;
  color: HexColor;
  opacity?: number;
  [swatchKey]?: string;
}

// Interface declaration merging adds optional members to the same type.
export interface Swatch {
  /** @deprecated Use the color property instead. */
  legacyColor?: string;
}

export interface PaletteOptions extends Named {
  readonly mode: Mode;
  metadata?: Record<string, unknown>;
  onChange?(this: PaletteOptions, swatch: Swatch): void;
}

// Index signatures: numeric, symbol, and template literal keys.
export interface TokenTable {
  readonly [index: number]: Swatch;
  [name: `data-${string}`]: string | undefined;
  [key: symbol]: unknown;
}

// Call signatures, construct signatures, overloads, and parameter modifiers.
export interface SwatchFactory {
  (name: string, color?: HexColor): Swatch;
  new (options?: Partial<PaletteOptions>): PaletteRenderer;
  readonly prototype: PaletteRenderer;
}

export type Callback = (this: Swatch, name: string, ...tags: string[]) => string;

export type RendererConstructor = abstract new (name: string) => Renderer<Swatch>;

// Arrays, named tuples, optional tuple entries, readonly tuples, and variadic tuples.
export type ColorList = Array<HexColor>;

export type ReadonlyColors = readonly HexColor[];

export type ColorEntry = readonly [name: string, color: HexColor, opacity?: number];

export type WithTimestamp<T extends unknown[]> = [timestamp: Date, ...values: T];

export type Nonempty<T> = [first: T, ...rest: T[]];

export type TupleTail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : [];

// Type queries, indexed access types, keyof, import types, and typeof on values.
export type SwatchKey = keyof Swatch;

export type SwatchValue = Swatch[keyof Swatch];

export type ImportedModule = typeof import("./javascript-grammar-sample.js");

export type ImportedClass = import("./javascript-grammar-sample.js").HighlightRecord;

export type JavaScriptPriorityValue = (typeof JavaScriptPriority)[keyof typeof JavaScriptPriority];

export type ImportedBase = Pick<BaseRecord, "id">;

export type ImportedInstance = ImportedRecord | InstanceType<typeof JavaScriptRecord>;

// Conditional, distributive, non-distributive, recursive, and constrained infer types.
export type Unwrap<T> = T extends PromiseLike<infer Value> ? Value : T;

export type Distribute<T> = T extends unknown ? T[] : never;

export type IsNever<T> = [T] extends [never] ? true : false;

export type IdentifierOf<T> = T extends { id: infer Id extends string } ? Id : never;

export type SplitPath<Path extends string> = Path extends `${infer Head}/${infer Tail}`
  ? [Head, ...SplitPath<Tail>]
  : [Path];

export type DeepReadonly<T> = T extends (...args: any[]) => unknown
  ? T
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

// Mapped types, modifier removal/addition, key remapping, and intrinsic string types.
export type MutableRequired<T> = { -readonly [Key in keyof T]-?: T[Key] };

export type OptionalReadonly<T> = { +readonly [Key in keyof T]+?: T[Key] };

export type ChangeEvents<T> = {
  [Key in keyof T as `on${Capitalize<string & Key>}Changed`]?: (value: T[Key]) => void;
};

export type GetterNames<T> = {
  [Key in keyof T as T[Key] extends Function ? never : `get${Capitalize<string & Key>}`]: () => T[Key];
};

export type CaseVariants = Uppercase<Mode> | Lowercase<"DARK"> | Capitalize<Mode> | Uncapitalize<"Light">;

// Explicit variance annotations on generic interfaces.
export interface Source<out T> {
  read(): T;
}

export interface Sink<in T> {
  write(value: T): void;
}

export interface Channel<in out T> {
  exchange: (value: T) => T;
}

// Numeric and string enums, constant enums, member references, and namespace merging.
export enum TokenKind {
  Unknown,
  Identifier = 10,
  String,
  Number = 0x20,
}

export enum ThemeMode {
  Dark = "dark",
  Light = "light",
}

export const enum Permission {
  Read = 1 << 0,
  Write = 1 << 1,
  All = Read | Write,
}

export namespace TokenKind {
  export function isKnown(value: TokenKind): boolean {
    return value !== TokenKind.Unknown;
  }
}

// Inference, assertions, const contexts, satisfies, and both assertion delimiters.
export const palette = {
  accent: "#92c1fd",
  background: "#242424",
  foreground: "#f8f8f8",
} as const satisfies Record<string, HexColor>;

export type PaletteName = keyof typeof palette;

export const assertedId = "accent" as ColorId;

// prettier-ignore
export const angleAssertion = <HexColor>"#89dfdf";

export const readonlyTuple = ["accent", "#92c1fd", 1] as const;

export const sampleSwatch = {
  id: assertedId,
  name: "accent",
  color: palette.accent,
  [swatchKey]: "sample",
} satisfies Swatch;

export const definiteSwatch = [sampleSwatch].find((item) => item.name === "accent")!;

/**
 * Constrained generics, defaults, typed parameters, and indexed return types.
 * @typeParam T - The object being read.
 * @typeParam Key - A property key belonging to T.
 * @param value - The source value.
 * @param key - The key to read.
 * @returns The corresponding property value.
 */
export function pluck<T extends object, Key extends keyof T = keyof T>(value: T, key: Key): T[Key] {
  return value[key];
}

export function literalTuple<const T extends readonly string[]>(...names: T): T {
  return names;
}

export function choose<T>(values: readonly T[], fallback: NoInfer<T>): T {
  return values[0] ?? fallback;
}

export function identity<T>(value: T): T {
  return value;
}

export const specializeIdentity = identity<Swatch>;

export const genericArrow = <T extends Named>(value: T): string => value.name;

export function formatWithThis(this: Swatch, prefix = "color"): string {
  return `${prefix}:${this.name}:${this.color}`;
}

// Function overload signatures followed by a single narrowing implementation.
export function formatSwatch(value: Swatch): string;

export function formatSwatch(value: readonly Swatch[]): string[];

export function formatSwatch(value: Swatch | readonly Swatch[]): string | string[] {
  if ("name" in value) {
    return `${value.name}:${value.color}`;
  }

  return value.map((item) => `${item.name}:${item.color}`);
}

// Function/namespace merging gives a function additional static members and types.
export namespace formatSwatch {
  export const label = "formatter";

  export type Options = Pick<PaletteOptions, "mode">;
}

export function isSwatch(value: unknown): value is Swatch {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "color" in value &&
    typeof value.color === "string" &&
    value.color.startsWith("#")
  );
}

export function assertSwatch(value: unknown): asserts value is Swatch {
  if (!isSwatch(value)) {
    throw new TypeError("Expected a swatch");
  }
}

export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

export type Event = { kind: "color"; swatch: Swatch } | { kind: "mode"; mode: Mode } | { kind: "reset" };

export function unreachable(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function describeEvent(event: Event): string {
  switch (event.kind) {
    case "color":
      return formatSwatch(event.swatch);
    case "mode":
      return event.mode;
    case "reset":
      return "reset";
    default:
      return unreachable(event);
  }
}

// Standard decorators: class, method, and field forms without experimentalDecorators.
function labelled(target: Function, context: ClassDecoratorContext): void {
  Object.defineProperty(target, "sampleName", { value: String(context.name) });
}

function traced<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
  return function (this: This, ...args: Args): Return {
    console.debug("sample trace", context.name);

    return target.apply(this, args);
  };
}

function trimmed(_initial: undefined, _context: ClassFieldDecoratorContext<object, string>) {
  return function (value: string): string {
    return value.trim();
  };
}

export abstract class Renderer<T extends Swatch> {
  protected constructor(public readonly name: string) {}

  abstract render(value: T): string;

  protected describe(value: T): string {
    return value.name;
  }
}

@labelled
export class PaletteRenderer extends Renderer<Swatch> implements Iterable<Swatch>, Disposable {
  static readonly kind = "palette";
  static #created = 0;
  #disposed = false;
  #opacity = 1;
  public readonly items: Swatch[] = [];
  protected enabled = true;
  private revision = 0;
  declare metadata: Record<string, unknown> | undefined;
  initialized!: boolean;
  accessor label = "sample";

  @trimmed
  caption = " syntax ";

  static {
    this.#created = 0;
  }

  constructor(
    public readonly options: Partial<PaletteOptions> = {},
    private readonly prefix: string = "theme",
  ) {
    super(options.name ?? "sample");
    this.initialized = true;
    PaletteRenderer.#created++;
  }

  static get created(): number {
    return this.#created;
  }

  get opacity(): number {
    return this.#opacity;
  }

  set opacity(value: number | string) {
    this.#opacity = Number(value);
  }

  @traced
  public override render(value: Swatch): string {
    if (this.#disposed) {
      throw new Error("Renderer is disposed");
    }

    return `${this.prefix}:${super.describe(value)}:${this.opacity}`;
  }

  protected override describe(value: Swatch): string {
    return super.describe(value).toUpperCase();
  }

  append(value: Swatch): this {
    this.items.push(value);
    this.revision++;

    return this;
  }

  [Symbol.iterator](): Iterator<Swatch> {
    return this.items.values();
  }

  [Symbol.dispose](): void {
    this.#disposed = true;
    this.items.length = 0;
  }
}

// Class/interface merging and augmentation of the companion JavaScript module.
export interface PaletteRenderer {
  sampleNote?: string;
}

declare module "./javascript-grammar-sample.js" {
  interface HighlightRecord {
    sampleNote?: string;
  }
}

// Utility types at concrete usage sites.
export type Utilities = {
  partial: Partial<Swatch>;
  required: Required<PaletteOptions>;
  readonly: Readonly<Swatch>;
  picked: Pick<Swatch, "name" | "color">;
  omitted: Omit<Swatch, "legacyColor">;
  dictionary: Record<Mode, HexColor>;
  excluded: Exclude<keyof Swatch, "legacyColor">;
  extracted: Extract<keyof Swatch, string>;
  present: NonNullable<Swatch["opacity"]>;
  parameters: Parameters<typeof pluck>;
  constructorParameters: ConstructorParameters<typeof PaletteRenderer>;
  instance: InstanceType<typeof PaletteRenderer>;
  returned: ReturnType<typeof formatWithThis>;
  awaited: Awaited<Promise<Promise<Swatch>>>;
  thisParameter: ThisParameterType<typeof formatWithThis>;
  withoutThis: OmitThisParameter<typeof formatWithThis>;
  contextualThis: ThisType<PaletteOptions>;
};

// Ambient declarations and global augmentation describe values supplied elsewhere.
export declare const ambientColor: HexColor;

export declare function ambientFormat(swatch: Swatch): string;

export declare class AmbientRenderer {
  readonly name: string;
  constructor(name: string);
  render(value: Swatch): string;
}

export declare namespace Host {
  const version: string;

  interface Context {
    readonly mode: Mode;
  }

  function render(context: Context): void;
}

declare global {
  interface CassidySampleRegistry {
    swatches: Record<string, Swatch>;
  }
}

export type GlobalRegistry = CassidySampleRegistry;

// Legacy namespaces and import-equals aliases remain useful grammar probes.
export namespace Legacy {
  export class Store {
    constructor(public readonly mode: Mode = "dark") {}
  }

  export namespace Nested {
    export type Key = `legacy:${string}`;
  }
}

import LegacyStore = Legacy.Store;

export { LegacyStore };

// Explicit resource management: using, await using, and well-known disposal symbols.
export class SampleResource implements Disposable {
  constructor(public readonly value: string) {}

  [Symbol.dispose](): void {
    // Resource cleanup would go here.
  }
}

export class AsyncSampleResource implements AsyncDisposable {
  constructor(public readonly value: string) {}

  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.resolve();
  }
}

export function resourceSample(): string {
  using resource = new SampleResource("syntax");

  return resource.value;
}

export async function asyncResourceSample(): Promise<string> {
  await using resource = new AsyncSampleResource("syntax");

  return resource.value;
}

export async function* stream<T>(items: Iterable<T> | AsyncIterable<T>): AsyncGenerator<T, void, unknown> {
  for await (const value of items) {
    yield value;
  }
}

// Runtime literals, strings, escapes, interpolation, tagged templates, and regexes.
export const literalSamples = {
  decimal: 1_000.5,
  exponent: 6.022e23,
  hexadecimal: 0xff_aa,
  binary: 0b1010_0101,
  octal: 0o755,
  bigint: 9_007_199_254_740_993n,
  truth: true,
  falsehood: false,
  empty: null,
  missing: undefined,
  infinity: Infinity,
  notANumber: NaN,
};

// prettier-ignore
export const singleQuoted = 'Single quotes: \'escaped\', newline\n, slash\\';

// prettier-ignore
export const doubleQuoted = "Double quotes: \"escaped\", \x41, \u0042, \u{1F680}";

export const unicodeText: string = "Café — 日本語 — 🚀";

export const template = `Color: ${palette.accent}; nested: ${`mode-${ThemeMode.Dark}`}
Escaped interpolation: \${literal}`;

export const raw = String.raw`C:\themes\sample.json\n`;

export const regexes = {
  identifier: /^(?<name>[\p{L}_][\p{L}\p{N}_]*)(?:\.(\d{1,3}))?$/du,
  assertions: /(?<=\s)(?!skip\b)[a-z]+(?=:)(?<!_)/gim,
  quoted: /(?<quote>["']).*?\k<quote>/gs,
  alternatives: /\b(?:red|green|blue)\b|[^\w\s]/gi,
  unicodeSets: /[\p{Letter}&&\p{Script=Latin}]+/v,
};

export function runtimeExpressions(input: unknown, options: Partial<PaletteOptions> = {}): Result<Swatch> {
  try {
    assertSwatch(input);

    const { name: alias, color, ...rest } = input;
    const [first, ...tail] = [color, palette.background];
    let count: number = 0;
    let mask = 0b1010;
    let optional: string | undefined;

    count += 1;
    count **= 2;
    mask <<= 1;
    mask ^= count;
    optional ??= alias;
    options.onChange?.call({ name: alias, mode: options.mode ?? "dark" }, input);

    for (const value of [first, ...tail]) {
      if (value === palette.background) {
        continue;
      }

      count++;
    }

    const comparison = count > 0 && count !== Infinity;
    const instance = new LegacyStore(options.mode ?? "dark") instanceof Legacy.Store;
    const description = comparison ? `${alias}:${mask >>> 1}` : optional;

    void [rest, instance, description, JavaScriptSample.Priority.HIGH];

    return { ok: true, value: input };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    // Finally is deliberately separate from the narrowing and return branches.
  }
}

// Default exports, named re-exports, type-only re-exports, and namespace re-exports.
export { repeat as repeatJavaScriptValue } from "./javascript-grammar-sample.js";

export type { HighlightRecord as JavaScriptRecordType } from "./javascript-grammar-sample.js";

export * as JavaScriptExamples from "./javascript-grammar-sample.js";

export const moduleReady: boolean = await Promise.resolve(true);

export default PaletteRenderer;

/**
 * TypeScript + JSX highlighting sample for Cassidy Dark Preview.
 * A minimal local JSX contract avoids React dependencies; no execution required.
 * Inspect type arguments, component names, props, expressions, and markup scopes.
 */

declare global {
  namespace JSX {
    interface Element {
      readonly kind?: "sample";
    }

    interface ElementChildrenAttribute {
      children: unknown;
    }

    interface IntrinsicAttributes {
      key?: string | number;
    }

    interface IntrinsicElements {
      [tag: string]: Record<string, unknown>;
    }
  }
}

export type Color = `#${string}`;

export interface Swatch {
  readonly id: string;
  label: string;
  color: Color;
  enabled?: boolean;
}

export type Selection<T> = { status: "selected"; value: T } | { status: "empty" };

type Renderable = JSX.Element | string | number | boolean | null | undefined;
type ListProps<T> = {
  readonly items: readonly T[];
  keyOf: (item: T) => string;
  render: (item: T, index: number) => Renderable;
  empty?: Renderable;
};

// The trailing comma distinguishes generic arrow syntax from an opening JSX tag.
export const identity = <T,>(value: T): T => value;

export function List<T>({ items, keyOf, render, empty = <em>Empty</em> }: ListProps<T>): JSX.Element {
  return (
    <ul role="list">
      {items.length ? items.map((item, index) => <li key={keyOf(item)}>{render(item, index)}</li>) : <li>{empty}</li>}
    </ul>
  );
}

interface CardProps<T extends Swatch> {
  value: T;
  selected?: boolean;
  onSelect?: (value: T) => void;
  children?: Renderable;
}

export function Card<T extends Swatch>({ value, selected = false, onSelect, children }: CardProps<T>): JSX.Element {
  const attributes = { "data-color": value.color, "aria-pressed": selected } as const;

  return (
    <article className={`card ${selected ? "selected" : ""}`} style={{ borderColor: value.color }}>
      <button {...attributes} type="button" disabled={value.enabled === false} onClick={() => onSelect?.(value)}>
        {value.label} <code>{value.color}</code>
      </button>
      {children ?? <small>No additional content</small>}
    </article>
  );
}

export const swatches = [
  { id: "accent", label: "Accent", color: "#92c1fd", enabled: true },
  { id: "surface", label: "Surface", color: "#242424" },
] as const satisfies readonly Swatch[];

export function Gallery({ selection }: { selection: Selection<Swatch> }): JSX.Element {
  const selectedId = selection.status === "selected" ? selection.value.id : null;
  const render = (value: Swatch, index: number): JSX.Element => (
    <Card<Swatch> key={value.id} value={value} selected={value.id === selectedId}>
      <span>
        {index + 1}: {value.label.toUpperCase()}
      </span>
    </Card>
  );

  return (
    <>
      {/* Embedded TypeScript: narrowing, optional access, generics, and assertions. */}
      <h1 title="TSX &amp; type scopes">TypeScript + JSX</h1>
      <List<Swatch> items={swatches} keyOf={(value) => value.id} render={render} empty={<strong>No swatches</strong>} />
      {selection.status === "selected" && <output>{selection.value.color}</output>}
      <input type="text" value={selectedId ?? ""} aria-label="Selected identifier" readOnly />
      <svg viewBox="0 0 100 40">
        <rect width={100} height={40} fill={swatches[0].color} />
        <text x={5} y={25}>
          TSX
        </text>
      </svg>
      <sample-swatch data-color={swatches[0].color} />
    </>
  );
}

export const example = <Gallery selection={{ status: "selected", value: swatches[0] }} />;

export default Gallery;

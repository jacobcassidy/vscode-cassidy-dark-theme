/**
 * JSX highlighting sample for Cassidy Dark Dev; inspect as source.
 * Framework-independent components demonstrate JSX without installing React.
 * This file is excluded from the samples-only TypeScript check.
 */

const palette = [
  { id: "accent", color: "#92c1fd", enabled: true },
  { id: "surface", color: "#242424", enabled: false },
];

/** @param {{ children?: unknown, title: string }} props */
export function Panel({ children, title, ...attributes }) {
  return (
    <section {...attributes} className="panel" aria-label={title}>
      <header>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function Swatch({ color = "#92c1fd", label, selected = false, onSelect }) {
  const style = { backgroundColor: color, border: `1px solid ${color}` };

  return (
    <button
      type="button"
      className={`swatch ${selected ? "selected" : ""}`}
      style={style}
      aria-pressed={selected}
      data-color={color}
      onClick={() => onSelect?.(color)}
      onKeyDown={(event) => event.key === "Enter" && onSelect?.(color)}
    >
      <span aria-hidden="true">&#9733;</span> {label ?? "Unnamed"}
    </button>
  );
}

const Icons = {
  Accent: () => (
    <svg viewBox="0 0 24 24" role="img" aria-label="Accent">
      <defs>
        <linearGradient id="accent">
          <stop offset="0%" stopColor="#92c1fd" />
          <stop offset="100%" stopColor="#cfabf9" />
        </linearGradient>
      </defs>
      <path d="M2 2h20v20H2z" fill="url(#accent)" strokeWidth={1.5} />
      <text x={4} y={16}>
        JSX
      </text>
    </svg>
  ),
};

export function Gallery({ title = "Token gallery", activeId = "accent", onSelect, footer }) {
  const attributes = { id: "jsx-gallery", "data-state": "ready" };

  return (
    <>
      {/* JSX comments contain <tags>, {expressions}, and "quotes". */}
      <Panel {...attributes} title={title}>
        <Icons.Accent />
        <p title='Quotes "like this"'>Text &amp; entities, café 日本語 🚀.</p>
        <label htmlFor="jsx-name">Name</label>
        <input id="jsx-name" defaultValue={title} required autoComplete="off" />
        <input type="checkbox" defaultChecked disabled={false} />
        <div className="swatches">
          {palette.map(({ id, color, enabled }, index) => (
            <Swatch
              key={id}
              color={color}
              label={`${index + 1}: ${id}`}
              selected={id === activeId}
              onSelect={onSelect}
            />
          ))}
        </div>
        {palette.length > 0 && <p>{palette.length} swatches available.</p>}
        {activeId ? <strong>Selected: {activeId}</strong> : <em>No selection</em>}
        {null}
        {false}
        {42} {`Literal braces: ${"{}"}`}
        <pre>{JSON.stringify(palette, null, 2)}</pre>
        <sample-swatch data-color={palette[0]?.color} />
        <a href={`https://example.com/colors/${encodeURIComponent(activeId)}`}>Color details</a>
        <footer>{footer?.({ count: palette.length }) ?? <small>End of gallery</small>}</footer>
      </Panel>
    </>
  );
}

export const example = <Gallery title="JSX token gallery" footer={({ count }) => <span>Total: {count}</span>} />;

export default Gallery;

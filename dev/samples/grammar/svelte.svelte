<!-- Svelte 5 highlighting sample for Cassidy Dark Preview; inspect as source.
     Svelte tooling supplies markup scopes; Svelte is not a repo dependency.
     References: https://svelte.dev/docs/svelte/$state and https://svelte.dev/docs/svelte/snippet -->
<script lang="ts">
  import { flip } from "svelte/animate";
  import { fade, fly } from "svelte/transition";
  import type { Snippet } from "svelte";

  interface Swatch {
    id: string;
    name: string;
    color: `#${string}`;
  }

  interface Props {
    title?: string;
    query?: string;
    onselect?: (swatch: Swatch) => void;
    children?: Snippet<[number]>;
  }

  let { title = "Svelte token gallery", query = $bindable(""), onselect, children }: Props = $props();
  let count = $state(0);
  let selected = $state<string | null>(null);
  let enabled = $state(true);
  let input = $state<HTMLInputElement>();
  let width = $state(0);
  let pointer = $state({ x: 0, y: 0 });
  let swatches = $state<Swatch[]>([
    { id: "accent", name: "Accent", color: "#92c1fd" },
    { id: "surface", name: "Surface", color: "#242424" },
  ]);

  let filtered = $derived(swatches.filter((swatch) => swatch.name.toLowerCase().includes(query.toLowerCase())));
  let description = $derived.by(() => {
    const total = filtered.length;

    return `${total} ${total === 1 ? "swatch" : "swatches"}`;
  });

  const attributes = { "data-language": "svelte", title: "Attribute spread" };
  const trustedMarkup = "<strong>Static sample markup &amp; entities</strong>";
  const pending = Promise.resolve("Ready");

  $effect(() => {
    if (!enabled) {
      selected = null;
    }
  });

  function select(swatch: Swatch): void {
    selected = swatch.id;
    count++;
    onselect?.(swatch);
  }

  function focus(element: HTMLElement) {
    element.focus();

    return { destroy() { /* Action cleanup probe. */ } };
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content="Svelte grammar token gallery" />
</svelte:head>

<svelte:window bind:innerWidth={width} />

{#snippet label(swatch: Swatch, index: number)}
  <span style:color={swatch.color}>{index + 1}: {swatch.name}</span>
{/snippet}

<main {...attributes} class:active={enabled} style:--accent={swatches[0]?.color}>
  <h1>{title} &amp; template scopes</h1>
  <label for="svelte-query">Filter</label>
  <input id="svelte-query" bind:this={input} bind:value={query} use:focus />
  <label><input type="checkbox" bind:checked={enabled} /> Enable gallery</label>
  <button type="button" onclick={() => count++}>Count {count}</button>
  <p>{description}; viewport {width}px</p>

  {#if filtered.length > 0}
    <ul>
      {#each filtered as swatch, index (swatch.id)}
        {@const text = swatch.name.toUpperCase()}
        <li animate:flip={{ duration: 150 }} transition:fade={{ duration: 150 }}>
          <button type="button" aria-pressed={selected === swatch.id} onclick={() => select(swatch)}>
            {@render label(swatch, index)} <code>{swatch.color}</code>
          </button>
          <small>{text}</small>
        </li>
      {/each}
    </ul>
  {:else if query}
    <p>No results for {query}.</p>
  {:else}
    <p>No swatches.</p>
  {/if}

  {#key selected}
    <p in:fly={{ y: 10, duration: 100 }} out:fade>Selected: {selected ?? "none"}</p>
  {/key}

  {#await pending}
    <p>Loading...</p>
  {:then message}
    <p role="status">{message}</p>
  {:catch error}
    <p role="alert">{String(error)}</p>
  {/await}

  <div>{@html trustedMarkup}</div>
  <svelte:element this={enabled ? "section" : "aside"} data-selected={selected}>Dynamic element</svelte:element>
  {#if children}
    {@render children(count)}
  {/if}
  <svg viewBox="0 0 100 40"><rect width="100" height="40" fill={swatches[0]?.color} /></svg>
</main>

<style>
  main {
    --accent: #92c1fd;
    display: grid;
    gap: 1rem;
  }

  .active :global(code) {
    color: var(--accent);
  }

  button:hover {
    outline: 2px solid currentColor;
  }

  @media (prefers-reduced-motion: reduce) {
    * { scroll-behavior: auto; }
  }
</style>

<!-- Vue 3.4+ highlighting sample for Cassidy Dark Preview; inspect as source.
     Vue language tooling supplies template scopes; Vue is not a repo dependency.
     Reference: https://vuejs.org/api/sfc-script-setup.html -->
<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, watch, type PropType } from "vue";

interface Swatch {
  id: string;
  name: string;
  color: `#${string}`;
  enabled: boolean;
}

const props = withDefaults(defineProps<{ title?: string; limit?: number }>(), {
  title: "Vue token gallery",
  limit: 10,
});

const emit = defineEmits<{
  select: [swatch: Swatch];
  reset: [];
}>();

const slots = defineSlots<{
  default(props: { count: number }): unknown;
  footer(props: { selected: string | null }): unknown;
}>();

const query = defineModel<string>({ default: "" });
const selected = ref<string | null>(null);
const input = ref<HTMLInputElement | null>(null);
const state = reactive({ enabled: true, count: 0, mode: "dark" as "dark" | "light" });
const swatches = ref<Swatch[]>([
  { id: "accent", name: "Accent", color: "#92c1fd", enabled: true },
  { id: "surface", name: "Surface", color: "#242424", enabled: false },
]);

const filtered = computed(() =>
  swatches.value
    .filter((swatch) => swatch.name.toLowerCase().includes(query.value.toLowerCase()))
    .slice(0, props.limit),
);

const previewTag = computed(() => (state.mode === "dark" ? "section" : "article"));
const attributes = { "data-language": "vue", title: "Attribute spread" };
const trustedMarkup = "<strong>Static sample markup &amp; entities</strong>";

// A local component makes scoped-slot syntax self-contained.
const PreviewList = defineComponent({
  props: { items: { type: Array as PropType<Swatch[]>, required: true } },
  setup(componentProps, { slots: componentSlots }) {
    return () =>
      h(
        "div",
        componentProps.items.map((item) => componentSlots.default?.({ item })),
      );
  },
});

const vFocus = {
  mounted(element: HTMLElement) {
    element.focus();
  },
};

function select(swatch: Swatch): void {
  selected.value = swatch.id;
  state.count++;
  emit("select", swatch);
}

watch(query, () => {
  selected.value = null;
});

onMounted(() => {
  input.value?.focus();
});

defineExpose({ selected, reset: () => emit("reset") });
</script>

<template>
  <main v-bind="attributes" :class="['gallery', { active: state.enabled }]" :data-mode="state.mode">
    <!-- Directives, shorthand, arguments, modifiers, slots, and interpolation. -->
    <h1>{{ props.title }} &amp; template scopes</h1>
    <label for="vue-query">Filter</label>
    <input id="vue-query" ref="input" v-model.trim="query" v-focus @keydown.enter.prevent="state.count++" />
    <input v-model="state.enabled" type="checkbox" aria-label="Enable gallery" />
    <form @submit.prevent="emit('reset')"><button type="submit">Reset</button></form>
    <p v-if="filtered.length > 0">Found {{ filtered.length }} swatches.</p>
    <p v-else-if="query.length > 0">No results for {{ query }}.</p>
    <p v-else>Enter a query.</p>
    <p v-show="state.enabled" v-text="`Selected: ${selected ?? 'none'}`"></p>
    <div v-html="trustedMarkup"></div>
    <pre v-pre>{{ literal braces are not evaluated }}</pre>
    <component :is="previewTag" :style="{ '--accent': swatches[0]?.color }">
      <TransitionGroup name="swatches" tag="ul">
        <li v-for="(swatch, index) in filtered" :key="swatch.id">
          <button
            :disabled="!swatch.enabled"
            :aria-pressed="selected === swatch.id"
            :style="{ color: swatch.color }"
            @click.stop="select(swatch)"
          >
            {{ index + 1 }}: {{ swatch.name }} <code>{{ swatch.color }}</code>
          </button>
        </li>
      </TransitionGroup>
    </component>
    <PreviewList :items="filtered">
      <template #default="{ item }"
        ><span :data-id="item.id">{{ item.name }}</span></template
      >
    </PreviewList>
    <slot :count="state.count"><small>Fallback content</small></slot>
    <footer><slot name="footer" :selected="selected">No footer supplied</slot></footer>
    <Teleport to="body"
      ><aside v-if="selected" role="status">Selected {{ selected }}</aside></Teleport
    >
    <svg viewBox="0 0 100 40"><rect width="100" height="40" :fill="swatches[0]?.color" /></svg>
  </main>
</template>

<style scoped>
.gallery {
  --accent: #92c1fd;
  display: grid;
  gap: 1rem;
  color: var(--accent);
}

.gallery :deep(button:hover) {
  outline: 2px solid currentColor;
}

:slotted(small) {
  opacity: 0.8;
}

:global(body) {
  font-family: system-ui, sans-serif;
}

.swatches-enter-active,
.swatches-leave-active {
  transition: opacity 200ms ease;
}

.swatches-enter-from,
.swatches-leave-to {
  opacity: 0;
}
</style>

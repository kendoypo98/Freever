<script setup>
import { computed } from 'vue';
import { GLYPHS } from '../lib/sprites.js';

// Every icon and theme sprite comes from lib/sprites.js: single-colour inline SVG, tinted by currentColor.
const props = defineProps({ name: { type: String, required: true }, size: { type: Number, default: 18 } });
const g = computed(() => GLYPHS[props.name] || { d: '', stroke: true });
</script>

<template>
  <svg class="icon-svg" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true"
    :fill="g.stroke ? 'none' : 'currentColor'" :fill-rule="g.stroke ? undefined : 'evenodd'"
    :stroke="g.stroke ? 'currentColor' : undefined" :stroke-width="g.stroke ? 2 : undefined"
    stroke-linecap="round" stroke-linejoin="round">
    <path :d="g.d" />
  </svg>
</template>

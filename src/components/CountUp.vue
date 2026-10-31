<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

// A number that counts up to its value (and re-counts when it changes). Plain requestAnimationFrame, cleaned up on unmount.
const props = defineProps({ to: { type: Number, default: 0 }, fmt: { type: Function, default: null }, ms: { type: Number, default: 900 } });
const shown = ref(0);
let raf = 0;
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function run(from, to) {
  cancelAnimationFrame(raf);
  if (still() || from === to) { shown.value = to; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / props.ms);
    shown.value = from + (to - from) * (1 - (1 - k) ** 3); // ease-out cubic
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
onMounted(() => run(0, props.to));
watch(() => props.to, (n) => run(shown.value, n));
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template><span>{{ fmt ? fmt(shown) : Math.round(shown) }}</span></template>

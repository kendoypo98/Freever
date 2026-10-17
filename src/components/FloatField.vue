<script setup>
import Icon from './Icon.vue';

// A text field whose label floats up when you focus or type, with a glow ring and a sweeping accent line.
defineProps({
  label: { type: String, required: true },
  icon: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' }, // example text, shown while focused and empty
  autocomplete: { type: String, default: 'off' },
  enterkeyhint: { type: String, default: undefined },
  minlength: { type: Number, default: undefined },
  hint: { type: String, default: '' },
  error: { type: Boolean, default: false },
});
const model = defineModel({ type: String, default: '' });
</script>

<template>
  <div class="group" :class="{ shake: error }">
    <div
      class="relative flex h-14 items-center gap-3 overflow-hidden rounded-2xl border bg-[var(--surface)] px-4 transition-all duration-300 focus-within:-translate-y-0.5"
      :class="error
        ? 'border-[var(--danger)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--danger)_15%,transparent)]'
        : 'border-[var(--border)] hover:border-[var(--accent)]/50 focus-within:border-[var(--accent)] focus-within:shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--accent)_45%,transparent),0_0_0_4px_color-mix(in_srgb,var(--accent)_16%,transparent)]'"
    >
      <Icon v-if="icon" :name="icon" :size="20"
        class="shrink-0 text-[var(--muted)] transition-all duration-300 group-focus-within:scale-110 group-focus-within:text-[var(--accent)]" />

      <div class="relative min-w-0 flex-1">
        <input
          v-model="model"
          :type="type"
          :aria-label="label"
          :aria-invalid="error || undefined"
          :placeholder="placeholder || ' '"
          :autocomplete="autocomplete"
          :enterkeyhint="enterkeyhint"
          :minlength="minlength"
          autocapitalize="none"
          autocorrect="off"
          required
          class="peer block w-full rounded-none border-0 bg-transparent px-0 pb-1 pt-5 text-base text-[var(--text)] shadow-none outline-none placeholder:text-transparent focus:border-0 focus:shadow-none focus:outline-none focus:placeholder:text-[var(--muted)]/70"
        />
        <!-- span, not <label>, so the global label styles do not apply -->
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-0 top-1/2 origin-left -translate-y-1/2 text-[var(--muted)] transition-all duration-200 ease-out peer-focus:top-[0.85rem] peer-focus:scale-[0.78] peer-focus:font-semibold peer-focus:text-[var(--accent)] peer-[:not(:placeholder-shown)]:top-[0.85rem] peer-[:not(:placeholder-shown)]:scale-[0.78] peer-[:not(:placeholder-shown)]:font-semibold"
        >{{ label }}</span>
      </div>

      <slot name="end" />

      <!-- accent line that sweeps in from the left while focused -->
      <span class="pointer-events-none absolute bottom-0 left-0 h-[3px] w-0 rounded-full bg-[linear-gradient(90deg,var(--accent),color-mix(in_srgb,var(--accent)_40%,#22d3ee))] transition-all duration-500 ease-out group-focus-within:w-full" />
    </div>
    <p v-if="hint" class="mt-1.5 px-1 text-xs text-[var(--muted)]">{{ hint }}</p>
  </div>
</template>

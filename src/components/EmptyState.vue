<script setup>
import Icon from './Icon.vue';
defineProps({ glyph: { type: String, default: 'sparkles' }, title: { type: String, required: true }, text: { type: String, default: '' } });
</script>

<template>
  <div class="empty">
    <span class="empty-ico"><Icon :name="glyph" :size="22" /></span>
    <div><b>{{ title }}</b><p v-if="text" class="muted small">{{ text }}</p></div>
  </div>
</template>

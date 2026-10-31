<script setup>
import { ref, computed } from 'vue';
import Icon from './Icon.vue';

// An Excel file lists every room of the college; pick only the rooms the student assistants cover.
const props = defineProps({ labs: { type: Array, required: true }, skipped: { type: Number, default: 0 } });
const emit = defineEmits(['pick', 'cancel']);
const rooms = computed(() => {
  const n = {};
  props.labs.forEach((l) => { n[l.lab] = (n[l.lab] || 0) + 1; });
  return Object.entries(n).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
});
const chosen = ref([]);
</script>

<template>
  <div class="notice" role="group" aria-label="Choose laboratory rooms">
    <div>
      <b>Which rooms do the student assistants cover?</b>
      <p class="muted small">The file lists {{ rooms.length }} rooms. Tick only your laboratories.<template v-if="skipped"> {{ skipped }} deleted or unreadable rows were ignored.</template></p>
      <div class="chips">
        <label v-for="[room, n] in rooms" :key="room" class="check">
          <input v-model="chosen" type="checkbox" :value="room" /> <span>{{ room }} <small class="muted">({{ n }})</small></span>
        </label>
      </div>
      <div class="actions tight">
        <button type="button" class="primary" :disabled="!chosen.length" @click="emit('pick', labs.filter((l) => chosen.includes(l.lab)))">
          <Icon name="check" :size="16" /> Use {{ chosen.length || '' }} selected room{{ chosen.length === 1 ? '' : 's' }}
        </button>
        <button type="button" @click="emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import { extractLabs } from '../lib/ai.js';
import { DAYS, DAY_NAMES } from '../lib/schedule.js';
import { state, setMyLabs, clearMyLabs, showToast } from '../store.js';

// A student scans a picture of the laboratory schedule; it is used to compare with their own S.A schedule.
const input = ref(null);
const busy = ref(false);
const error = ref('');
const warnings = ref([]);
const draft = ref(null); // rows being checked before they are used
const preview = ref('');

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : 0; };
const blank = () => ({ lab: '', day: 'MON', start: 7 * 60, end: 17 * 60 });

async function onFile(file) {
  if (!file) return;
  error.value = ''; warnings.value = [];
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = URL.createObjectURL(file);
  busy.value = true;
  try {
    const { labs, warnings: w } = await extractLabs(file);
    if (!labs.length) throw new Error(w[0] || 'No laboratory times were found in that picture.');
    draft.value = labs;
    warnings.value = w;
  } catch (e) {
    error.value = `The picture could not be read automatically (${e.message}). Add the rooms and times by hand below.`;
    draft.value = [blank()];
  } finally {
    busy.value = false;
    if (input.value) input.value.value = '';
  }
}

const edit = (i, patch) => { draft.value = draft.value.map((l, k) => (k === i ? { ...l, ...patch } : l)); };
const remove = (i) => { draft.value = draft.value.filter((_, k) => k !== i); };
const add = () => { draft.value = [...draft.value, blank()]; };
const unnamed = computed(() => !!draft.value?.some((l) => !String(l.lab || '').trim()));
const valid = computed(() => !!draft.value?.length && draft.value.every((l) => l.end > l.start) && !unnamed.value);

function use() {
  setMyLabs(draft.value.map((l) => ({ ...l, lab: l.lab.trim() })));
  draft.value = null; warnings.value = [];
  showToast('Using your laboratory schedule.');
}
function cancel() { draft.value = null; error.value = ''; warnings.value = []; }
</script>

<template>
  <div class="labbox">
    <h3><Icon name="clock" :size="16" /> Laboratory schedule</h3>
    <p v-if="state.labSource === 'mine'" class="notice" role="status">
      <Icon name="check" :size="16" /> Using the laboratory schedule you scanned ({{ state.labs.length }} time{{ state.labs.length === 1 ? '' : 's' }}). It is kept on this device only.
    </p>
    <p v-else-if="state.labs.length" class="notice" role="status">
      <Icon name="check" :size="16" /> Using the laboratory schedule saved by the admin ({{ state.labs.length }} times). You can scan your own picture instead.
    </p>
    <p v-else class="notice err" role="alert">
      <Icon name="alert" :size="16" /> No laboratory schedule yet. Scan the laboratory schedule picture so FreeVer can compare it with your S.A schedule.
    </p>

    <div class="actions tight">
      <button type="button" :disabled="busy" @click="input?.click()">
        <Icon name="image" :size="16" /> {{ state.labSource === 'mine' || draft ? 'Scan another picture' : 'Scan laboratory picture' }}
      </button>
      <button v-if="state.labSource === 'mine'" type="button" class="link small" @click="clearMyLabs">Use the admin schedule again</button>
      <input ref="input" type="file" hidden accept="image/png,image/jpeg,image/webp" @change="onFile($event.target.files[0])" />
    </div>
    <p v-if="busy" class="notice" role="status"><Icon name="clock" :size="16" /> Reading the laboratory schedule...</p>
    <p v-if="error" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ error }}</p>

    <template v-if="draft">
      <ul v-if="warnings.length" class="issues">
        <li v-for="(w, k) in warnings" :key="k" class="ai"><Icon name="sparkles" :size="14" /> {{ w }}</li>
      </ul>
      <p class="muted small">Check what was read from the picture, fix anything wrong, then press Use this schedule.</p>
      <div class="labwork" :class="{ 'with-img': preview }">
        <img v-if="preview" :src="preview" alt="Your laboratory schedule picture" class="labimg" />
        <div class="labtable">
          <div v-for="(l, i) in draft" :key="i" class="labrow">
            <input type="text" :value="l.lab" placeholder="Room, e.g. 5501" aria-label="Laboratory room" @input="edit(i, { lab: $event.target.value })" />
            <select :value="l.day" aria-label="Day" @change="edit(i, { day: $event.target.value })">
              <option v-for="d in DAYS" :key="d" :value="d">{{ DAY_NAMES[d] }}</option>
            </select>
            <input type="time" :value="hhmm(l.start)" aria-label="Opens at" @change="edit(i, { start: toMin($event.target.value) })" />
            <span class="muted">to</span>
            <input type="time" :value="hhmm(l.end)" aria-label="Closes at" @change="edit(i, { end: toMin($event.target.value) })" />
            <button type="button" class="icon-btn" aria-label="Remove this laboratory time" @click="remove(i)"><Icon name="trash" :size="16" /></button>
          </div>
          <p v-if="draft.some((l) => l.end <= l.start)" class="warn small">A closing time must be later than its opening time.</p>
          <p v-if="unnamed" class="warn small">Name every laboratory room (for example 5501).</p>
          <div class="actions tight">
            <button type="button" @click="add"><Icon name="check" :size="16" /> Add time</button>
            <button type="button" class="primary" :disabled="!valid" @click="use">Use this schedule</button>
            <button type="button" @click="cancel">Cancel</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

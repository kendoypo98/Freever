<script setup>
import { computed, ref, watch } from 'vue';
import Icon from './Icon.vue';
import { state, showToast } from '../store.js';
import { dutyOverlaps, clampBreak, nextQuarter } from '../lib/overlaps.js';
import { sendBreak } from '../lib/requests.js';
import { fmtRange, niceName, DAY_NAMES } from '../lib/schedule.js';

// "You overlap with Pauline from 12 to 2: ask her to take the duty while you rest." Only people of your own room (block) are offered.
const props = defineProps({ meName: { type: String, required: true }, day: { type: String, required: true }, date: { type: String, required: true }, nowMins: { type: Number, required: true } });
const use24 = computed(() => state.prefs.use24);

const people = computed(() => dutyOverlaps({ model: state.model, me: props.meName, day: props.day, nowMins: props.nowMins }));
const who = ref(0);
const win = ref(0);
const dur = ref(30);
const start = ref(0);
const person = computed(() => people.value[who.value] || people.value[0]);
const window = computed(() => person.value?.windows[win.value] || person.value?.windows[0]);
const range = computed(() => (window.value ? clampBreak(window.value, start.value, dur.value) : null));

// when the person or window changes, start the break at the next quarter hour inside it
watch([person, window], () => { if (window.value) start.value = nextQuarter(Math.max(window.value.start, props.nowMins)); }, { immediate: true });
watch(who, () => { win.value = 0; });

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromInput = (v) => { const [h, m] = String(v).split(':').map(Number); if (Number.isFinite(h)) start.value = h * 60 + (m || 0); };
const first = (n) => niceName(n).split(/\s+/)[0];
const fmt = (w) => fmtRange(w.start, w.end, use24.value);

const busy = ref(false);
const note = ref({ ok: '', warn: '' });
const message = computed(() => range.value
  ? `Hi ${first(person.value.name)}, we're both on duty ${fmt(window.value)}. Can you take over the duty ${fmt(range.value)}? I'd like a short break. Thanks!`
  : '');

async function ask() {
  busy.value = true; note.value = { ok: '', warn: '' };
  try {
    const r = await sendBreak({ name: person.value.name, day: props.day, date: props.date, start: range.value.start, end: range.value.end });
    note.value = (r?.sent)
      ? { ok: `Asked ${first(person.value.name)} to take over ${fmt(range.value)}. Her answer appears under Requests.`.replace('Her', 'Their'), warn: '' }
      : { ok: '', warn: r?.no_account?.length ? `${first(person.value.name)} has no FreeVer account yet. Copy the message and send it in Messenger.` : 'That request was already sent.' };
  } catch (e) { note.value = { ok: '', warn: e.message }; }
  finally { busy.value = false; }
}
async function copy() {
  try { await navigator.clipboard.writeText(message.value); showToast('Message copied.'); }
  catch { note.value = { ok: '', warn: 'Could not copy automatically. Select the text and copy it.' }; }
}
</script>

<template>
  <div v-if="people.length && range" class="t-card t-break">
    <p class="t-label">Need a break?</p>
    <h2 class="t-headline">You overlap with {{ first(person.name) }}</h2>
    <p class="muted">You are both on duty {{ DAY_NAMES[day] }} {{ fmt(window) }}. Ask {{ first(person.name) }} to take the duty first while you rest.</p>

    <div v-if="people.length > 1" class="b-chips" role="group" aria-label="Who is on duty with you">
      <button v-for="(p, i) in people" :key="p.name" type="button" :class="{ on: i === who }" :aria-pressed="i === who" @click="who = i">
        {{ first(p.name) }}<small v-if="p.partner">partner</small>
      </button>
    </div>
    <div v-if="person.windows.length > 1" class="b-chips" role="group" aria-label="Shared time">
      <button v-for="(w, i) in person.windows" :key="i" type="button" :class="{ on: i === win }" :aria-pressed="i === win" @click="win = i">{{ fmt(w) }}</button>
    </div>

    <div class="b-row">
      <label class="b-field">Break starts
        <input type="time" step="900" :min="hhmm(window.start)" :max="hhmm(window.end)" :value="hhmm(range.start)" @change="fromInput($event.target.value)" />
      </label>
      <div class="b-field" role="group" aria-label="Break length">Length
        <div class="b-chips tight">
          <button v-for="m in [15, 30, 45, 60]" :key="m" type="button" :class="{ on: m === dur }" :aria-pressed="m === dur" @click="dur = m">{{ m }} min</button>
        </div>
      </div>
    </div>
    <p class="b-sum"><Icon name="clock" :size="16" /> {{ first(person.name) }} takes the duty {{ fmt(range) }}</p>

    <p v-if="note.ok" class="notice" role="status"><Icon name="check" :size="16" /> {{ note.ok }}</p>
    <p v-if="note.warn" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ note.warn }}</p>
    <div class="t-actions">
      <button class="primary" :disabled="busy" @click="ask"><Icon name="inbox" :size="16" /> {{ busy ? 'Sending...' : `Ask ${first(person.name)}` }}</button>
      <button @click="copy"><Icon name="copy" :size="16" /> Copy message</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import Icon from './Icon.vue';
import CountUp from './CountUp.vue';
import { weekSummary, hoursLabel } from '../lib/weekstats.js';
import { state } from '../store.js';
import { DAYS, DAY_NAMES, fmtTime, fmtRange } from '../lib/schedule.js';
import { AXIS, weekBlocks, place } from '../lib/week.js';
import { dayOf } from '../lib/today.js';
import { dutyOverlaps } from '../lib/overlaps.js';
import { niceName } from '../lib/schedule.js';

const use24 = computed(() => state.prefs.use24);
const meName = computed(() => state.me?.name || state.profile?.name);
const sa = computed(() => state.model?.sas.find((s) => s.name === meName.value) || null);
// when someone of your own room is on duty at the same time (the people you can ask to take the duty for a break)
const shared = computed(() => Object.fromEntries(DAYS.map((d) => [d, dutyOverlaps({ model: state.model, me: meName.value, day: d, nowMins: 0 })])));
const sharedRows = computed(() => DAYS.flatMap((d) => shared.value[d].map((p) => ({ day: d, name: p.name, windows: p.windows }))));
const blocks = computed(() => weekBlocks(sa.value, state.labs, shared.value));
const today = dayOf(new Date());
const now = ref(new Date());
const tick = setInterval(() => { now.value = new Date(); }, 30000);
onBeforeUnmount(() => clearInterval(tick));
const nowMins = computed(() => now.value.getHours() * 60 + now.value.getMinutes());
const showNow = computed(() => nowMins.value >= AXIS.start && nowMins.value <= AXIS.end);
const summary = computed(() => weekSummary(sa.value, state.labs));
const hours = Array.from({ length: (AXIS.end - AXIS.start) / 60 + 1 }, (_, i) => AXIS.start + i * 60);
const label = (m) => (use24.value ? `${String(m / 60).padStart(2, '0')}:00` : fmtTime(m).replace(':00 ', ' '));
const style = (b) => { const p = place(b); return { top: p.top + '%', height: p.height + '%' }; };
const KIND = { duty: 'Duty', class: 'Class', cover: 'Needs cover', shared: 'Both on duty' };
const title = (b) => `${KIND[b.kind]} ${fmtTime(b.start, use24.value)} - ${fmtTime(b.end, use24.value)}`;
const short = (b) => `${fmtTime(b.start, use24.value).replace(':00', '')} - ${fmtTime(b.end, use24.value).replace(':00', '')}`;
const hasDuty = computed(() => Object.values(blocks.value).some((l) => l.some((b) => b.kind === 'duty')));
</script>

<template>
  <section class="week">
    <header class="t-hero">
      <p class="t-date">Your timetable</p>
      <h1>My week</h1>
    </header>

    <div v-if="!sa" class="t-card"><p class="muted">Your account name isn't in the imported schedule yet, so there is nothing to draw. Use Find my name on the Today tab.</p></div>

    <div v-else class="t-card w-card">
      <div class="t-stats w-stats">
        <div><Icon name="clock" :size="18" /><b><CountUp :to="summary.duty" :fmt="hoursLabel" /></b><span>on duty</span></div>
        <div><Icon name="calendar" :size="18" /><b><CountUp :to="summary.class" :fmt="hoursLabel" /></b><span>in class</span></div>
        <div><Icon name="swap" :size="18" /><b><CountUp :to="summary.cover" :fmt="hoursLabel" /></b><span>a laboratory is open</span></div>
      </div>
      <div class="w-legend" aria-hidden="true">
        <span><i class="sw duty" /> Duty</span><span><i class="sw class" /> Class</span><span><i class="sw cover" /> A laboratory is open: needs cover if you cannot come</span><span><i class="sw shared" /> Both of you are on duty (ask for a break)</span>
      </div>
      <div class="w-scroll" role="region" aria-label="Weekly timetable" tabindex="0">
        <div class="w-grid">
          <div class="w-corner" />
          <div v-for="d in DAYS" :key="d" class="w-head" :class="{ today: d === today }">{{ DAY_NAMES[d].slice(0, 3) }}</div>
          <div class="w-axis">
            <span v-for="h in hours" :key="h" :style="{ top: place({ start: h, end: h }).top + '%' }">{{ label(h) }}</span>
          </div>
          <div v-for="(d, ci) in DAYS" :key="d" class="w-col" :class="{ today: d === today }">
            <i v-for="h in hours" :key="h" class="w-line" :style="{ top: place({ start: h, end: h }).top + '%' }" />
            <i v-if="d === today && showNow" class="w-now" :style="{ top: place({ start: nowMins, end: nowMins }).top + '%' }" />
            <div v-for="(b, i) in blocks[d]" :key="i" class="w-block" :class="b.kind" :style="{ ...style(b), '--c': ci }" :title="title(b)"><template v-if="b.kind === 'duty' || b.kind === 'class'">{{ short(b) }}</template></div>
          </div>
        </div>
      </div>
      <p v-if="!hasDuty" class="muted small">No duty hours were found for you in this schedule.</p>

      <div class="w-shared">
        <p class="t-label">Shared duty with your room</p>
        <ul v-if="sharedRows.length" class="q-list">
          <li v-for="r in sharedRows" :key="r.day + r.name" class="q-item">
            <div><b>{{ DAY_NAMES[r.day] }}</b><br><span class="muted">with {{ niceName(r.name) }}</span></div>
            <div class="w-times"><span v-for="(w, i) in r.windows" :key="i">{{ fmtRange(w.start, w.end, use24) }}</span></div>
          </li>
        </ul>
        <p v-else class="muted small">You and your room-mate are never on duty at the same time this week, so there is nobody to hand the duty to for a break.</p>
      </div>
    </div>
  </section>
</template>

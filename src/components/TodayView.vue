<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import EmptyState from './EmptyState.vue';
import CountUp from './CountUp.vue';
import BreakCard from './BreakCard.vue';
import { weekSummary, hoursLabel, spanLabel } from '../lib/weekstats.js';
import Icon from './Icon.vue';
import { state, isAdmin, generate, goStep, loadData } from '../store.js';
import { pendingCount } from '../lib/requests.js';
import { todayPlan } from '../lib/today.js';
import { DAY_NAMES, fmtRange, fmtTime, niceName } from '../lib/schedule.js';
import { pieceKey } from '../lib/reliever.js';

const use24 = computed(() => state.prefs.use24);
const meName = computed(() => state.me?.name || state.profile?.name);
const sa = computed(() => state.model?.sas.find((s) => s.name === meName.value) || null);
const chosen = computed(() => !!state.me && state.me.name !== state.profile?.name); // the account name is not in the schedule: the person picked their own
function changeName() { state.me = null; state.days = []; state.pieces = []; state.assignments = {}; goStep(1); }
// the clock ticks every minute so "on duty" and the countdown stay true while the page is open
const now = ref(new Date());
const tick = setInterval(() => { now.value = new Date(); }, 30000);
onBeforeUnmount(() => clearInterval(tick));
const plan = computed(() => todayPlan({ sa: sa.value, labs: state.labs, now: now.value }));
const nowMins = computed(() => now.value.getHours() * 60 + now.value.getMinutes());
const progress = computed(() => { const s = plan.value.nowShift; return s ? Math.min(100, Math.max(0, Math.round(((nowMins.value - s.start) / (s.end - s.start)) * 100))) : 0; });
const left = computed(() => (plan.value.nowShift ? spanLabel(plan.value.nowShift.end - nowMins.value) : ''));
const week = computed(() => weekSummary(sa.value, state.labs));
const DAY_SHORT = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat' };
const first = computed(() => niceName(state.profile?.name || '').split(/\s+/)[0]); // always the person who is logged in
const greeting = computed(() => { const h = now.value.getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; });
const dateLabel = computed(() => now.value.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
const range = (s) => fmtRange(s.start, s.end, use24.value);
const ranges = (r) => r.ranges.map(range).join(', ');

const headline = computed(() => {
  const p = plan.value;
  if (p.status === 'on') return `On duty until ${fmtTime(p.nowShift.end, use24.value)}`;
  if (p.status === 'later') return `Duty starts at ${fmtTime(p.duty.find((s) => s.start > nowMins.value).start, use24.value)}`;
  if (p.status === 'done') return 'Your duty today is finished';
  if (p.status === 'rest') return 'No duty on Sundays';
  return 'No duty today';
});
const nextLine = computed(() => {
  const n = plan.value.next;
  if (!n || plan.value.status === 'on' || plan.value.status === 'later') return '';
  return `Next duty: ${n.offset === 1 ? 'tomorrow' : DAY_NAMES[n.day]}, ${fmtRange(n.start, n.end, use24.value)}`;
});
const canRequest = computed(() => plan.value.status !== 'rest' && plan.value.status !== 'off' && plan.value.rooms.length > 0 && plan.value.status !== 'done');

const open = computed(() => state.pieces.filter((p) => !state.assignments[pieceKey(p)]).length);

/** The one-tap path: today's duty, today's date, straight to the reliever list. */
function requestToday() {
  state.me = { name: sa.value.name };
  state.days = [plan.value.day];
  state.dates = { ...state.dates, [plan.value.day]: plan.value.date };
  generate();
}
</script>

<template>
  <section class="today">
    <header class="t-hero">
      <p class="t-date">{{ dateLabel }}</p>
      <h1>{{ greeting }}, <span class="t-name">{{ first }}<svg class="t-squig" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 8 C 22 2, 40 12, 62 6 S 100 3, 117 7" pathLength="1" vector-effect="non-scaling-stroke" /></svg></span></h1>
      <p v-if="chosen" class="muted small">Showing the schedule of {{ niceName(state.me.name) }}. <button class="link" type="button" @click="changeName">Not you?</button></p>
    </header>

    <div v-if="!state.model" class="t-card">
      <EmptyState glyph="upload" :title="isAdmin() ? 'Set up the schedule' : 'No schedule yet'" :text="isAdmin() ? 'Import the S.A schedule and the laboratory schedule so students can find their relievers.' : 'The admin has not uploaded the S.A schedule yet. Check back soon.'" />
      <div v-if="isAdmin()" class="t-actions"><button class="primary lg" @click="goStep(0)"><Icon name="upload" :size="18" /> Open Setup</button></div>
    </div>

    <div v-else-if="!sa" class="t-card">
      <h2>We can't find you in the schedule</h2>
      <p class="muted">Your account name isn't in the imported schedule. Find your name as the schedule spells it and FreeVer will use your duty.</p>
      <div class="t-actions"><button class="primary lg" @click="goStep(1)"><Icon name="user" :size="18" /> Find my name</button></div>
    </div>

    <template v-else>
      <div class="t-main">
        <div class="t-card t-status" :data-status="plan.status">
          <p class="t-label">Today</p>
          <h2 class="t-headline">{{ headline }}</h2>
          <div v-if="plan.status === 'on'" class="t-progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" :aria-label="`${progress}% of today's duty done`">
            <i :style="{ width: progress + '%' }" /><span>{{ left }} left</span>
          </div>
          <p v-if="nextLine" class="muted">{{ nextLine }}</p>
          <ul v-if="plan.duty.length || plan.classes.length" class="t-timeline">
            <li v-for="(s, i) in plan.duty" :key="'d' + i"><span class="tag duty">Duty</span> {{ range(s) }}</li>
            <li v-for="(s, i) in plan.classes" :key="'c' + i"><span class="tag class">Class</span> {{ range(s) }}</li>
          </ul>
          <div class="t-actions">
            <button v-magnet class="primary lg" :disabled="!canRequest" @click="requestToday"><Icon name="swap" :size="18" /> I need a reliever today</button>
            <button class="lg" @click="goStep(1)">Another day</button>
          </div>
          <p class="muted small t-src">Schedule of {{ niceName(sa.name) }}<template v-if="state.uploadedAt"> &middot; saved {{ new Date(state.uploadedAt).toLocaleDateString() }}</template> &middot; <button class="link" type="button" @click="loadData">Refresh</button></p>
          <p v-if="plan.status === 'off' || plan.status === 'rest'" class="muted small">Nothing to cover today. Use Another day to plan ahead.</p>
          <p v-else-if="!plan.rooms.length" class="muted small">No laboratory is open during your duty today, so no reliever is needed.</p>
        </div>

        <div class="t-card">
          <p class="t-label">Rooms that need cover</p>
          <ul v-if="plan.rooms.length" class="t-rooms">
            <li v-for="r in plan.rooms" :key="r.lab"><b>Room {{ r.lab }}</b><span>{{ ranges(r) }}</span></li>
          </ul>
          <p v-else class="muted">{{ state.labs.length ? 'None of the open laboratories overlaps your duty today.' : 'The laboratory schedule has not been added yet.' }}</p>
        </div>
      </div>

      <BreakCard v-if="plan.status === 'on' || plan.status === 'later'" :me-name="meName" :day="plan.day" :date="plan.date" :now-mins="nowMins" />

      <div class="t-card t-week">
        <div class="t-weekhead"><p class="t-label">Your week</p><button class="link small" type="button" @click="state.tab = 'week'">Open timetable</button></div>
        <ul class="t-days">
          <li v-for="d in week.days" :key="d.day" :class="{ now: d.day === plan.day, off: !d.duty }">
            <span class="t-dname">{{ DAY_SHORT[d.day] }}</span>
            <span class="t-dbar" aria-hidden="true"><i :style="{ height: Math.min(100, (d.duty / 720) * 100) + '%' }" /></span>
            <span class="t-dhours">{{ d.duty ? hoursLabel(d.duty) : 'Off' }}</span>
          </li>
        </ul>
        <div class="t-stats">
          <div><Icon name="clock" :size="18" /><b><CountUp :to="week.duty" :fmt="hoursLabel" /></b><span>on duty this week</span></div>
          <div><Icon name="calendar" :size="18" /><b><CountUp :to="week.class" :fmt="hoursLabel" /></b><span>in class</span></div>
          <div><Icon name="swap" :size="18" /><b><CountUp :to="week.cover" :fmt="hoursLabel" /></b><span>a laboratory is open</span></div>
        </div>
      </div>

      <div v-if="pendingCount || state.pieces.length" class="t-side">
        <button v-if="pendingCount" class="t-link" @click="state.tab = 'inbox'">
          <Icon name="inbox" :size="20" />
          <span><b>{{ pendingCount }} request{{ pendingCount === 1 ? '' : 's' }} waiting</b><small>Someone asked you to cover for them</small></span>
          <Icon name="right" :size="16" />
        </button>
        <button v-if="state.pieces.length" class="t-link" @click="goStep(2)">
          <Icon name="swap" :size="20" />
          <span><b>Continue your reliever list</b><small>{{ open ? `${open} hour${open === 1 ? '' : 's'} still without a reliever` : 'All hours covered' }}</small></span>
          <Icon name="right" :size="16" />
        </button>
      </div>
    </template>
  </section>
</template>

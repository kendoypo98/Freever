<script setup>
import { ref, computed, watchEffect } from 'vue';
import Icon from './Icon.vue';
import LabScan from './LabScan.vue';
import { DAYS, DAY_NAMES, fmtRange, findUniqueName, niceName } from '../lib/schedule.js';
import { coverageByLab } from '../lib/reliever.js';
import { state, isAdmin, generate } from '../store.js';

const query = ref('');
const selected = computed(() => (state.me ? state.model.sas.find((s) => s.name === state.me.name) : null));
const account = computed(() => state.model.sas.find((s) => s.name === state.profile.name) || null);
// Names of other student assistants are confidential: only a single unambiguous match is ever revealed.
const admin = computed(() => isAdmin());
// Anyone whose account name is not in the schedule can type their name as the schedule spells it.
// Only a single, unambiguous match is shown, so nobody can browse other students' names.
const match = computed(() => (!selected.value && !account.value ? findUniqueName(query.value, state.model.sas) : null));
const duty = computed(() => (selected.value ? selected.value.shifts.filter((s) => s.type === 'duty') : []));
const workDays = computed(() => DAYS.filter((d) => duty.value.some((s) => s.day === d)));
const classOn = (d) => selected.value.shifts.filter((s) => s.day === d && s.type === 'class');
const dutyOn = (d) => duty.value.filter((s) => s.day === d);

// the comparison, shown before generating: where the laboratory hours overlap the student's duty
const coverage = computed(() => state.days.map((day) => ({
  day,
  duty: dutyOn(day),
  rooms: coverageByLab(duty.value, state.labs, day),
})));

function pick(sa) {
  state.me = { name: sa.name };
  state.days = DAYS.filter((d) => sa.shifts.some((s) => s.day === d && s.type === 'duty'));
}

// the account already knows who you are: pre-select it
watchEffect(() => { if (account.value && !state.me) pick(account.value); });

function toggle(d) {
  state.days = state.days.includes(d) ? state.days.filter((x) => x !== d) : [...state.days, d];
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <span class="badge-icon"><Icon name="user" /></span>
      <div>
        <h2>{{ selected ? `Hi ${niceName(selected.name)}!` : 'Who are you?' }}</h2>
        <p class="muted">
          {{ selected ? 'Which days do you need a reliever?'
            : 'Your account name is not in the schedule. Type your name as it appears in the schedule (first and last name).' }}
        </p>
      </div>
    </div>

    <template v-if="!selected && !account">
      <input v-model="query" type="text" class="search" placeholder="Your name (first and last name)" autocomplete="off"
        aria-label="Your full name as written in the schedule" @keydown.enter="match && pick(match)" />
      <div v-if="match" class="chips">
        <button class="primary" @click="pick(match)"><Icon name="check" :size="16" /> Continue as {{ niceName(match.name) }}</button>
      </div>
      <p v-else-if="query.trim()" class="muted small">Keep typing your full name. Names of other student assistants are kept private, so nothing is listed.</p>
    </template>

    <template v-if="selected">
      <div class="daygrid">
        <button v-for="d in workDays" :key="d" type="button" class="daycard" :class="{ on: state.days.includes(d) }"
          :aria-pressed="state.days.includes(d)" @click="toggle(d)">
          <b>{{ DAY_NAMES[d] }}</b>
          <span v-for="(s, i) in dutyOn(d)" :key="'d' + i" class="tag duty">{{ fmtRange(s.start, s.end, state.prefs.use24) }}</span>
          <span v-for="(s, i) in classOn(d)" :key="'c' + i" class="tag class">{{ fmtRange(s.start, s.end, state.prefs.use24) }}</span>
        </button>
      </div>
      <p v-if="!workDays.length" class="notice err" role="alert">No duty hours found for you in this schedule.</p>

      <div v-if="state.labs.length && coverage.length" class="compare">
        <h3>Your duty compared with the laboratory schedule</h3>
        <div v-for="c in coverage" :key="c.day" class="comparerow">
          <b>{{ DAY_NAMES[c.day] }}</b>
          <span class="muted small">Duty: {{ c.duty.map((s) => fmtRange(s.start, s.end, state.prefs.use24)).join(', ') }}</span>
          <template v-if="c.rooms.length">
            <span v-for="r in c.rooms" :key="r.lab" class="small">
              Room {{ r.lab }} is open: needs a reliever {{ r.ranges.map((x) => fmtRange(x.start, x.end, state.prefs.use24)).join(', ') }}
            </span>
          </template>
          <span v-else class="muted small">No laboratory is open during your duty, so no reliever is needed.</span>
        </div>
      </div>

      <LabScan v-if="!admin" />
    </template>

    <div class="actions">
      <button v-if="isAdmin()" @click="state.step = 0"><Icon name="left" :size="16" /> Back</button>
      <button class="primary" :disabled="!selected || !state.days.length || !state.labs.length" @click="generate">
        Generate reliever <Icon name="right" :size="16" />
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';
import Icon from './Icon.vue';
import { DAYS, DAY_NAMES, fmtRange, findUniqueName, niceName } from '../lib/schedule.js';
import { state, isAdmin, generate } from '../store.js';

const query = ref('');
const selected = computed(() => (state.me ? state.model.sas.find((s) => s.name === state.me.name) : null));
const account = computed(() => state.model.sas.find((s) => s.name === state.profile.name) || null);
// Names of other student assistants are confidential: only a single unambiguous match is ever revealed.
const admin = computed(() => isAdmin());
// Only an admin may act as someone else; everyone else is tied to their own account name.
const match = computed(() => (admin.value && !selected.value && !account.value ? findUniqueName(query.value, state.model.sas) : null));
const duty = computed(() => (selected.value ? selected.value.shifts.filter((s) => s.type === 'duty') : []));
const workDays = computed(() => DAYS.filter((d) => duty.value.some((s) => s.day === d)));
const classOn = (d) => selected.value.shifts.filter((s) => s.day === d && s.type === 'class');
const dutyOn = (d) => duty.value.filter((s) => s.day === d);

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
            : admin ? 'Your account is not in the current schedule. Type your name as it appears in the schedule.'
              : 'Your S.A name is not in the current schedule.' }}
        </p>
      </div>
    </div>

    <p v-if="!selected && !account && !admin" class="notice err" role="alert">
      <Icon name="alert" :size="16" /> "{{ niceName(state.profile.name) }}" is not in the saved schedule, so there are no duty hours to cover yet. If your name is spelled differently there, ask the admin to reset your account with the spelling from the schedule. Otherwise ask them to upload the latest schedule, then reload this page.
    </p>
    <template v-if="!selected && !account && admin">
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
    </template>

    <div class="actions">
      <button v-if="isAdmin()" @click="state.step = 0"><Icon name="left" :size="16" /> Back</button>
      <button class="primary" :disabled="!selected || !state.days.length" @click="generate">
        Generate reliever <Icon name="right" :size="16" />
      </button>
    </div>
  </section>
</template>

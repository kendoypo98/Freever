// Shared app state (Vue reactive store) and the actions that change it.
import { reactive, watch } from 'vue';
import { load, save, remove, setUser } from './lib/storage.js';
import { DEFAULT_PREFS, applyTheme } from './theme.js';
import { getProfile, logout as signOut } from './lib/auth.js';
import { loadSchedule, loadLabs } from './lib/db.js';
import { configured, supabase } from './lib/supabase.js';
import { DAYS } from './lib/schedule.js';
import { generateSlots } from './lib/reliever.js';

export const state = reactive({
  profile: undefined, // undefined = checking the session, null = logged out
  view: 'landing', // landing | login | register
  darkPre: false, // theme choice before logging in
  prefs: { ...DEFAULT_PREFS },
  model: null,
  uploadedAt: null,
  labs: [],
  status: { loading: false, error: '' },
  initError: '', // the session check failed for a reason other than being logged out
  toast: '',
  step: null, // null = pick a sensible first step once the schedule is loaded
  me: null,
  days: [],
  dates: {},
  absent: {},
  pieces: [],
  assignments: {},
});

try { state.darkPre = localStorage.getItem('freever-landing-dark') === '1'; } catch { /* ignore */ }

export const isAdmin = () => state.profile?.role === 'admin';

export function toggleLandingDark() {
  state.darkPre = !state.darkPre;
  try { localStorage.setItem('freever-landing-dark', state.darkPre ? '1' : '0'); } catch { /* ignore */ }
}

let toastTimer = null;
export function showToast(text, ms = 3500) {
  state.toast = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.toast = ''; }, ms);
}

/** In-app replacement for confirm(): resolves true / false. Rendered by ConfirmDialog.vue. */
export const dialog = reactive({ open: false, title: '', text: '', okLabel: 'OK', danger: false, resolve: null });
export function ask({ title, text = '', okLabel = 'OK', danger = false }) {
  return new Promise((resolve) => {
    Object.assign(dialog, { open: true, title, text, okLabel, danger, resolve });
  });
}
export function answer(ok) {
  const r = dialog.resolve;
  Object.assign(dialog, { open: false, resolve: null });
  r?.(ok);
}

/** Next calendar date (YYYY-MM-DD) falling on the given MON..SAT; today only counts while the shift (endMin) is still running. */
function nextDateFor(day, endMin = 0) {
  const target = DAYS.indexOf(day) + 1; // Date.getDay(): MON = 1
  const d = new Date();
  const nowMin = d.getHours() * 60 + d.getMinutes();
  if (d.getDay() === target && endMin && nowMin >= endMin) d.setDate(d.getDate() + 1);
  while (d.getDay() !== target) d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function loadData() {
  state.status = { loading: true, error: '' };
  try {
    const r = await loadSchedule();
    if (r) { state.model = r.model; state.uploadedAt = r.uploadedAt; }
    state.status = { loading: false, error: '' };
  } catch (e) {
    state.status = { loading: false, error: e.message };
  }
  try { state.labs = await loadLabs(); } catch { /* labs are optional: shifts are simply not clipped */ }
  restoreFlow();
}

// ----- the wizard survives a refresh (kept per account in this browser) -----
let restoring = false;
function restoreFlow() {
  const w = load('wizard2', null);
  if (!w || !state.model || state.me) return;
  if (!state.model.sas.some((s) => s.name === w.me?.name)) return;
  restoring = true;
  state.me = w.me; state.days = w.days || []; state.dates = w.dates || {}; state.absent = w.absent || {};
  state.pieces = w.pieces || []; state.assignments = w.assignments || {};
  if (state.pieces.length) state.step = w.step ?? null;
  restoring = false;
}
watch(() => [state.me, state.days, state.dates, state.absent, state.pieces, state.assignments, state.step], () => {
  if (!state.profile || restoring || !state.me) return; // cleared only by resetFlow, so enter() cannot wipe it before restoreFlow runs
  save('wizard2', { me: state.me, days: state.days, dates: state.dates, absent: state.absent, pieces: state.pieces, assignments: state.assignments, step: state.step });
}, { deep: true });

/** Called once a profile is known (after the session check or a login). */
export function enter(profile) {
  state.profile = profile;
  if (!profile) return;
  setUser(profile.id); // scope local prefs to this account
  setPrefs(load('prefs', {}));
  state.model = null; state.labs = []; state.step = null;
  state.me = null; state.days = []; state.dates = {}; state.absent = {}; state.pieces = []; state.assignments = {};
  loadData();
}

let listening = false;
export async function init() {
  if (!configured) { state.profile = null; return; }
  state.initError = '';
  try {
    enter(await getProfile());
  } catch (e) {
    // could not reach the server: do not pretend the person logged out
    state.initError = e.message || 'Could not reach the server.';
    state.profile = null;
  }
  if (!listening) {
    listening = true;
    supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { state.profile = null; state.view = 'login'; } });
  }
}

export async function logout() {
  await signOut();
  state.view = 'landing';
  state.profile = null;
}

// theme: before login use the landing choice, afterwards the saved preferences
watch(() => [state.profile, state.darkPre, state.prefs], () => {
  if (state.profile) { applyTheme(state.prefs); save('prefs', state.prefs); }
  else applyTheme({ ...DEFAULT_PREFS, mode: state.darkPre ? 'dark' : 'light' });
}, { deep: true, immediate: true });

// a newly loaded schedule may not contain the previously chosen person any more
watch(() => [state.model, state.me], () => {
  if (state.me && state.model && !state.model.sas.some((s) => s.name === state.me.name)) {
    state.me = null; state.days = []; state.pieces = []; state.assignments = {};
  }
});

export function setResult(r) { state.pieces = r.pieces; state.assignments = r.assignments; }

export function generate() {
  const mine = state.model?.sas.find((s) => s.name === state.me?.name);
  if (!mine) return;
  const dates = {};
  state.days.forEach((d) => {
    const latestEnd = Math.max(0, ...mine.shifts.filter((s) => s.type === 'duty' && s.day === d).map((s) => s.end));
    dates[d] = state.dates[d] || nextDateFor(d, latestEnd);
  });
  state.dates = dates;
  const duty = mine.shifts.filter((s) => s.type === 'duty' && state.days.includes(s.day));
  setResult(generateSlots({ model: state.model, me: state.me, shifts: duty, dates, absent: state.absent, labs: state.labs }));
  state.step = 2;
}

export function resetFlow() {
  remove('wizard2');
  state.step = isAdmin() ? 0 : 1;
  state.me = null; state.days = []; state.dates = {}; state.absent = {}; state.pieces = []; state.assignments = {};
}

/** Replace the preference values in place so open panels keep a live reference to state.prefs. */
export function setPrefs(next) {
  Object.keys(state.prefs).forEach((k) => { delete state.prefs[k]; });
  Object.assign(state.prefs, { ...DEFAULT_PREFS, ...next });
}

export function resetSettings() {
  setPrefs({});
}

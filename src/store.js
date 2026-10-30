// Shared app state (Vue reactive store) and the actions that change it.
import { reactive, watch } from 'vue';
import { load, save, remove, setUser } from './lib/storage.js';
import { DEFAULT_PREFS, applyTheme } from './theme.js';
import { getProfile, logout as signOut } from './lib/auth.js';
import { loadSchedule, loadLabs } from './lib/db.js';
import { configured, supabase } from './lib/supabase.js';
import { DAYS } from './lib/schedule.js';
import { generateSlots } from './lib/reliever.js';
import { sfx } from './lib/sfx.js';
import { isNetworkError, rememberProfile, forgetProfile, savedProfile } from './lib/offline.js';

export const state = reactive({
  profile: undefined, // undefined = checking the session, null = logged out
  view: 'landing', // landing | login | register
  darkPre: false, // theme choice before logging in
  prefs: { ...DEFAULT_PREFS },
  model: null,
  uploadedAt: null,
  labs: [],
  labSource: 'shared', // 'shared' = saved by the admin, 'mine' = scanned by this student on this device
  status: { loading: false, error: '' },
  initError: '', // the session check failed for a reason other than being logged out
  offline: false, // no connection: the schedule and profile come from the copy saved on this device
  dataAt: null, // when the schedule on screen was last fetched from the server (ms)
  toast: '',
  step: null, // reliever wizard: 0 = setup (admin), 1 = you, 2 = reliever, 3 = message. null = pick a sensible one
  tab: null, // today | week | wizard | inbox | setup. null = Today (the admin goes to Setup until a schedule exists)
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

/** Keep a copy of the schedule on this device for offline use (called whenever the server's copy has just been read). */
export function cacheSchedule(model, uploadedAt) {
  state.dataAt = Date.now();
  save('cache-schedule', { model, uploadedAt, at: state.dataAt });
}

export async function loadData() {
  state.status = { loading: true, error: '' };
  try {
    const r = await loadSchedule();
    if (r) { state.model = r.model; state.uploadedAt = r.uploadedAt; cacheSchedule(r.model, r.uploadedAt); }
    else remove('cache-schedule');
    state.offline = false;
    state.status = { loading: false, error: '' };
  } catch (e) {
    const cached = isNetworkError(e) ? load('cache-schedule', null) : null; // offline: use the copy saved on this device
    if (cached) { state.model = cached.model; state.uploadedAt = cached.uploadedAt; state.dataAt = cached.at; state.offline = true; state.status = { loading: false, error: '' }; }
    else state.status = { loading: false, error: e.message };
  }
  try { state.labs = await loadLabs(); save('cache-labs', state.labs); }
  catch (e) { const c = isNetworkError(e) ? load('cache-labs', null) : null; if (c) state.labs = c; /* else the schedule simply has no rooms yet */ }
  // a student's own laboratory scan (kept on this device) replaces the shared one; the admin always uses the shared one
  const mine = load('mylabs', null);
  if (!isAdmin() && Array.isArray(mine) && mine.length) { state.labs = mine; state.labSource = 'mine'; } else state.labSource = 'shared';
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
  rememberProfile(profile); // lets the app open offline later
  setUser(profile.id); // scope local prefs to this account
  const saved = load('prefs', {});
  if (saved.v !== 4) { delete saved.sfx; delete saved.sfxVolume; delete saved.sfxHover; } // adopt the quiet interface sounds once
  setPrefs(saved);
  state.model = null; state.labs = []; state.labSource = 'shared'; state.step = null; state.tab = null;
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
    // no connection but still signed in on this device: open with the saved copy
    let local = null;
    if (isNetworkError(e)) {
      try { const { data } = await supabase.auth.getSession(); local = data.session ? savedProfile(data.session.user.id) : null; } catch { /* ignore */ }
    }
    if (local) { state.offline = true; enter(local); }
    else {
      // could not reach the server: do not pretend the person logged out
      state.initError = e.message || 'Could not reach the server.';
      state.profile = null;
    }
  }
  if (!listening) {
    listening = true;
    supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { state.profile = null; state.view = 'login'; } });
  }
}

window.addEventListener('offline', () => { state.offline = true; });
window.addEventListener('online', () => { state.offline = false; if (state.profile) loadData(); }); // back online: refresh from the server

export async function logout() {
  forgetProfile();
  await signOut();
  state.view = 'landing';
  state.profile = null;
}

// theme: before login use the landing choice, afterwards the saved preferences
watch(() => [state.profile, state.darkPre, state.prefs], () => {
  if (state.profile) { applyTheme(state.prefs); save('prefs', state.prefs); }
  else applyTheme({ ...DEFAULT_PREFS, scene: '', mode: state.darkPre ? 'dark' : 'light' }); // the landing and login pages stay plain
}, { deep: true, immediate: true });

// a newly loaded schedule may not contain the previously chosen person any more
watch(() => [state.model, state.me], () => {
  if (state.me && state.model && !state.model.sas.some((s) => s.name === state.me.name)) {
    state.me = null; state.days = []; state.pieces = []; state.assignments = {};
  }
});

/** Use a laboratory schedule the student scanned themselves (this device only; nothing is saved for others). */
export function setMyLabs(labs) {
  state.labs = labs; state.labSource = 'mine';
  save('mylabs', labs);
  state.pieces = []; state.assignments = {}; // they were built from the old rooms
}

export async function clearMyLabs() {
  remove('mylabs');
  state.labSource = 'shared';
  try { state.labs = await loadLabs(); } catch { state.labs = []; }
  state.pieces = []; state.assignments = {};
}

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
  goStep(2);
  showToast('Reliever list ready!');
  sfx.ready();
}

/** Move to a wizard step (0 is the admin's Setup screen) and show the tab that holds it. */
export function goStep(n) {
  state.step = n;
  state.tab = n === 0 ? 'setup' : 'wizard';
}

export function resetFlow() {
  remove('wizard2');
  goStep(1);
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

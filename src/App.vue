<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from './components/Icon.vue';
import Landing from './components/Landing.vue';
import LoginPage from './components/LoginPage.vue';
import ImportStep from './components/ImportStep.vue';
import IdentifyStep from './components/IdentifyStep.vue';
import RelieverStep from './components/RelieverStep.vue';
import MessageStep from './components/MessageStep.vue';
import TodayView from './components/TodayView.vue';
import WeekView from './components/WeekView.vue';
import InboxView from './components/InboxView.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import SceneBackground from './components/SceneBackground.vue';
import { sfx, setSfx } from './lib/sfx.js';
import { state, init, isAdmin, logout, setPrefs, loadData, ask, showToast, goStep } from './store.js';
import { getPrefix } from './lib/storage.js';
import { niceName } from './lib/schedule.js';
import { pendingCount, refreshInbox, clearInbox } from './lib/requests.js';

// the three steps of one reliever request (Setup is the admin's own tab)
const STEPS = [
  { label: 'You', icon: 'user', i: 1 },
  { label: 'Reliever', icon: 'swap', i: 2 },
  { label: 'Message', icon: 'message', i: 3 },
];

const settingsOpen = ref(false);

// sound effects (Settings > Appearance): a soft blip when a button is pressed
watch(() => [state.prefs.sfx, state.prefs.sfxVolume], () => setSfx(state.prefs.sfx, state.prefs.sfxVolume), { immediate: true });
const clickSound = (e) => { if (e.target.closest?.('.app button, .drawer button, .confirm button')) sfx.click(); };
// hover: once per control, mouse only (touch has no hover), never while the control is disabled
const HOVERABLE = '.app button, .drawer button, .confirm button, .daycard, .drop';
let lastHovered = null;
const hoverSound = (e) => {
  if (e.pointerType !== 'mouse' || !state.prefs.sfxHover) return;
  const el = e.target.closest?.(HOVERABLE);
  if (!el || el === lastHovered || el.disabled) return;
  lastHovered = el;
  sfx.hover();
};
const leaveSound = (e) => { if (lastHovered && !lastHovered.contains(e.relatedTarget)) lastHovered = null; };
onMounted(() => {
  document.addEventListener('click', clickSound);
  document.addEventListener('pointerover', hoverSound, { passive: true });
  document.addEventListener('pointerout', leaveSound, { passive: true });
});
onBeforeUnmount(() => {
  document.removeEventListener('click', clickSound);
  document.removeEventListener('pointerover', hoverSound);
  document.removeEventListener('pointerout', leaveSound);
});
onMounted(init);

const admin = computed(() => isAdmin());
const tab = computed(() => state.tab ?? (admin.value && !state.model ? 'setup' : 'today'));
const tabs = computed(() => [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'week', label: 'Week', icon: 'calendar' },
  { id: 'wizard', label: 'Reliever', icon: 'swap' },
  { id: 'inbox', label: 'Requests', icon: 'inbox', badge: pendingCount.value },
  ...(admin.value ? [{ id: 'setup', label: 'Setup', icon: 'upload' }] : []),
]);
const current = computed(() => (state.step >= 1 ? state.step : 1));
const curIdx = computed(() => Math.max(0, STEPS.findIndex((s) => s.i === current.value)));
const steps = STEPS;
// one Back link above every step of the request flow (the admin's first step goes back to Setup)
const backTo = computed(() => (current.value === 3 ? 2 : current.value === 2 ? 1 : current.value === 1 && admin.value ? 0 : null));
const backLabel = computed(() => (backTo.value === 0 ? 'Back to Setup' : 'Back'));

// the white pill under the active tab slides to the new tab (transform only: position and scale are set as CSS variables)
// the soft background light follows the time of day (morning warm, afternoon neutral, evening deeper)
const hourNow = ref(new Date().getHours());
const tod = computed(() => (hourNow.value < 11 ? 'morning' : hourNow.value < 17 ? 'afternoon' : 'evening'));
const todTimer = setInterval(() => { hourNow.value = new Date().getHours(); }, 300000);
onBeforeUnmount(() => clearInterval(todTimer));

const tabsEl = ref(null);
let tabsObserver = null;
function movePill() {
  const el = tabsEl.value;
  const on = el?.querySelector('.tab.on');
  if (!on) return;
  el.style.setProperty('--pill-x', `${on.offsetLeft}px`);
  el.style.setProperty('--pill-w', String(on.offsetWidth));
  if (!el.dataset.ready) requestAnimationFrame(() => { el.dataset.ready = '1'; }); // no slide on the very first placement
}
watch(tabsEl, (el) => {
  tabsObserver?.disconnect();
  if (el) { tabsObserver = new ResizeObserver(movePill); tabsObserver.observe(el); nextTick(movePill); }
});
watch(() => [tab.value, tabs.value.length], () => nextTick(movePill));
onBeforeUnmount(() => tabsObserver?.disconnect());

// requests: fetch once after login, then every 30 s while the tab is visible
let inboxTimer = null;
watch(() => state.profile?.id, (id) => {
  clearInterval(inboxTimer);
  if (!id) { clearInbox(); return; }
  refreshInbox(id);
  inboxTimer = setInterval(() => { if (!document.hidden) refreshInbox(id); }, 30000);
}, { immediate: true });
const onVisible = () => { if (!document.hidden && state.profile?.id) refreshInbox(state.profile.id); };
onMounted(() => document.addEventListener('visibilitychange', onVisible));
onBeforeUnmount(() => { clearInterval(inboxTimer); document.removeEventListener('visibilitychange', onVisible); });
// Once the reliever step has been reached it stays reachable, even when no laboratory is open on the chosen days.
const maxStep = computed(() => (!state.model ? 1 : !state.me || !state.days.length ? 1 : state.pieces.length || state.step >= 2 ? 3 : 1));
const logoSrc = `${import.meta.env.BASE_URL}favicon.svg`;

const systemDark = ref(false);
let mq = null;
const onScheme = (e) => { systemDark.value = e.matches; };
onMounted(() => {
  mq = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = mq.matches;
  mq.addEventListener('change', onScheme);
});
onBeforeUnmount(() => mq?.removeEventListener('change', onScheme));
const isDark = computed(() => state.prefs.mode === 'dark' || (state.prefs.mode === 'system' && systemDark.value));

function toggleDark() { state.prefs.mode = isDark.value ? 'light' : 'dark'; }

async function clearSettings() {
  const ok = await ask({ title: 'Reset your settings?', text: 'Colours, text size, background and message wording go back to the defaults on this device. The shared schedule is not affected.', okLabel: 'Reset settings', danger: true });
  if (!ok) return;
  Object.keys(localStorage).filter((k) => k.startsWith(getPrefix())).forEach((k) => localStorage.removeItem(k));
  setPrefs({ use24: state.prefs.use24, fontSize: state.prefs.fontSize });
  settingsOpen.value = false;
  showToast('Settings reset.');
}
</script>

<template>
  <div v-if="state.profile === undefined" class="boot text-[var(--muted)]" role="status">Loading&hellip;</div>

  <div v-else-if="state.initError && !state.profile" class="boot px-6 text-center">
    <div class="card max-w-md">
      <h2>Can't reach FreeVer right now</h2>
      <p class="muted mt-1">{{ state.initError }} Check your internet connection and try again. Your work is saved on this device.</p>
      <div class="actions"><button class="primary" @click="init"><Icon name="refresh" :size="16" /> Try again</button></div>
    </div>
  </div>

  <Landing v-else-if="!state.profile && state.view === 'landing'" />
  <LoginPage v-else-if="!state.profile" :key="state.view" />

  <div v-else class="app" :data-tod="tod">
    <div class="ambient" aria-hidden="true"><i /><i /><i /></div>
    <header class="topbar">
      <div class="topbar-in">
        <button class="brand" type="button" aria-label="FreeVer home" @click="state.tab = 'today'">
          <img :src="logoSrc" alt="" width="30" height="30" />
          <span class="wordmark">Free<span>Ver</span></span>
        </button>

        <nav ref="tabsEl" class="tabs" aria-label="Main">
          <button v-for="t in tabs" :key="t.id" type="button" class="tab" :class="{ on: t.id === tab }"
            :aria-current="t.id === tab ? 'page' : undefined" @click="state.tab = t.id">
            <span class="tab-ico"><Icon :name="t.icon" :size="20" /><b v-if="t.badge" :key="t.badge" class="tab-badge" :aria-label="`${t.badge} waiting`">{{ t.badge }}</b></span>
            <span class="tab-label">{{ t.label }}</span>
          </button>
        </nav>

        <div class="who">
          <span class="who-name" :title="niceName(state.profile.name)">
            {{ niceName(state.profile.name) }}<template v-if="admin"> <b>admin</b></template>
          </span>
          <button class="icon-btn" aria-label="Toggle dark mode" title="Dark / light" @click="toggleDark">
            <Icon :name="isDark ? 'sun' : 'moon'" />
          </button>
          <button class="icon-btn" aria-label="Settings" title="Settings" @click="settingsOpen = true"><Icon name="sliders" /></button>
          <button class="icon-btn" aria-label="Log out" title="Log out" @click="logout"><Icon name="logout" /></button>
        </div>
      </div>
    </header>

    <p v-if="state.offline" class="offline" role="status">
      <Icon name="alert" :size="16" /> You're offline. Showing the schedule saved on this device<template v-if="state.dataAt"> ({{ new Date(state.dataAt).toLocaleDateString() }})</template>. You can still plan a reliever and copy the message; requests and saving need a connection.
    </p>

    <main class="page">
      <section v-if="state.status.loading" class="card grid gap-3" role="status" aria-label="Loading the schedule">
        <div class="skeleton h-6 w-1/3" /><div class="skeleton h-16 w-full" /><div class="skeleton h-16 w-full" />
      </section>
      <section v-if="state.status.error" class="card">
        <p class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ state.status.error }}</p>
        <div class="actions"><button @click="loadData"><Icon name="refresh" :size="16" /> Try again</button></div>
      </section>

      <template v-if="!state.status.loading">
        <Transition mode="out-in" name="view">
          <TodayView v-if="tab === 'today'" key="today" />
          <WeekView v-else-if="tab === 'week'" key="week" />
          <InboxView v-else-if="tab === 'inbox'" key="inbox" />
          <ImportStep v-else-if="tab === 'setup' && admin" key="setup" />
          <div v-else-if="tab === 'wizard'" key="wizard" class="wizard">
            <section v-if="!state.model" class="card">
              <h2>No schedule yet</h2>
              <p class="mt-1 text-[var(--muted)]">The admin has not uploaded the S.A schedule yet. Ask them to upload it, then check again.</p>
              <div class="actions"><button @click="loadData"><Icon name="refresh" :size="16" /> Check again</button></div>
            </section>
            <template v-else>
              <button v-if="backTo !== null" type="button" class="backlink" @click="goStep(backTo)"><Icon name="left" :size="16" /> {{ backLabel }}</button>
              <ol class="wizsteps" aria-label="Steps of a reliever request">
                <li v-for="(s, idx) in steps" :key="s.label">
                  <button type="button" :class="{ on: s.i === current, done: idx < curIdx }" :disabled="s.i > maxStep"
                    :aria-current="s.i === current ? 'step' : undefined" @click="state.step = s.i">
                    <span class="wiz-n"><Icon v-if="idx < curIdx" name="check" :size="12" /><template v-else>{{ idx + 1 }}</template></span>{{ s.label }}
                  </button>
                </li>
              </ol>
              <IdentifyStep v-if="current === 1" key="identify" />
              <RelieverStep v-else-if="current === 2 && state.me" key="reliever" />
              <MessageStep v-else-if="current === 3 && state.me" key="message" />
            </template>
          </div>
        </Transition>
      </template>
    </main>

    <footer class="foot">FreeVer &middot; other students' names are never shown in the app</footer>

    <template v-if="settingsOpen">
      <div class="scrim" @click="settingsOpen = false" />
      <SettingsPanel @close="settingsOpen = false" @clear="clearSettings" />
    </template>
  </div>

  <SceneBackground />
  <ConfirmDialog />
  <div v-if="state.toast" class="toast" role="status" aria-live="polite">{{ state.toast }}</div>
</template>

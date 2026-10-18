<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from './components/Icon.vue';
import Landing from './components/Landing.vue';
import LoginPage from './components/LoginPage.vue';
import ImportStep from './components/ImportStep.vue';
import IdentifyStep from './components/IdentifyStep.vue';
import RelieverStep from './components/RelieverStep.vue';
import MessageStep from './components/MessageStep.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import SceneBackground from './components/SceneBackground.vue';
import { sfx, setSfx } from './lib/sfx.js';
import { state, init, isAdmin, logout, setPrefs, loadData, ask, showToast } from './store.js';
import { getPrefix } from './lib/storage.js';
import { niceName } from './lib/schedule.js';

const STEPS = [
  { label: 'Import', icon: 'upload', adminOnly: true },
  { label: 'You', icon: 'user' },
  { label: 'Reliever', icon: 'swap' },
  { label: 'Message', icon: 'message' },
];

const settingsOpen = ref(false);

// sound effects (Settings > Appearance): a soft blip when a button is pressed
watch(() => [state.prefs.sfx, state.prefs.sfxVolume], () => setSfx(state.prefs.sfx, state.prefs.sfxVolume), { immediate: true });
const clickSound = (e) => { if (e.target.closest?.('.app button, .drawer button, .confirm button')) sfx.click(); };
onMounted(() => document.addEventListener('click', clickSound));
onBeforeUnmount(() => document.removeEventListener('click', clickSound));
onMounted(init);

const admin = computed(() => isAdmin());
const steps = computed(() => STEPS.map((s, i) => ({ ...s, i })).filter((s) => admin.value || !s.adminOnly));
const current = computed(() => state.step ?? (admin.value && !state.model ? 0 : 1));
const curIdx = computed(() => Math.max(0, steps.value.findIndex((s) => s.i === current.value)));
const questPct = computed(() => Math.round(((curIdx.value + 1) / steps.value.length) * 100));
// Once the reliever step has been reached it stays reachable, even when no laboratory is open on the chosen days.
const maxStep = computed(() => (!state.model ? 0 : !state.me || !state.days.length ? 1 : state.pieces.length || state.step >= 2 ? 3 : 1));
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

  <div v-else class="app mx-auto max-w-[1000px] pb-10 sm:px-5">
    <header class="sticky top-0 z-10 -mx-[14px] mb-4 sm:-mx-5 sm:mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
      <div class="flex items-center gap-2.5">
        <img :src="logoSrc" alt="" width="34" height="34" />
        <span class="wordmark">Free<span>Ver</span></span>
      </div>

      <nav class="order-last flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto sm:flex-1" aria-label="Steps">
        <template v-for="(s, idx) in steps" :key="s.label">
          <span v-if="idx" class="hidden h-px w-6 bg-[var(--border)] sm:block" />
          <button
            class="!rounded-full !border-0 !px-3 !py-1.5 !shadow-none"
            :class="s.i === current ? '!bg-[var(--accent)] !text-white' : 'text-[var(--muted)]'"
            :disabled="s.i > maxStep"
            :aria-current="s.i === current ? 'step' : undefined"
            :aria-label="`Step ${idx + 1}: ${s.label}`"
            :title="s.i > maxStep ? 'Finish the previous step first' : s.label"
            @click="state.step = s.i"
          >
            <span class="grid size-5 place-items-center rounded-full text-[11px] font-bold"
              :class="s.i === current ? 'bg-white/25' : idx < curIdx ? 'bg-[var(--ok)] text-white' : 'bg-[var(--border)]'">
              <Icon v-if="idx < curIdx" name="check" :size="12" /><template v-else>{{ idx + 1 }}</template>
            </span>
            <span class="hidden sm:inline">{{ s.label }}</span>
          </button>
        </template>
      </nav>

      <div class="ml-auto flex items-center gap-0.5">
        <span class="mr-2 max-w-[90px] truncate border-r border-[var(--border)] pr-3 text-sm text-[var(--muted)] sm:max-w-[150px]" :title="niceName(state.profile.name)">
          {{ niceName(state.profile.name) }}<template v-if="admin"> <b class="text-[var(--accent)]">admin</b></template>
        </span>
        <button class="icon-btn" aria-label="Toggle dark mode" title="Dark / light" @click="toggleDark">
          <Icon :name="isDark ? 'sun' : 'moon'" />
        </button>
        <button class="icon-btn" aria-label="Settings" title="Settings" @click="settingsOpen = true"><Icon name="sliders" /></button>
        <button class="icon-btn" aria-label="Log out" title="Log out" @click="logout"><Icon name="logout" /></button>
      </div>
      <div class="quest" role="progressbar" aria-label="Progress" :aria-valuenow="curIdx + 1" aria-valuemin="1" :aria-valuemax="steps.length">
        <div class="quest-fill" :style="{ width: questPct + '%' }" />
      </div>
    </header>

    <main class="grid gap-4">
      <section v-if="state.status.loading" class="card grid gap-3" role="status" aria-label="Loading the schedule">
        <div class="skeleton h-6 w-1/3" /><div class="skeleton h-16 w-full" /><div class="skeleton h-16 w-full" />
      </section>
      <section v-if="state.status.error" class="card">
        <p class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ state.status.error }}</p>
        <div class="actions"><button @click="loadData"><Icon name="refresh" :size="16" /> Try again</button></div>
      </section>
      <section v-if="!state.status.loading && !state.model && !admin && !state.status.error" class="card">
        <h2>No schedule yet</h2>
        <p class="mt-1 text-[var(--muted)]">The admin has not uploaded the S.A schedule yet. Ask them to upload it, then check again.</p>
        <div class="actions"><button @click="loadData"><Icon name="refresh" :size="16" /> Check again</button></div>
      </section>

      <Transition mode="out-in" enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
        enter-from-class="opacity-0 translate-y-3" leave-active-class="transition duration-150 motion-reduce:transition-none"
        leave-to-class="opacity-0 -translate-y-1">
        <ImportStep v-if="!state.status.loading && current === 0 && admin" key="import" />
        <IdentifyStep v-else-if="current === 1 && state.model" key="identify" />
        <RelieverStep v-else-if="current === 2 && state.model && state.me" key="reliever" />
        <MessageStep v-else-if="current === 3 && state.model && state.me" key="message" />
      </Transition>
    </main>

    <footer class="mt-8 text-center text-sm text-[var(--muted)]">FreeVer &middot; other students' names are never shown in the app</footer>

    <template v-if="settingsOpen">
      <div class="scrim" @click="settingsOpen = false" />
      <SettingsPanel @close="settingsOpen = false" @clear="clearSettings" />
    </template>
  </div>

  <SceneBackground />
  <ConfirmDialog />
  <div v-if="state.toast" class="toast" role="status" aria-live="polite">{{ state.toast }}</div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import { PRESETS, imageToDataUrl } from '../theme.js';
import { DEFAULT_TEMPLATE } from '../lib/message.js';
import { changePassword, resetPasswordFor } from '../lib/auth.js';
import { state, resetSettings, isAdmin, showToast } from '../store.js';

const emit = defineEmits(['close', 'clear']);
const prefs = state.prefs; // setPrefs() updates this object in place, so it stays valid after a reset
const panel = ref(null);
const imageError = ref('');
const tab = ref('appearance');
const TABS = [
  { id: 'appearance', label: 'Appearance', icon: 'sliders' },
  { id: 'message', label: 'Message', icon: 'message' },
  { id: 'account', label: 'Account', icon: 'user' },
];
function tabKey(e) {
  const i = TABS.findIndex((t) => t.id === tab.value);
  const n = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : null;
  if (n === null) return;
  e.preventDefault();
  tab.value = TABS[(n + TABS.length) % TABS.length].id;
  e.currentTarget.parentElement.querySelector('[aria-selected="true"]')?.focus();
}
let opener = null;

// behave like a real dialog: focus moves in, Tab stays inside, Esc closes, focus goes back to the button that opened it
const focusables = () => [...panel.value.querySelectorAll('button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
function onKey(e) {
  if (e.key === 'Escape') { emit('close'); return; }
  if (e.key !== 'Tab') return;
  const f = focusables();
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}
onMounted(() => { opener = document.activeElement; panel.value?.querySelector('button')?.focus(); });
onBeforeUnmount(() => opener?.focus?.());

const pw = ref('');
const pwMsg = ref({ ok: false, text: '' });
async function savePassword() {
  try { await changePassword(pw.value); pw.value = ''; pwMsg.value = { ok: true, text: 'Password changed.' }; }
  catch (e) { pwMsg.value = { ok: false, text: e.message }; }
}
const target = ref('');
const tempPw = ref('');
const resetMsg = ref({ ok: false, text: '' });
async function resetStudent() {
  try {
    await resetPasswordFor(target.value, tempPw.value);
    resetMsg.value = { ok: true, text: `Done. Give them the temporary password and ask them to change it in Settings.` };
    target.value = ''; tempPw.value = '';
  } catch (e) { resetMsg.value = { ok: false, text: e.message }; }
}
const tpl = (k) => (prefs.tpl[k] ?? DEFAULT_TEMPLATE[k]);
const setTpl = (k, v) => { prefs.tpl = { ...prefs.tpl, [k]: v }; };

async function onImage(e) {
  const f = e.target.files[0];
  if (!f) return;
  imageError.value = '';
  try {
    const url = await imageToDataUrl(f);
    if (url.length > 900_000) throw new Error('That image is too large to save. Pick a smaller one.');
    state.prefs.bgImage = url;
  } catch (err) { imageError.value = err.message; }
  finally { e.target.value = ''; }
}
function pickPreset(id) { state.prefs.preset = id; state.prefs.useCustomAccent = false; }
function pickAccent(e) { state.prefs.accent = e.target.value; state.prefs.useCustomAccent = true; }
</script>

<template>
  <aside ref="panel" class="drawer" role="dialog" aria-modal="true" aria-label="Settings" @keydown="onKey">
    <div class="row between settings-head">
      <h2>Settings</h2>
      <button class="icon-btn" aria-label="Close" @click="emit('close')"><Icon name="x" /></button>
    </div>

    <div class="settings-layout">
      <nav class="settings-nav" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
        <button v-for="t in TABS" :key="t.id" :id="`tab-${t.id}`" type="button" role="tab" class="settings-tab"
          :class="{ on: tab === t.id }" :aria-selected="tab === t.id" :aria-controls="`pane-${t.id}`"
          :tabindex="tab === t.id ? 0 : -1" @click="tab = t.id" @keydown="tabKey">
          <Icon :name="t.icon" :size="16" /> {{ t.label }}
        </button>
      </nav>

      <div class="settings-body">
    <div v-show="tab === 'appearance'" id="pane-appearance" role="tabpanel" aria-labelledby="tab-appearance">
    <h3>Appearance</h3>
    <div class="seggroup">
      <button v-for="m in [['system', 'sliders'], ['light', 'sun'], ['dark', 'moon']]" :key="m[0]" class="seg" type="button"
        :class="{ on: prefs.mode === m[0] }" :aria-pressed="prefs.mode === m[0]" @click="prefs.mode = m[0]">
        <Icon :name="m[1]" :size="14" /> {{ m[0] }}
      </button>
    </div>

    <label>Theme color</label>
    <div class="swatches">
      <button v-for="p in PRESETS" :key="p.id" type="button" class="swatch" :aria-pressed="prefs.preset === p.id && !prefs.useCustomAccent" :class="{ on: prefs.preset === p.id && !prefs.useCustomAccent }"
        :style="{ background: p.accent }" :title="p.name" :aria-label="p.name" @click="pickPreset(p.id)" />
    </div>
    <label class="inline">Custom accent
      <input type="color" :value="prefs.accent" @input="pickAccent" />
    </label>

    <label><Icon name="image" :size="14" /> Background image</label>
    <input type="file" accept="image/*" aria-label="Choose a background image" @change="onImage" />
    <p v-if="imageError" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ imageError }}</p>
    <template v-if="prefs.bgImage">
      <label class="inline">Dim <input v-model.number="prefs.bgDim" type="range" min="0" max="0.9" step="0.05" /></label>
      <button @click="prefs.bgImage = ''">Remove image</button>
    </template>

    <label class="inline">Text size <input v-model.number="prefs.fontSize" type="range" min="13" max="20" /></label>
    <label class="check"><input v-model="prefs.use24" type="checkbox" /> <span>24-hour time</span></label>

    <div class="actions">
      <button type="button" @click="resetSettings(); showToast('Appearance reset.')">Reset appearance only</button>
      <button type="button" class="danger" @click="emit('clear')"><Icon name="trash" :size="16" /> Reset everything on this device</button>
    </div>
    </div>

    <div v-show="tab === 'message'" id="pane-message" role="tabpanel" aria-labelledby="tab-message">
    <h3>Message template</h3>
    <label v-for="k in ['greeting', 'intro', 'closing']" :key="k">{{ k[0].toUpperCase() + k.slice(1) }}
      <textarea :rows="k === 'greeting' ? 1 : 2" :value="tpl(k)" @input="setTpl(k, $event.target.value)" />
    </label>
    <label>Signature (defaults to your name)
      <input type="text" :value="tpl('signature')" @input="setTpl('signature', $event.target.value)" />
    </label>

    </div>

    <div v-show="tab === 'account'" id="pane-account" role="tabpanel" aria-labelledby="tab-account">
    <h3>Account</h3>
    <form @submit.prevent="savePassword">
      <label>Change your password
        <input v-model="pw" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" />
      </label>
      <div class="actions tight"><button class="primary" :disabled="pw.length < 8">Change password</button></div>
      <p v-if="pwMsg.text" class="notice small" :class="{ err: !pwMsg.ok }" :role="pwMsg.ok ? 'status' : 'alert'">{{ pwMsg.text }}</p>
    </form>

    <template v-if="isAdmin()">
      <h3>Help a student who forgot their password</h3>
      <form @submit.prevent="resetStudent">
        <label>Student ID or S.A name
          <input v-model="target" type="text" autocomplete="off" />
        </label>
        <label>Temporary password
          <input v-model="tempPw" type="text" autocomplete="off" minlength="8" placeholder="At least 8 characters" />
        </label>
        <div class="actions tight"><button class="primary" :disabled="!target.trim() || tempPw.length < 8">Set temporary password</button></div>
        <p v-if="resetMsg.text" class="notice small" :class="{ err: !resetMsg.ok }" :role="resetMsg.ok ? 'status' : 'alert'">{{ resetMsg.text }}</p>
      </form>
    </template>

    </div>
      </div>
    </div>
  </aside>
</template>

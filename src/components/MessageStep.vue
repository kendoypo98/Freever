<script setup>
import { ref, computed, watch } from 'vue';
import Icon from './Icon.vue';
import { buildMessage } from '../lib/message.js';
import { state, resetFlow } from '../store.js';
import { burst } from '../lib/confetti.js';

const generated = computed(() => buildMessage({
  me: state.me, pieces: state.pieces, assignments: state.assignments, dates: state.dates, tpl: state.prefs.tpl, use24: state.prefs.use24, model: state.model,
}));
const text = ref(generated.value);
const copied = ref(false);
const copyFailed = ref(false);
const done = ref(false); // the message was copied at least once: quest complete
const area = ref(null);
watch(generated, (v) => { text.value = v; });

async function copy() {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text.value);
    ok = true;
  } catch {
    area.value.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
  }
  copied.value = ok;
  if (ok) { done.value = true; burst(); }
  copyFailed.value = !ok;
  setTimeout(() => { copied.value = false; copyFailed.value = false; }, 3000);
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <span class="badge-icon"><Icon name="message" /></span>
      <div>
        <h2>Copy &amp; send</h2>
        <p class="muted">Edit the text if you like, then paste it into Messenger.</p>
      </div>
    </div>
    <textarea ref="area" v-model="text" aria-label="Message to send" :rows="Math.min(24, text.split('\n').length + 2)" />
    <p v-if="done" class="quest-complete" role="status">
      <Icon name="sparkles" :size="18" /> Quest complete! Your reliever message is copied. Paste it into Messenger.
    </p>
    <p v-if="copyFailed" class="notice err" role="alert">
      <Icon name="alert" :size="16" /> Couldn't copy automatically. The text is selected, so press Ctrl+C (or long-press and Copy).
    </p>
    <div class="actions">
      <button @click="state.step = 2"><Icon name="left" :size="16" /> Back</button>
      <button @click="text = generated">Reset text</button>
      <button class="primary" @click="copy"><Icon :name="copied ? 'check' : 'copy'" :size="16" /> {{ copied ? 'Copied!' : 'Copy message' }}</button>
      <button @click="resetFlow">Start over</button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import Icon from './Icon.vue';
import { buildMessage } from '../lib/message.js';
import { state, resetFlow, goStep } from '../store.js';
import { burst } from '../lib/confetti.js';
import { sendRequests } from '../lib/requests.js';
import { sfx } from '../lib/sfx.js';
import { previewRows, coverageByPerson } from '../lib/messagePreview.js';
import { pieceKey } from '../lib/reliever.js';
import { hoursLabel } from '../lib/weekstats.js';
import { niceName, initialsOf } from '../lib/schedule.js';

const generated = computed(() => buildMessage({
  me: state.me, pieces: state.pieces, assignments: state.assignments, dates: state.dates, tpl: state.prefs.tpl, use24: state.prefs.use24, model: state.model,
}));
const text = ref(generated.value);
const copied = ref(false);
const copyFailed = ref(false);
const done = ref(false); // the message was copied at least once: quest complete
const area = ref(null);
const editing = ref(false);
watch(generated, (v) => { text.value = v; });

const rows = computed(() => previewRows(text.value));
const bubbleKey = computed(() => generated.value); // a regenerated message pops in again
const people = computed(() => coverageByPerson(state.pieces, state.assignments, pieceKey));
const covered = computed(() => people.value.reduce((n, p) => n + p.mins, 0));
const gaps = computed(() => state.pieces.filter((p) => !state.assignments[pieceKey(p)]).length);
const canShare = typeof navigator !== 'undefined' && !!navigator.share;
async function share() { try { await navigator.share({ text: text.value }); } catch { /* cancelled */ } }

// optional: also ask the relievers inside FreeVer, so they can accept or decline there
const sending = ref(false);
const sendNote = ref({ ok: '', warn: '' });
async function sendInApp() {
  sending.value = true; sendNote.value = { ok: '', warn: '' };
  try {
    const r = await sendRequests({ pieces: state.pieces, assignments: state.assignments, dates: state.dates });
    const n = r?.sent || 0;
    const missing = r?.no_account || [];
    sendNote.value = {
      ok: n ? `Sent ${n} request${n === 1 ? '' : 's'}. Answers appear under Requests.` : 'Nothing new to send.',
      warn: missing.length ? `${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} no FreeVer account yet. Send them the message in Messenger.` : '',
    };
  } catch (e) { sendNote.value = { ok: '', warn: e.message }; }
  finally { sending.value = false; }
}

async function copy() {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text.value);
    ok = true;
  } catch {
    editing.value = true;
    await new Promise((r) => setTimeout(r));
    area.value?.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
  }
  copied.value = ok;
  if (ok) { done.value = true; burst(); sfx.success(); } else sfx.error();
  copyFailed.value = !ok;
  setTimeout(() => { copied.value = false; copyFailed.value = false; }, 3000);
}
</script>

<template>
  <section class="msg">
    <header class="t-hero m-hero">
      <p class="t-date">Step 3 of 3</p>
      <h1>Your message is ready</h1>
      <p class="muted">Preview it, change anything you like, then paste it into your group chat.</p>
    </header>

    <div class="m-grid">
      <div class="m-preview" :class="{ copied }" aria-label="Preview of the message">
        <div class="m-chatbar">
          <span class="avatar sm">{{ initialsOf(state.me.name) }}</span>
          <div><b>Group chat</b><small>{{ people.length }} reliever{{ people.length === 1 ? '' : 's' }} &middot; {{ hoursLabel(covered) }} covered</small></div>
        </div>
        <div class="m-scroll">
          <div class="m-bubble" :key="bubbleKey">
            <template v-for="(r, i) in rows" :key="i">
              <span v-if="r.type === 'gap'" class="b-gap" />
              <p v-else-if="r.type === 'title'" class="b-title">{{ r.text }}</p>
              <p v-else-if="r.type === 'room'" class="b-room"><span>Room {{ r.label }}</span></p>
              <p v-else-if="r.type === 'slot'" class="b-slot" :style="{ '--i': i }">
                <span class="b-time">{{ r.from }} - {{ r.to }}</span>
                <span class="b-who" :class="{ empty: r.empty }">{{ r.who }}<em v-if="r.ot">OT</em></span>
              </p>
              <p v-else class="b-text">{{ r.text }}</p>
            </template>
          </div>
          <p class="m-status" role="status">{{ copied ? 'Copied. Paste it into your group chat.' : 'Not sent yet' }}</p>
        </div>
      </div>

      <div class="m-side">
        <div class="t-card">
          <p class="t-label">Who covers what</p>
          <ul v-if="people.length" class="m-people">
            <li v-for="p in people" :key="p.name">
              <span class="avatar">{{ initialsOf(p.name) }}</span>
              <span class="m-pname"><b>{{ niceName(p.name) }}</b></span>
              <span class="m-hours">{{ hoursLabel(p.mins) }}</span>
            </li>
          </ul>
          <p v-else class="muted">Nobody was assigned. Go back and pick relievers.</p>
          <p v-if="gaps" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ gaps }} hour{{ gaps === 1 ? '' : 's' }} still without a reliever. They show as TBD.</p>
        </div>

        <div class="t-card">
          <div class="m-edithead">
            <p class="t-label">Message text</p>
            <button class="link small" type="button" @click="editing = !editing">{{ editing ? 'Hide editor' : 'Edit text' }}</button>
          </div>
          <Transition name="fold">
            <div v-if="editing" class="m-edit">
              <textarea ref="area" v-model="text" aria-label="Message to send" :rows="Math.min(18, text.split('\n').length + 2)" />
              <button class="link small" type="button" @click="text = generated">Reset text</button>
            </div>
          </Transition>
          <p v-if="!editing" class="muted small">Change the title or closing line for good under Settings, Message.</p>
          <p v-if="copyFailed" class="notice err" role="alert"><Icon name="alert" :size="16" /> Couldn't copy automatically. Open Edit text, select the text and press Ctrl+C.</p>

          <div class="m-actions">
            <button v-magnet class="primary lg m-copy" :class="{ ok: copied }" @click="copy">
              <Icon :name="copied ? 'check' : 'copy'" :size="18" /> {{ copied ? 'Copied' : 'Copy message' }}
            </button>
            <button v-if="canShare" class="lg" @click="share"><Icon name="upload" :size="18" /> Share</button>
          </div>
        </div>

        <div class="t-card m-inapp">
          <p class="t-label">Or ask them inside FreeVer</p>
          <p class="muted small">Each reliever gets a request and can accept or decline. Answers appear under Requests.</p>
          <p v-if="sendNote.ok" class="notice" role="status"><Icon name="check" :size="16" /> {{ sendNote.ok }}</p>
          <p v-if="sendNote.warn" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ sendNote.warn }}</p>
          <div class="t-actions"><button :disabled="sending" @click="sendInApp"><Icon name="inbox" :size="16" /> {{ sending ? 'Sending...' : 'Send in-app requests' }}</button></div>
        </div>
      </div>
    </div>

    <div class="m-foot">
      <span />
      <button class="ghost" @click="resetFlow">Start over</button>
    </div>
  </section>
</template>

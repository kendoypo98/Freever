<script setup>
import { computed, ref } from 'vue';
import Icon from './Icon.vue';
import EmptyState from './EmptyState.vue';
import { state, showToast, ask } from '../store.js';
import { inbox, refreshInbox, respond, cancel } from '../lib/requests.js';
import { DAY_NAMES, fmtRange, niceName } from '../lib/schedule.js';
import { formatDate } from '../lib/message.js';

const busy = ref(0);
const use24 = computed(() => state.prefs.use24);
const waiting = computed(() => inbox.received.filter((r) => r.status === 'pending'));
const answered = computed(() => inbox.received.filter((r) => r.status !== 'pending').slice(0, 8));
const when = (r) => `${DAY_NAMES[r.day]}, ${formatDate(r.on_date)}`;
const what = (r) => `${fmtRange(r.start_min, r.end_min, use24.value)}${r.lab ? ` · Room ${r.lab}` : ''}`;
const isBreak = (r) => r.kind === 'break';
const LABEL = { pending: 'Waiting', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled' };

async function run(id, fn, done) {
  busy.value = id;
  try { await fn(); showToast(done); await refreshInbox(state.profile.id); }
  catch (e) { showToast(e.message, 5000); }
  finally { busy.value = 0; }
}
const answer = (r, accept) => run(r.id, () => respond(r.id, accept), accept ? 'Accepted. They will see it.' : 'Declined.');
async function withdraw(r) {
  if (await ask({ title: 'Cancel this request?', text: `${niceName(r.reliever_name)} will see it as cancelled.`, okLabel: 'Cancel request', danger: true })) run(r.id, () => cancel(r.id), 'Request cancelled.');
}
</script>

<template>
  <section class="inbox">
    <header class="t-hero">
      <p class="t-date">Reliever requests</p>
      <h1>Requests</h1>
      <p class="muted">{{ waiting.length ? `${waiting.length} waiting for your answer` : 'You are all caught up' }}<template v-if="inbox.sent.length"> &middot; {{ inbox.sent.length }} sent</template></p>
    </header>

    <p v-if="inbox.error" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ inbox.error }}</p>

    <div class="t-card">
      <p class="t-label">Waiting for your answer</p>
      <ul v-if="waiting.length" class="q-list">
        <li v-for="r in waiting" :key="r.id" class="q-item">
          <div><b>{{ niceName(r.requester_name) }}</b> {{ isBreak(r) ? 'asks you to take the duty while they rest' : 'asks you to cover' }}<br><span class="muted">{{ when(r) }}</span><br><span>{{ what(r) }}</span><span v-if="isBreak(r)" class="muted"> &middot; you are both on duty</span></div>
          <div class="q-actions">
            <button :disabled="busy === r.id" @click="answer(r, false)">Decline</button>
            <button class="primary" :disabled="busy === r.id" @click="answer(r, true)"><Icon name="check" :size="16" /> Accept</button>
          </div>
        </li>
      </ul>
      <EmptyState v-else-if="inbox.loaded" glyph="check" title="Nothing waiting on you" text="When a student picks you as their reliever and sends a request, it shows up here for you to accept or decline." />
      <p v-else class="muted">Loading...</p>
    </div>

    <div class="t-card">
      <p class="t-label">Requests you sent</p>
      <ul v-if="inbox.sent.length" class="q-list">
        <li v-for="r in inbox.sent.slice(0, 12)" :key="r.id" class="q-item">
          <div><b>{{ niceName(r.reliever_name) }}</b><span v-if="isBreak(r)" class="muted"> &middot; break</span><br><span class="muted">{{ when(r) }}</span><br><span>{{ what(r) }}</span></div>
          <div class="q-actions">
            <span class="status" :data-s="r.status">{{ LABEL[r.status] }}</span>
            <button v-if="r.status === 'pending' || r.status === 'accepted'" class="ghost" :disabled="busy === r.id" @click="withdraw(r)">Cancel</button>
          </div>
        </li>
      </ul>
      <EmptyState v-else glyph="message" title="No requests sent yet" text="After you generate a reliever list, press Send in-app requests on the Message step. Their answers appear here." />
    </div>

    <div v-if="answered.length" class="t-card">
      <p class="t-label">Recently answered</p>
      <ul class="q-list">
        <li v-for="r in answered" :key="r.id" class="q-item">
          <div><b>{{ niceName(r.requester_name) }}</b><br><span class="muted">{{ when(r) }} · {{ what(r) }}</span></div>
          <span class="status" :data-s="r.status">{{ LABEL[r.status] }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

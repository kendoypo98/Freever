<script setup>
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import { DAYS, DAY_NAMES, fmtRange, swapTeam, niceName, initialsOf } from '../lib/schedule.js';
import { rankCandidates, generateSlots, pickReliever, isOvertime, pieceKey } from '../lib/reliever.js';
import { formatDate } from '../lib/message.js';
import { state, setResult, ask, showToast, isAdmin } from '../store.js';

const STATUS_LABEL = { leave: 'on leave', absent: 'absent' };
const notes = ref({}); // pieceKey -> why this person was picked
const open = ref(null); // pieceKey whose "next best" list is open
const showBusy = ref({}); // pieceKey -> also list people who are in class or on leave
const showOt = ref({}); // pieceKey -> also list people who are off duty (overtime, needs supervisor approval)
const touched = ref(false); // the person changed something by hand

const me = computed(() => state.me);
const mine = computed(() => state.model.sas.find((s) => s.name === me.value?.name));
const use24 = computed(() => state.prefs.use24);

const hoursOf = (asg, list) => {
  const load = {};
  list.forEach((p) => { const n = asg[pieceKey(p)]; if (n) load[n] = (load[n] || 0) + (p.end - p.start); });
  return load;
};
const load = computed(() => hoursOf(state.assignments, state.pieces));

function regenerate({ absent = state.absent, dates = state.dates, shuffle = false, model = state.model } = {}) {
  const avoid = shuffle ? new Set(Object.values(state.assignments).filter(Boolean)) : new Set();
  const meNow = model.sas.find((s) => s.name === me.value?.name) || mine.value;
  if (!meNow) return;
  const shifts = meNow.shifts.filter((s) => s.type === 'duty' && state.days.includes(s.day));
  notes.value = {}; open.value = null;
  setResult(generateSlots({ model, me: me.value, shifts, dates, absent, avoid, random: shuffle, labs: state.labs }));
}

/** Re-running the automatic pick throws away manual choices, so ask first. */
async function confirmDiscard(what) {
  if (!touched.value) return true;
  const ok = await ask({ title: `${what}?`, text: 'Your manual choices, Leave/Absent marks and notes for this review will be replaced by a fresh automatic pick.', okLabel: what, danger: true });
  if (ok) touched.value = false;
  return ok;
}

async function changeDate(day, value) {
  if (!value || value === state.dates[day]) return;
  if (!(await confirmDiscard('Change date'))) return;
  const dates = { ...state.dates, [day]: value };
  state.dates = dates;
  regenerate({ dates });
}

async function reshuffle() {
  if (!(await confirmDiscard('Regenerate'))) return;
  regenerate({ shuffle: true });
  showToast('New reliever picks generated.');
}

// The sheet lists two names per block; if left/right are the other way round, swap the pair.
async function swapBlock(name) {
  if (!(await confirmDiscard('Swap columns'))) return;
  const model = swapTeam(state.model, name);
  state.model = model;
  regenerate({ model });
}

/** Leave / Absent: only that person's slots on that date are re-filled with the best free S.A. */
function markUnavailable(date, name, status) {
  const absent = { ...state.absent, [`${date}|${name}`]: status };
  state.absent = absent;
  touched.value = true;
  const asg = { ...state.assignments };
  const nextNotes = { ...notes.value };
  for (const p of state.pieces.filter((x) => state.dates[x.day] === date && state.assignments[pieceKey(x)] === name)) {
    delete asg[pieceKey(p)];
    const who = pickReliever({
      model: state.model, me: me.value, slot: p, dateKey: date, absent,
      load: hoursOf(asg, state.pieces), avoid: new Set([name]),
    });
    asg[pieceKey(p)] = who;
    nextNotes[pieceKey(p)] = who
      ? `${niceName(name)} is ${STATUS_LABEL[status]}. Replaced automatically with the best match.`
      : `${niceName(name)} is ${STATUS_LABEL[status]} and nobody else is free for this time.`;
  }
  notes.value = nextNotes;
  open.value = null;
  setResult({ pieces: state.pieces, assignments: asg });
}

/** White cells are non-working hours: only with the supervisor's approval, so ask before assigning. */
async function setOvertime(key, name) {
  const ok = await ask({
    title: `Assign ${niceName(name)} as overtime?`,
    text: `${niceName(name)} is not on duty at this time (non-working hours). They cannot be forced to work unless the supervisor approves it. Continue only if the supervisor has approved.`,
    okLabel: 'Supervisor approved',
  });
  if (ok) setPiece(key, name);
}

function setPiece(key, name) {
  touched.value = true;
  setResult({ pieces: state.pieces, assignments: { ...state.assignments, [key]: name } });
  open.value = null;
}

const hours = (p) => Math.round(((p.end - p.start) / 60) * 10) / 10;
const hourLabel = (m) => { const h = Math.floor(m / 60) % 24; return use24.value ? String(h).padStart(2, '0') : `${h % 12 || 12}${h >= 12 ? 'p' : 'a'}`; };
const hasTeam = (name) => !!state.model.sas.find((s) => s.name === name)?.team;
const missing = computed(() => state.pieces.filter((p) => !state.assignments[pieceKey(p)]).length);
const closedDays = computed(() => state.days.filter((d) => !state.pieces.some((p) => p.day === d)));

/** Everything a row needs, grouped day -> laboratory room, computed once per render. */
const days = computed(() => DAYS.filter((d) => state.days.includes(d)).map((day) => {
  const date = state.dates[day] || '';
  const dayPieces = state.pieces.filter((p) => p.day === day);
  const labNames = [...new Set(dayPieces.map((p) => p.lab))];
  return {
    day, date,
    labs: labNames.map((lab) => ({
      lab,
      rows: dayPieces.filter((p) => p.lab === lab).map((p) => {
        const key = pieceKey(p);
        const cands = rankCandidates({ model: state.model, me: me.value, piece: p, dateKey: date, absent: state.absent, load: load.value });
        const current = state.assignments[key] || '';
        const cur = cands.find((c) => c.name === current);
        return {
          key, p, date, current, cur,
          ot: !!cur && isOvertime(state.model.sas.find((s) => s.name === current), p),
          alternatives: cands.filter((c) => c.free && !c.ot && !c.status && c.name !== current).slice(0, 4),
          overtime: cands.filter((c) => c.free && c.ot && !c.status && c.name !== current),
          others: cands.filter((c) => c.name !== current && (!c.free || c.status)),
        };
      }),
    })),
  };
}));
</script>

<template>
  <section v-if="mine" class="card">
    <div class="card-head">
      <span class="badge-icon"><Icon name="swap" /></span>
      <div>
        <h2>Review reliever</h2>
        <p class="muted">FreeVer picks a student assistant who is on duty (yellow) and not in class (blue). Press Leave or Absent and the replacement is chosen automatically. Students off duty (white) are never assigned automatically.</p>
      </div>
    </div>
    <p v-if="!state.labs.length" class="notice err" role="alert">
      <Icon name="alert" :size="16" /> The laboratory schedule is missing, so there is nothing to cover. {{ isAdmin() ? 'Import and save it in step 1.' : 'Go back and scan the laboratory picture.' }}
    </p>
    <p v-else class="notice">
      <Icon name="clock" :size="16" /> One list per laboratory room, one hour per line, only while that room is open. <b>OT</b> = non-working hours (white): only with the supervisor's approval.
    </p>

    <div v-for="d in days" :key="d.day" class="daybox">
      <div class="row between wrap">
        <h3>{{ DAY_NAMES[d.day] }}</h3>
        <label class="inline">
          <Icon name="calendar" :size="16" />
          <input type="date" :value="d.date" @change="changeDate(d.day, $event.target.value)" />
        </label>
      </div>
      <div v-if="d.date" class="muted small">{{ formatDate(d.date) }}</div>
      <p v-if="closedDays.includes(d.day)" class="muted small">No laboratory is open during your duty on this day, so no reliever is needed.</p>

      <template v-for="L in d.labs" :key="L.lab">
      <h4 class="labhead">Room {{ L.lab }}</h4>
      <div class="rgrid">
      <article v-for="(r, idx) in L.rows" :key="r.key" class="rcard" :data-rarity="!r.cur ? 'none' : r.ot ? 'ot' : 'duty'" :style="{ animationDelay: idx * 60 + 'ms' }">
        <header class="rc-title">
          <span class="rc-gem left" :title="`Slot ${idx + 1}`">{{ idx + 1 }}</span>
          <h5 class="rc-name">{{ r.cur ? niceName(r.cur.name) : 'No reliever' }}</h5>
          <span class="rc-gem right" :title="`${r.alternatives.length} backup(s) on duty`">{{ r.alternatives.length }}</span>
        </header>

        <div class="rc-art">
          <span class="rc-ribbon" :title="`Starts at ${fmtRange(r.p.start, r.p.end, use24).split(' – ')[0]}`">{{ hourLabel(r.p.start) }}</span>
          <div class="rc-emblem"><span class="avatar">{{ r.cur ? initialsOf(r.cur.name) : '?' }}</span></div>
        </div>

        <div class="rc-band">
          <span class="rc-type">{{ !r.cur ? 'Empty' : !r.cur.free ? 'In class' : r.ot ? 'Overtime' : r.cur.partner ? 'Partner' : 'On duty' }}</span>
          <span class="rc-hex" :title="`${hours(r.p)} hour(s) to cover`"><b>{{ hours(r.p) }}</b></span>
          <span class="rc-stat" :title="r.cur ? 'Hours this person covers on this list' : ''">
            <Icon name="clock" :size="14" /> {{ r.cur ? Math.round(((r.cur.load || 0) / 60) * 10) / 10 : 0 }}h
          </span>
        </div>

        <div class="rc-text">
          <div class="rc-time"><Icon name="clock" :size="14" /> {{ fmtRange(r.p.start, r.p.end, use24) }} &middot; Room {{ r.p.lab }}</div>
          <p v-if="!r.cur" class="muted small">Nobody on duty is available. Use Change to pick someone.</p>
          <p v-else-if="r.cur.free && !r.ot" class="muted small">On duty and out of class.<template v-if="r.cur.partner"> Block partner.</template></p>
          <p v-else-if="r.cur.free" class="warn small">Off duty (white): needs the supervisor's approval.</p>
          <p v-else class="warn small">
            In class: {{ r.cur.conflicts.map((c) => `${c.type} ${fmtRange(c.start, c.end, use24)}`).join(', ') }}
          </p>
          <p v-if="r.cur?.status" class="pill bad">{{ STATUS_LABEL[r.cur.status] }}</p>
          <div v-if="notes[r.key]" class="note small"><Icon name="sparkles" :size="14" /> {{ notes[r.key] }}</div>

          <div class="rowtools">
            <div v-if="r.cur && r.date" class="seggroup">
              <span class="seg on available" aria-label="Currently available">Available</span>
              <button class="seg" type="button" aria-pressed="false" @click="markUnavailable(r.date, r.cur.name, 'leave')">Leave</button>
              <button class="seg" type="button" aria-pressed="false" @click="markUnavailable(r.date, r.cur.name, 'absent')">Absent</button>
            </div>
            <button :disabled="!r.alternatives.length && !r.overtime.length && !r.others.length && !r.current" :aria-expanded="open === r.key" @click="open = open === r.key ? null : r.key">
              <Icon name="refresh" :size="14" /> Change
            </button>
          </div>

          <div v-if="open === r.key" class="alts">
            <div class="muted small">Next best matches (on duty, no class):</div>
            <button v-for="a in r.alternatives" :key="a.name" class="alt" @click="setPiece(r.key, a.name)">
              <span class="avatar sm">{{ initialsOf(a.name) }}</span>
              <b>{{ niceName(a.name) }}</b>
              <span v-if="a.partner" class="pill">Block partner</span>
              <span class="muted small">{{ Math.round((a.load || 0) / 60) }}h assigned</span>
            </button>
            <span v-if="!r.alternatives.length" class="muted small">Nobody else on duty is available for this whole time.</span>
            <button v-if="r.overtime.length" class="link small" :aria-expanded="!!showOt[r.key]" @click="showOt = { ...showOt, [r.key]: !showOt[r.key] }">
              {{ showOt[r.key] ? 'Hide' : 'Show' }} off-duty students, overtime with supervisor approval ({{ r.overtime.length }})
            </button>
            <template v-if="showOt[r.key]">
              <button v-for="a in r.overtime" :key="'t' + a.name" class="alt" @click="setOvertime(r.key, a.name)">
                <span class="avatar sm">{{ initialsOf(a.name) }}</span>
                <b>{{ niceName(a.name) }}</b>
                <span class="pill bad">OT: non-working hours</span>
              </button>
            </template>
            <button v-if="r.others.length" class="link small" :aria-expanded="!!showBusy[r.key]" @click="showBusy = { ...showBusy, [r.key]: !showBusy[r.key] }">
              {{ showBusy[r.key] ? 'Hide' : 'Show' }} people in class or unavailable ({{ r.others.length }})
            </button>
            <template v-if="showBusy[r.key]">
              <button v-for="a in r.others" :key="'o' + a.name" class="alt" @click="a.ot ? setOvertime(r.key, a.name) : setPiece(r.key, a.name)">
                <span class="avatar sm">{{ initialsOf(a.name) }}</span>
                <b>{{ niceName(a.name) }}</b>
                <span v-if="a.status" class="pill bad">{{ STATUS_LABEL[a.status] }}</span>
                <span v-else class="pill bad">In class: {{ a.conflicts.map((c) => `${c.type} ${fmtRange(c.start, c.end, use24)}`).join(', ') }}</span>
              </button>
            </template>
            <button v-if="r.current" class="link small" @click="setPiece(r.key, null)">Remove reliever</button>
          </div>

          <button v-if="r.cur && hasTeam(r.cur.name)" type="button" class="swapbtn" title="Columns look swapped? Swap this person with their block partner" @click="swapBlock(r.cur.name)">
            <Icon name="swap" :size="14" /> Swap with partner
          </button>
        </div>
      </article>
      </div>
      </template>
    </div>

    <div v-if="state.pieces.length" class="coverage" role="status">
      <span v-if="missing > 0" class="pill bad"><Icon name="alert" :size="12" /> {{ missing }} hour{{ missing === 1 ? '' : 's' }} still without a reliever</span>
      <span v-else class="pill ok"><Icon name="check" :size="12" /> All hours covered</span>
    </div>

    <div class="actions">
      <button @click="state.step = 1"><Icon name="left" :size="16" /> Back</button>
      <button @click="reshuffle"><Icon name="refresh" :size="16" /> Regenerate</button>
      <button class="primary" @click="state.step = 3">Create message <Icon name="right" :size="16" /></button>
    </div>

  </section>
</template>

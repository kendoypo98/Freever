<script setup>
import { ref, computed } from 'vue';
import Icon from './Icon.vue';
import { parseSpreadsheet } from '../lib/parseSheet.js';
import { extractSchedule, checkSchedule, extractLabs } from '../lib/ai.js';
import { parseLabSpreadsheet } from '../lib/parseLabs.js';
import LabRoomPicker from './LabRoomPicker.vue';
import ColorKey from './ColorKey.vue';
import { saveSchedule, saveLabs, loadSchedule } from '../lib/db.js';
import { validateModel, DAYS, DAY_NAMES, fmtRange, signature } from '../lib/schedule.js';
import { state, ask, resetFlow, goStep, showToast, cacheSchedule } from '../store.js';
import { onBeforeUnmount, onMounted } from 'vue';

const MAX_SHEET_BYTES = 10 * 1024 * 1024;
const initials = (name) => name.split(/\s+/).map((w) => (w[0] || '').toUpperCase() + '.').join(' ');

const input = ref(null);
const labInput = ref(null);
const buf = ref(null); // last Excel file, so the column switch can re-read it
const firstIsRight = ref(false); // the first name of a block owns the LEFT column (checked against the duty-hour totals in the sheet)
const busy = ref('');
const error = ref('');
const saved = ref(false);
const aiWarnings = ref([]);
const labBusy = ref('');
const labMsg = ref({ error: '', warnings: [], saved: false });

const model = computed(() => state.model);
// a schedule that was just read from a file exists only on this screen until Save is pressed
const fresh = ref(false); // set when a file was just read, cleared once saved
const unsaved = computed(() => !!state.model && fresh.value && !saved.value);
const warnLeave = (e) => { if (unsaved.value) { e.preventDefault(); e.returnValue = ''; } };
onMounted(() => window.addEventListener('beforeunload', warnLeave));
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnLeave));
const dragging = ref(false);
// the setup checklist: both parts must be saved before students can use the app
const scheduleDone = computed(() => saved.value || !!state.uploadedAt);
const labsDone = computed(() => labMsg.value.saved || labsLoaded.value);
// Student names are confidential: warnings only ever show initials.
const mask = (text) => (model.value ? model.value.sas.reduce((t, s) => t.split(s.name).join(initials(s.name)), text) : text);
const issues = computed(() => (model.value ? validateModel(model.value).filter((i) => i.level === 'warn') : []));
const count = (type) => model.value.sas.reduce((n, s) => n + s.shifts.filter((x) => x.type === type).length, 0);
const onDutyPerDay = (d) => model.value.sas.filter((s) => s.shifts.some((x) => x.day === d && x.type === 'duty')).length;
const labsOn = (d) => state.labs.filter((l) => l.day === d);

async function readSheet(buffer, right) {
  const parsed = await parseSpreadsheet(buffer, { firstIsRight: right });
  if (!parsed.sas.length) throw new Error('No schedule found in this file. Duty must be filled yellow and class hours blue, and the sheet should be named "ITO". See "What the file should look like" below.');
  state.model = parsed;
  saved.value = false; fresh.value = true;
  busy.value = 'Checking the schedule with AI...';
  try { aiWarnings.value = await checkSchedule(parsed); }
  catch (e) { aiWarnings.value = [`AI check skipped: ${e.message}`]; }
}

async function handleFile(file) {
  if (!file) return;
  error.value = '';
  aiWarnings.value = [];
  const name = file.name.toLowerCase();
  try {
    if (/\.(xlsx|xls)$/.test(name)) {
      if (file.size > MAX_SHEET_BYTES) throw new Error('File is too large (max 10 MB).');
      busy.value = 'Reading spreadsheet (ITO department)...';
      const buffer = await file.arrayBuffer();
      buf.value = buffer;
      await readSheet(buffer, firstIsRight.value);
    } else if (file.type.startsWith('image/')) {
      busy.value = 'AI is reading the screenshot (yellow = duty, blue = class)...';
      const { model: m, warnings } = await extractSchedule(file, firstIsRight.value);
      if (!m.sas.length) throw new Error(warnings[0] || 'The AI could not find the ITO department schedule in that picture.');
      buf.value = null;
      state.model = m;
      saved.value = false; fresh.value = true;
      aiWarnings.value = [...warnings, 'Read from a picture by AI: please double-check the times. The Excel file is always more accurate.'];
    } else {
      throw new Error('Unsupported file. Use an .xlsx / .xls file or a PNG/JPEG screenshot.');
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = '';
    if (input.value) input.value.value = '';
  }
}

async function changeColumns() {
  if (!buf.value) return;
  error.value = '';
  try { await readSheet(buf.value, firstIsRight.value); } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}

// Clearing saves an empty schedule: the database replaces everything in one step, so no new SQL is needed.
async function clearSchedule() {
  const ok = await ask({
    title: 'Clear the S.A schedule?',
    text: 'This deletes the saved duty and class schedule for everyone. Students cannot register or generate relievers until a new one is saved. Accounts are not deleted.',
    okLabel: 'Clear schedule', danger: true,
  });
  if (!ok) return;
  busy.value = 'Clearing the schedule...';
  try {
    await saveSchedule({ sas: [] }, firstIsRight.value);
    state.model = null; state.uploadedAt = null; saved.value = false; buf.value = null; aiWarnings.value = [];
    resetFlow(); goStep(0); // reliever lists built from the old schedule are no longer valid
    showToast('Schedule cleared.');
  } catch (e) { error.value = e.message; } finally { busy.value = ''; }
}

async function clearLabs() {
  const ok = await ask({
    title: 'Clear the laboratory schedule?',
    text: 'This deletes the saved room hours for everyone. No relievers can be listed until a new laboratory schedule is saved.',
    okLabel: 'Clear laboratory schedule', danger: true,
  });
  if (!ok) return;
  labBusy.value = 'Clearing the laboratory schedule...';
  try {
    await saveLabs([]);
    state.labs = []; state.pieces = []; state.assignments = {};
    labsDirty.value = false; labPick.value = null; labMsg.value = { error: '', warnings: [], saved: false };
    if (labImage.value) { URL.revokeObjectURL(labImage.value); labImage.value = ''; }
    showToast('Laboratory schedule cleared.');
  } catch (e) { labMsg.value = { ...labMsg.value, error: e.message }; } finally { labBusy.value = ''; }
}

async function save() {
  error.value = '';
  busy.value = 'Saving to the database...';
  try {
    const sent = signature(state.model);
    await saveSchedule(state.model, firstIsRight.value);
    // read it back from the database: what a reload will show must be what was just saved
    const back = await loadSchedule();
    if (!back || signature(back.model) !== sent) throw new Error('The database did not keep the schedule exactly as saved. Press Save again, and tell the person who runs Supabase if it repeats.');
    state.model = back.model; state.uploadedAt = back.uploadedAt;
    cacheSchedule(back.model, back.uploadedAt); // the offline copy must not hold the old schedule
    saved.value = true; fresh.value = false;
    showToast('Saved. The database now holds this schedule.');
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = '';
  }
}

const labImage = ref(''); // preview of the picture (kept in the browser only)
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : 0; };

// placing the picture never needs AI: it is shown beside the time editor
async function handleLab(file) {
  if (!file) return;
  if (/\.(xlsx|xls|csv)$/i.test(file.name)) return handleLabExcel(file);
  if (!file.type.startsWith('image/')) { labMsg.value = { error: 'Please choose a picture (PNG or JPEG).', warnings: [], saved: false }; return; }
  if (labImage.value) URL.revokeObjectURL(labImage.value);
  labImage.value = URL.createObjectURL(file);
  labFile = file;
  labMsg.value = { error: '', warnings: [], saved: false };
  if (labInput.value) labInput.value.value = '';
  await autoRead(); // the picture is scanned right away; the admin only checks the table
  if (!state.labs.length) addLab();
}
let labFile = null;

// the college schedule mapping as Excel: read exactly, no AI; the admin only ticks the rooms
const labPick = ref(null); // { labs, skipped } of every room in the file
async function handleLabExcel(file) {
  if (labInput.value) labInput.value.value = '';
  labMsg.value = { error: '', warnings: [], saved: false };
  try { labPick.value = await parseLabSpreadsheet(await file.arrayBuffer()); }
  catch (e) { labPick.value = null; labMsg.value = { error: e.message, warnings: [], saved: false }; }
}
function useRooms(labs) {
  state.labs = labs; labsDirty.value = true; labPick.value = null;
  labMsg.value = { error: '', warnings: ['Read exactly from the Excel file. Check the times, then save.'], saved: false };
}

function addLab() {
  state.labs = [...state.labs, { lab: '', day: 'MON', start: 7 * 60, end: 17 * 60 }];
  labMsg.value = { ...labMsg.value, saved: false }; labsDirty.value = true;
}
function removeLab(i) { state.labs = state.labs.filter((_, k) => k !== i); labMsg.value = { ...labMsg.value, saved: false }; labsDirty.value = true; }
function editLab(i, patch) {
  state.labs = state.labs.map((l, k) => (k === i ? { ...l, ...patch } : l));
  labMsg.value = { ...labMsg.value, saved: false }; labsDirty.value = true;
}
// labs loaded from the database count as saved until the admin edits them
const labsDirty = ref(false);
const labsLoaded = computed(() => state.labs.length > 0 && !labsDirty.value);
const unnamedLabs = computed(() => state.labs.some((l) => !String(l.lab || '').trim()));
const labsValid = computed(() => state.labs.length > 0 && state.labs.every((l) => l.end > l.start) && !unnamedLabs.value);

// optional: let the AI fill the table from the picture (needs the AI function to be set up)
async function autoRead() {
  if (!labFile) return;
  labBusy.value = 'AI is reading the laboratory schedule...';
  try {
    const { labs, warnings } = await extractLabs(labFile);
    if (!labs.length) throw new Error(warnings[0] || 'No laboratory times were found in that picture.');
    state.labs = labs;
    labsDirty.value = true;
    labMsg.value = { error: '', warnings: [...warnings, 'Read from a picture by AI: check each room and time before saving.'], saved: false };
  } catch (e) {
    labMsg.value = { error: `The picture could not be read automatically (${e.message}). Type the rooms and times from the picture instead.`, warnings: [], saved: false };
  } finally { labBusy.value = ''; }
}
async function saveLab() {
  labBusy.value = 'Saving the laboratory schedule...';
  try { await saveLabs(state.labs); labMsg.value = { ...labMsg.value, error: '', saved: true }; labsDirty.value = false; }
  catch (e) { labMsg.value = { ...labMsg.value, error: e.message }; }
  finally { labBusy.value = ''; }
}

function onDrop(e) { handleFile(e.dataTransfer.files[0]); }
</script>

<template>
  <section class="card">
    <div class="card-head">
      <span class="badge-icon"><Icon name="upload" /></span>
      <div>
        <h2>Import S.A schedule</h2>
        <p class="muted">Admin only. ITO Department. Yellow cells are duty time, blue cells are class hours. A saved schedule is shared with every S.A.</p>
      </div>
    </div>

    <ColorKey />

    <ul class="questlog" aria-label="Setup checklist">
      <li :class="{ done: scheduleDone }"><span class="qcheck" aria-hidden="true"><Icon name="check" :size="13" /></span> Quest 1: import the S.A schedule</li>
      <li :class="{ done: labsDone }"><span class="qcheck" aria-hidden="true"><Icon name="check" :size="13" /></span> Quest 2: scan the laboratory schedule</li>
      <li v-if="scheduleDone && labsDone" class="done ready"><span class="qcheck" aria-hidden="true"><Icon name="sparkles" :size="13" /></span> All set! Students can start</li>
    </ul>

    <label class="check">
      <input v-model="firstIsRight" type="checkbox" :disabled="!buf && !!model" @change="changeColumns" />
      <span>The first name of each pair is the <b>right</b> column (the second name is the left)</span>
    </label>

    <div class="drop" :class="{ busy, over: dragging }" role="button" tabindex="0" :aria-busy="!!busy"
      aria-label="Choose the schedule file: Excel, PNG or JPEG"
      @dragover.prevent @dragenter.prevent="dragging = true" @dragleave="dragging = false"
      @drop.prevent="dragging = false; onDrop($event)" @click="input?.click()"
      @keydown.enter.prevent="input?.click()" @keydown.space.prevent="input?.click()">
      <Icon name="upload" :size="28" />
      <strong>Drop the Excel file here or click to browse</strong>
      <span class="muted">Excel (.xlsx) &middot; or a PNG/JPEG screenshot</span>
      <input ref="input" type="file" hidden accept=".xlsx,.xls,image/png,image/jpeg,image/webp" @change="handleFile($event.target.files[0])" />
    </div>
    <p v-if="busy" class="notice" role="status"><Icon name="clock" :size="16" /> {{ busy }}</p>
    <p v-if="error" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ error }}</p>
    <details class="small muted">
      <summary>What the file should look like</summary>
      <ul class="issues">
        <li>Use the sheet named <b>ITO</b> (if there is none, every sheet is tried).</li>
        <li>Each block has one or two names in its header, separated by <b>/</b>, and one column pair per day (M, T, W, TH, F, Sat).</li>
        <li><b>Yellow</b> cells are duty time and <b>blue</b> cells are class hours. White cells are free. Similar shades are accepted.</li>
        <li>If the two partners of a block come out the wrong way round, tick or untick the column box above.</li>
      </ul>
    </details>

    <template v-if="model">
      <div class="row between wrap">
        <h3>Schedule loaded<template v-if="state.uploadedAt"> (saved {{ new Date(state.uploadedAt).toLocaleDateString() }})</template></h3>
      </div>
      <div class="stats">
        <div><b>{{ model.sas.length }}</b><span>Student assistants</span></div>
        <div><b>{{ count('duty') }}</b><span>Duty blocks</span></div>
        <div><b>{{ count('class') }}</b><span>Class blocks</span></div>
      </div>
      <div class="daystats">
        <div v-for="d in DAYS" :key="d"><span>{{ DAY_NAMES[d].slice(0, 3) }}</span><b>{{ onDutyPerDay(d) }}</b><small>on duty</small></div>
      </div>
      <p class="muted small row gap"><Icon name="lock" :size="14" /> Names are not shown to other S.A in the app, but every signed-in account can read the schedule data.</p>
      <ul v-if="issues.length || aiWarnings.length" class="issues">
        <li v-for="(i, k) in issues" :key="'v' + k" class="warn">{{ mask(i.text) }}</li>
        <li v-for="(w, k) in aiWarnings" :key="'a' + k" class="ai"><Icon name="sparkles" :size="14" /> {{ mask(w) }}</li>
      </ul>
      <p v-if="unsaved" class="notice err" role="alert"><Icon name="alert" :size="16" /> Not saved yet. This schedule exists only on your screen, so a reload brings back the old one. Press <b>Save to database</b>.</p>
      <div class="actions">
        <button class="primary" :disabled="!!busy || saved" @click="save">
          <Icon :name="saved ? 'check' : 'upload'" :size="16" /> {{ saved ? 'Saved to database' : 'Save to database' }}
        </button>
        <button :disabled="!labMsg.saved && !labsLoaded" @click="goStep(1)">Continue <Icon name="right" :size="16" /></button>
        <button v-if="state.uploadedAt" class="danger" :disabled="!!busy" @click="clearSchedule"><Icon name="trash" :size="16" /> Clear schedule</button>
      </div>
    </template>

    <div class="labbox">
      <h3><Icon name="clock" :size="16" /> Laboratory schedule <span class="pill bad">required</span></h3>
      <p class="muted small">
        Choose the laboratory schedule: the Excel file is read exactly (you tick the rooms), or a picture is read by AI. FreeVer reads each room and its open hours automatically; check them, then save. Relievers are then listed per room, hour by hour, only while that room is open, and only students who are free at that time are suggested.
      </p>
      <div class="actions tight">
        <button @click="labInput?.click()"><Icon name="image" :size="16" /> {{ labImage ? 'Replace picture' : 'Choose Excel or picture' }}</button>
        <button v-if="labImage" :disabled="!!labBusy" @click="autoRead"><Icon name="sparkles" :size="16" /> Read the picture again</button>
        <input ref="labInput" type="file" hidden accept=".xlsx,.xls,.csv,image/png,image/jpeg,image/webp" @change="handleLab($event.target.files[0])" />
      </div>
      <LabRoomPicker v-if="labPick" :labs="labPick.labs" :skipped="labPick.skipped" @pick="useRooms" @cancel="labPick = null" />
      <p v-if="labBusy" class="notice" role="status"><Icon name="clock" :size="16" /> {{ labBusy }}</p>
      <p v-if="labMsg.error" class="notice err" role="alert"><Icon name="alert" :size="16" /> {{ labMsg.error }}</p>
      <ul v-if="labMsg.warnings.length" class="issues">
        <li v-for="(w, k) in labMsg.warnings" :key="k" class="ai"><Icon name="sparkles" :size="14" /> {{ w }}</li>
      </ul>

      <div class="labwork" :class="{ 'with-img': labImage }">
        <img v-if="labImage" :src="labImage" alt="Laboratory schedule" class="labimg" />
        <div class="labtable">
          <div v-for="(l, i) in state.labs" :key="i" class="labrow">
            <input type="text" maxlength="60" :value="l.lab" placeholder="Room, e.g. 5501" aria-label="Laboratory room" @input="editLab(i, { lab: $event.target.value })" />
            <select :value="l.day" aria-label="Day" @change="editLab(i, { day: $event.target.value })">
              <option v-for="d in DAYS" :key="d" :value="d">{{ DAY_NAMES[d] }}</option>
            </select>
            <input type="time" :value="hhmm(l.start)" aria-label="Opens at" @change="editLab(i, { start: toMin($event.target.value) })" />
            <span class="muted">to</span>
            <input type="time" :value="hhmm(l.end)" aria-label="Closes at" @change="editLab(i, { end: toMin($event.target.value) })" />
            <button class="icon-btn" title="Remove" aria-label="Remove this laboratory time" @click="removeLab(i)"><Icon name="trash" :size="16" /></button>
          </div>
          <p v-if="!state.labs.length" class="muted small">No laboratory times yet. Place the picture, then add the times.</p>
          <p v-if="state.labs.some((l) => l.end <= l.start)" class="warn small">A closing time must be later than its opening time.</p>
          <p v-if="unnamedLabs" class="warn small">Name every laboratory room (for example 5501) so relievers can be listed per room.</p>
          <div class="actions tight">
            <button @click="addLab"><Icon name="check" :size="16" /> Add time</button>
            <button v-if="labsDone" class="danger" :disabled="!!labBusy" @click="clearLabs"><Icon name="trash" :size="16" /> Clear laboratory schedule</button>
            <button class="primary" :disabled="!labsValid || !!labBusy || labMsg.saved" @click="saveLab">
              <Icon :name="labMsg.saved ? 'check' : 'upload'" :size="16" /> {{ labMsg.saved ? 'Saved' : 'Save laboratory schedule' }}
            </button>
          </div>
        </div>
      </div>
      <p v-if="model && !labMsg.saved" class="muted small">
        <Icon name="alert" :size="14" /> Save the laboratory schedule before you continue; everyone uses the saved one.
      </p>
    </div>  </section>
</template>

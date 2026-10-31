import { normalizeDay, normalizeLabs, parseTime } from './schedule.js';

const CODE = { M: 'MON', T: 'TUE', W: 'WED', TH: 'THU', F: 'FRI', S: 'SAT' };

/** "MWF" -> MON, WED, FRI; "TTh" -> TUE, THU; "Th" -> THU; "Saturday" -> SAT. */
export function daysOf(v) {
  const whole = normalizeDay(v);
  if (whole) return [whole];
  return [...String(v ?? '').toUpperCase().matchAll(/TH|M|T|W|F|S/g)].map((m) => CODE[m[0]]);
}

const low = (v) => String(v ?? '').trim().toLowerCase();
const CANCELLED = /deleted|dissolved/i; // the sheet marks cancelled sections in the instructor column

/**
 * Rows of the college schedule mapping (columns ROOM, DAYS, START, END, optional INSTRUCTOR) -> { labs, skipped }.
 * Back-to-back and overlapping classes of one room are merged into one open window per day. Null when no such header exists.
 */
export function labsFromRows(rows) {
  const need = ['room', 'day', 'start', 'end'];
  const h = rows.findIndex((r) => need.every((k) => r.some((c) => low(c).includes(k))));
  if (h < 0) return null;
  const col = (k) => { const i = rows[h].findIndex((c) => low(c) === k); return i >= 0 ? i : rows[h].findIndex((c) => low(c).includes(k)); };
  const [room, day, start, end] = need.map(col);
  const who = col('instructor');
  const out = [];
  let skipped = 0;
  for (const r of rows.slice(h + 1)) {
    const lab = String(r[room] ?? '').trim();
    if (!lab) continue;
    const s = parseTime(r[start]);
    const e = parseTime(r[end]);
    if (who >= 0 && CANCELLED.test(String(r[who] ?? '')) || s == null || e == null || e <= s) { skipped++; continue; }
    for (const d of daysOf(r[day])) out.push({ lab, day: d, start: s, end: e });
  }
  return { labs: normalizeLabs(out), skipped };
}

/** An .xlsx/.xls/.csv of the college schedule mapping -> { labs, skipped }, all rooms. */
export async function parseLabSpreadsheet(buffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', raw: true });
  for (const name of wb.SheetNames) {
    const res = labsFromRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }));
    if (res?.labs.length) return res;
  }
  throw new Error('No ROOM, DAYS, START and END columns with times were found in that file.');
}

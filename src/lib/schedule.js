export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DAY_NAMES = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
};
export const TYPE_LABEL = { duty: 'Duty', class: 'Class' };

const DAY_ALIASES = {
  MON: 'MON', MONDAY: 'MON', M: 'MON',
  TUE: 'TUE', TUES: 'TUE', TUESDAY: 'TUE', T: 'TUE',
  WED: 'WED', WEDNESDAY: 'WED', W: 'WED',
  THU: 'THU', THUR: 'THU', THURS: 'THU', THURSDAY: 'THU', TH: 'THU',
  FRI: 'FRI', FRIDAY: 'FRI', F: 'FRI',
  SAT: 'SAT', SATURDAY: 'SAT', S: 'SAT',
};

export function normalizeDay(v) {
  if (!v) return null;
  return DAY_ALIASES[String(v).trim().replace(/[.\s]/g, '').toUpperCase()] || null;
}

/** Parse "8", "8:30", "8:30am", "1pm", "13:00" -> minutes since midnight, or null. */
export function parseTime(v, assumePm = false) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (v > 0 && v < 1) return Math.round(v * 24 * 60); // Excel time fraction
    if (Number.isInteger(v) && v >= 0 && v <= 24) return v * 60;
    return null;
  }
  const m = String(v).trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a|p)?m?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (h > 24 || min > 59) return null;
  if (m[3] === 'p' && h < 12) h += 12;
  else if (m[3] === 'a' && h === 12) h = 0;
  else if (!m[3] && assumePm && h >= 1 && h < 7) h += 12;
  return h * 60 + min;
}

/** Parse a range like "8:00am - 12:00pm", "8-12", "1-5", "13:00-17:00". Returns {start,end} minutes or null. */
export function parseRange(text) {
  if (text == null) return null;
  const m = String(text).trim().match(/^(.+?)\s*(?:-|–|—|to)\s*(.+)$/i);
  if (!m) return null;
  const hasMer = (x) => /[ap]m?\s*$/i.test(x.trim());
  const hasS = hasMer(m[1]);
  const hasE = hasMer(m[2]);
  let st = parseTime(m[1]);
  let en = parseTime(m[2]);
  if (st == null || en == null) return null;
  const H12 = 12 * 60;
  if (!hasS && !hasE && st < 7 * 60) st += H12; // "1-5" means afternoon
  if (en <= st && en < H12) en += H12; // "10-2" -> 10:00-14:00
  if (!hasS && en - st > H12 && st < H12) st += H12;
  return en > st ? { start: st, end: en } : null;
}

export function fmtTime(mins, use24 = false) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  if (use24) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12}:00 ${suffix}`;
}

export function fmtRange(s, e, use24 = false) {
  return `${fmtTime(s, use24)} – ${fmtTime(e, use24)}`;
}

export const overlaps = (a, b) => a.start < b.end && b.start < a.end;

/**
 * Normalized model: { sas: [{ name, shifts: [{ day, start, end, type: 'duty'|'class', note }] }] }
 * duty = yellow cells (on duty), class = blue cells (in class).
 */
export function normalizeModel(raw) {
  const byName = new Map();
  for (const sa of raw?.sas || []) {
    const name = String(sa.name || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name, team: '', shifts: [] });
    if (sa.team && !byName.get(key).team) byName.get(key).team = String(sa.team).trim();
    for (const sh of sa.shifts || []) {
      const day = normalizeDay(sh.day);
      const start = typeof sh.start === 'number' ? sh.start : parseTime(sh.start);
      const end = typeof sh.end === 'number' ? sh.end : parseTime(sh.end);
      if (!day || start == null || end == null || end <= start) continue;
      const type = String(sh.type || 'duty').toLowerCase().startsWith('c') ? 'class' : 'duty';
      byName.get(key).shifts.push({ day, start, end, type, note: sh.note || '' });
    }
  }
  const sas = [...byName.values()];
  for (const sa of sas) {
    sa.shifts.sort(
      (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.type.localeCompare(b.type) || a.start - b.start,
    );
    // join touching blocks of the same kind (merged-cell boundaries)
    const merged = [];
    for (const s of sa.shifts) {
      const last = merged[merged.length - 1];
      if (last && last.day === s.day && last.type === s.type && s.start <= last.end) last.end = Math.max(last.end, s.end);
      else merged.push({ ...s });
    }
    sa.shifts = merged;
  }
  return { sas };
}

/** Local sanity checks. Returns [{level:'warn'|'info', text}] */
export function validateModel(model) {
  const issues = [];
  if (!model.sas.length) issues.push({ level: 'warn', text: 'No student assistants were found.' });
  for (const sa of model.sas) {
    const duty = sa.shifts.filter((s) => s.type === 'duty');
    if (!duty.length) issues.push({ level: 'warn', text: `${sa.name} has no duty hours.` });
    for (const day of DAYS) {
      const list = duty.filter((s) => s.day === day);
      for (const s of list) {
        if (s.end - s.start > 12 * 60) issues.push({ level: 'warn', text: `${sa.name} ${day}: duty longer than 12 hours.` });
      }
      const classes = sa.shifts.filter((s) => s.day === day && s.type === 'class');
      if (list.some((d) => classes.some((c) => overlaps(d, c)))) {
        issues.push({ level: 'info', text: `${sa.name} ${day}: duty and class overlap.` });
      }
    }
  }
  return issues;
}

/** Swap the schedules of the two students of one block (when the sheet's left/right order is the other way round). */
export function swapTeam(model, name) {
  const team = model.sas.find((s) => s.name === name)?.team;
  const pair = team ? model.sas.filter((s) => s.team === team) : [];
  if (pair.length !== 2) return model;
  const [a, b] = pair;
  return { sas: model.sas.map((s) => (s === a ? { ...s, shifts: b.shifts } : s === b ? { ...s, shifts: a.shifts } : s)) };
}

/**
 * The single SA whose name contains every typed word (at least two words, each >= 3 letters), or null when none or several match.
 * Used so a student can find themselves without ever seeing a list of other names.
 */
export function findUniqueName(query, sas) {
  const words = query.toLowerCase().split(/[^a-z0-9\u00f1]+/).filter((w) => w.length >= 3);
  if (words.length < 2) return null; // one word could be used to fish for other students' names
  const hits = sas.filter((s) => words.every((w) => s.name.toLowerCase().includes(w)));
  return hits.length === 1 ? hits[0] : null;
}

/** "MARL BENEDICT LUKBAN" -> "Marl Benedict Lukban" (display only; stored names keep their original form). */
export function niceName(name) {
  return String(name || '').toLowerCase().replace(/(^|[\s\-.'(])([a-z\u00e0-\u00ff])/g, (m, p, c) => p + c.toUpperCase())
    .replace(/\b(Ii|Iii|Iv)\b/g, (m) => m.toUpperCase());
}

export const initialsOf = (name) => {
  const w = niceName(name).split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};

/** Laboratory opening windows: [{ lab, day, start, end }], merged per lab/day. */
export function normalizeLabs(raw) {
  const out = [];
  for (const l of raw || []) {
    const day = normalizeDay(l.day);
    const start = typeof l.start === 'number' ? l.start : parseTime(l.start);
    const end = typeof l.end === 'number' ? l.end : parseTime(l.end);
    if (!day || start == null || end == null || end <= start) continue;
    out.push({ lab: String(l.lab || '').trim(), day, start, end });
  }
  out.sort((a, b) => a.lab.localeCompare(b.lab) || DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start - b.start);
  const merged = [];
  for (const w of out) {
    const last = merged[merged.length - 1];
    if (last && last.lab === w.lab && last.day === w.day && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}

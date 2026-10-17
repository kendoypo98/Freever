import { normalizeDay, normalizeModel, parseRange, parseTime } from './schedule.js';

/**
 * Raw cell values as a grid (rows[r][c], '' when empty). sheet_to_json would turn time-formatted
 * cells into Date objects in SheetJS 0.20, but the parsers need the plain day-fraction numbers.
 */
function sheetRows(XLSX, ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const rows = [];
  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) row.push(ws[XLSX.utils.encode_cell({ r, c })]?.v ?? '');
    rows.push(row);
  }
  return rows;
}
const splitMulti = (v) =>
  String(v ?? '')
    .split(/\r?\n|;|,|&|\band\b|\//i)
    .map((s) => s.trim())
    .filter(Boolean);

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'number' && v > 0 && v < 1) {
    const mins = Math.round(v * 1440);
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  }
  return String(v).trim();
}

function rangesIn(v) {
  const out = [];
  for (const part of splitMulti(v)) {
    const r = parseRange(part);
    if (r) out.push(r);
  }
  return out;
}

/** Layout 1 - day headers across columns (rows are SAs *or* time slots). */
function parseDaysAcross(rows) {
  let headerIdx = -1;
  let dayCols = {};
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cols = {};
    rows[i].forEach((c, j) => {
      const d = String(c ?? '').trim().length > 1 ? normalizeDay(c) : null;
      if (d && !(d in cols)) cols[d] = j;
    });
    if (Object.keys(cols).length >= 3) { headerIdx = i; dayCols = cols; break; }
  }
  if (headerIdx < 0) return null;
  const firstDayCol = Math.min(...Object.values(dayCols));
  const sas = new Map();
  const add = (name, day, r) => {
    if (!sas.has(name)) sas.set(name, { name, shifts: [] });
    sas.get(name).shifts.push({ day, start: r.start, end: r.end });
  };
  for (const row of rows.slice(headerIdx + 1)) {
    const label = cellText(row[0]) || cellText(row[firstDayCol - 1]);
    const labelRange = parseRange(label);
    for (const [day, col] of Object.entries(dayCols)) {
      const raw = cellText(row[col]);
      if (!raw) continue;
      if (labelRange) {
        for (const n of splitMulti(raw)) add(n, day, labelRange);
      } else if (label) {
        for (const r of rangesIn(raw)) add(label, day, r);
      }
    }
  }
  return { sas: [...sas.values()] };
}

/** Layout 2 - days down rows, SA names across the header. */
function parseDaysDown(rows) {
  const dayRows = [];
  rows.forEach((r, i) => {
    const d = normalizeDay(r[0]);
    if (d && String(r[0]).trim().length > 1) dayRows.push([i, d]);
  });
  if (dayRows.length < 3) return null;
  const headerRow = rows[Math.max(0, dayRows[0][0] - 1)] || [];
  const sas = new Map();
  for (const [i, day] of dayRows) {
    rows[i].forEach((c, j) => {
      if (j === 0) return;
      const name = cellText(headerRow[j]);
      if (!name) return;
      for (const r of rangesIn(c)) {
        if (!sas.has(name)) sas.set(name, { name, shifts: [] });
        sas.get(name).shifts.push({ day, start: r.start, end: r.end });
      }
    });
  }
  return { sas: [...sas.values()] };
}

/** Layout 3 - long list: Name | Day | Start | End (or Time). */
function parseLong(rows) {
  const head = rows[0]?.map((c) => String(c ?? '').toLowerCase()) || [];
  const find = (...keys) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const nameC = find('name', 'sa', 'student');
  const dayC = find('day');
  const timeC = find('time', 'shift', 'schedule');
  const startC = find('start', 'from', 'in');
  const endC = find('end', 'to', 'out');
  if (nameC < 0 || dayC < 0) return null;
  const sas = new Map();
  for (const row of rows.slice(1)) {
    const name = cellText(row[nameC]);
    const day = normalizeDay(row[dayC]);
    if (!name || !day) continue;
    let ranges = [];
    if (startC >= 0 && endC >= 0 && startC !== endC) {
      const s = parseTime(row[startC] ?? '');
      const e = parseTime(row[endC] ?? '');
      if (s != null && e != null) ranges = [{ start: s, end: e }];
    } else if (timeC >= 0) ranges = rangesIn(row[timeC]);
    for (const r of ranges) {
      if (!sas.has(name)) sas.set(name, { name, shifts: [] });
      sas.get(name).shifts.push({ day, ...r });
    }
  }
  return { sas: [...sas.values()] };
}

const YELLOW = [255, 255, 0]; // duty
const BLUE = [0, 112, 192]; // class hours

/** True when an Excel colour ("RRGGBB" or "AARRGGBB") is close to the target, so slightly different shades still count. */
export function isNear(rgb, target, tolerance = 60) {
  const hex = String(rgb || '').replace(/^#/, '').toUpperCase().slice(-6);
  if (!/^[0-9A-F]{6}$/.test(hex)) return false;
  const v = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return v.every((c, i) => Math.abs(c - target[i]) <= tolerance);
}

/**
 * Layout 4 - the department duty grid read by CELL COLOUR:
 *   yellow = duty, blue = class hours.
 *   [office] | NAME / NAME2             <- name row (names split by "/")
 *            | M . T . W . TH . F . Sat <- day row, 2 columns per day (1st name, 2nd name)
 *   07:00-07:30 | ...                   <- half-hour rows
 */
function parseColorBlocks(XLSX, ws, firstIsRight) {
  const rows = sheetRows(XLSX, ws);
  const merges = ws['!merges'] || [];
  const masterOf = new Map();
  for (const m of merges) {
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) masterOf.set(r + ',' + c, m.s);
  }
  const fillOf = (r, c) => {
    const own = ws[XLSX.utils.encode_cell({ r, c })]?.s?.fgColor?.rgb;
    if (own) return String(own).toUpperCase();
    const m = masterOf.get(r + ',' + c);
    return m ? String(ws[XLSX.utils.encode_cell(m)]?.s?.fgColor?.rgb || '').toUpperCase() : '';
  };
  const typeAt = (r, c) => {
    const f = fillOf(r, c);
    return isNear(f, YELLOW) ? 'duty' : isNear(f, BLUE) ? 'class' : null;
  };

  const sas = new Map();
  let blocks = 0;
  rows.forEach((row, dr) => {
    let c0 = -1;
    for (let c = 0; c < row.length - 2; c++) {
      if (normalizeDay(row[c]) === 'MON' && String(row[c]).trim().length <= 3 && normalizeDay(row[c + 2]) === 'TUE') { c0 = c; break; }
    }
    if (c0 < 0 || dr < 1) return;
    const names = String(rows[dr - 1][c0] ?? '').split('/').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (!names.length) return;
    const office = String(rows[dr - 1][0] ?? '').trim().replace(/^\d+$/, '');
    const days = {};
    for (let c = c0; c < row.length; c++) {
      const d = String(row[c]).trim() ? normalizeDay(row[c]) : null;
      if (d && !(d in days)) days[d] = c;
    }
    const first = dr + 1;
    let last = first - 1;
    while (last + 1 < rows.length && typeof rows[last + 1][0] === 'number' && typeof rows[last + 1][1] === 'number') last++;
    if (last < first) return;
    blocks++;
    const base = Math.round(rows[first][0] * 1440);
    const slot = Math.round(((((rows[first][1] - rows[first][0]) % 1) + 1) % 1) * 1440) || 30;

    names.forEach((name, idx) => {
      if (!sas.has(name)) sas.set(name, { name, team: names.join(' / '), shifts: [] });
      for (const [day, dc] of Object.entries(days)) {
        // 2 names: normally 1st = left column, 2nd = right; with firstIsRight it is the other way round.
        // 1 name: either column counts.
        const cols = names.length === 1 ? [dc, dc + 1] : [dc + (firstIsRight ? 1 - idx : idx)];
        let cur = null; // {type, from}
        const flush = (endRow) => {
          if (!cur) return;
          sas.get(name).shifts.push({
            day, type: cur.type, note: office,
            start: base + (cur.from - first) * slot,
            end: base + (endRow - first) * slot,
          });
          cur = null;
        };
        for (let r = first; r <= last + 1; r++) {
          let t = null;
          if (r <= last) for (const c of cols) { t = typeAt(r, c) || t; if (t === 'duty') break; }
          if (cur && cur.type !== t) flush(r);
          if (!cur && t) cur = { type: t, from: r };
        }
      }
    });
  });
  return blocks ? { sas: [...sas.values()] } : null;
}

/**
 * Parse xlsx/xls/csv ArrayBuffer into the normalized model.
 * For the colour-coded duty grid only the ITO DEPARTMENT sheet is read.
 */
export async function parseSpreadsheet(buffer, { firstIsRight = true } = {}) {
  const XLSX = await import('xlsx'); // loaded on demand: it is by far the largest dependency
  // raw: keep CSV cells as text so "1-5" is not turned into a date; cellStyles: read yellow/blue fills
  const wb = XLSX.read(buffer, { type: 'array', raw: true, cellStyles: true, cellDates: false });

  const itoSheets = wb.SheetNames.filter((n) => /\bito\b/i.test(n));
  const gridSheets = itoSheets.length ? itoSheets : wb.SheetNames;
  const grid = [];
  for (const n of gridSheets) {
    const parsed = parseColorBlocks(XLSX, wb.Sheets[n], firstIsRight);
    if (parsed) grid.push(...parsed.sas);
  }
  const gridModel = normalizeModel({ sas: grid });
  if (gridModel.sas.some((s) => s.shifts.length)) return gridModel;

  let best = { sas: [] };
  const score = (m) => m.sas.reduce((n, s) => n + s.shifts.length, 0);
  for (const sheetName of wb.SheetNames) {
    const rows = sheetRows(XLSX, wb.Sheets[sheetName]);
    for (const parser of [parseLong, parseDaysAcross, parseDaysDown]) {
      const model = normalizeModel(parser(rows) || { sas: [] });
      if (score(model) > score(best)) best = model;
    }
  }
  return best;
}

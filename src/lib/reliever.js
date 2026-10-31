import { overlaps, DAYS } from './schedule.js';

/**
 * What the lab schedule asks of one person: for every room that is open during their duty on `day`,
 * the time ranges that need a reliever. [{ lab, ranges: [{ start, end }] }]
 */
export function coverageByLab(shifts, labs, day) {
  const byLab = new Map();
  for (const slot of buildSlots(shifts.filter((s) => s.day === day), labs)) {
    const ranges = byLab.get(slot.lab) || [];
    const last = ranges[ranges.length - 1];
    if (last && last.end === slot.start) last.end = slot.end; else ranges.push({ start: slot.start, end: slot.end });
    byLab.set(slot.lab, ranges);
  }
  return [...byLab].map(([lab, ranges]) => ({ lab, ranges }));
}

/** One reliever slot = one lab room, one day, at most one clock hour. */
export const pieceKey = (p) => `${p.day}|${p.lab || ''}|${p.start}|${p.end}`;

/**
 * A reliever is only needed while a laboratory is open. For every laboratory room open on the
 * day of a duty shift, cut the overlap into slots that never cross a clock hour (7:30-8:00, 8:00-9:00 ...).
 * Without a laboratory schedule there is nothing to cover, so the result is empty.
 */
export function buildSlots(shifts, labs) {
  const seen = new Set();
  const out = [];
  for (const s of shifts) {
    for (const l of (labs || []).filter((x) => x.day === s.day)) {
      const from = Math.max(l.start, s.start);
      const to = Math.min(l.end, s.end);
      for (let pos = from; pos < to;) {
        const next = Math.min(to, (Math.floor(pos / 60) + 1) * 60);
        const slot = { day: s.day, lab: l.lab || 'Lab', start: pos, end: next, note: s.note };
        if (!seen.has(pieceKey(slot))) { seen.add(pieceKey(slot)); out.push(slot); }
        pos = next;
      }
    }
  }
  return out.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.lab.localeCompare(b.lab) || a.start - b.start);
}

export const isPartner = (sa, me) => !!me.team && sa.team === me.team && sa.name !== me.name;

/**
 * Blocks that make `sa` unavailable to relieve `me`: class hours (blue) only.
 * Yellow = the student is on duty and can cover. White = non-working hours: never assigned automatically
 * (see isOvertime), only chosen by hand once a supervisor has approved the overtime.
 */
export const busyBlocks = (sa) => sa.shifts.filter((s) => s.type === 'class');

/** Busy blocks of an SA on a day that touch [start,end). */
export function conflictsFor(sa, me, day, start, end) {
  return busyBlocks(sa).filter((s) => s.day === day && overlaps(s, { start, end }));
}

/**
 * Candidates for one piece, best first.
 *  free = no class (blue) during the piece.
 *  ot   = not on duty (yellow) for the whole piece, so covering it is overtime (non-working hours).
 * Order: available (not on leave/absent), no class, on duty before overtime, then least busy, partner, lightest load.
 */
export function rankCandidates({ model, me, piece, dateKey, absent, load, taken = new Set() }) {
  const list = [];
  for (const sa of model.sas) {
    if (sa.name === me.name) continue;
    const conflicts = conflictsFor(sa, me, piece.day, piece.start, piece.end);
    const busyMins = conflicts.reduce(
      (n, s) => n + Math.min(s.end, piece.end) - Math.max(s.start, piece.start), 0);
    list.push({
      name: sa.name,
      partner: isPartner(sa, me),
      free: conflicts.length === 0,
      ot: isOvertime(sa, piece),
      conflicts,
      taken: taken.has(sa.name), // already covering another room at the same time
      busyMins,
      status: absent[`${dateKey}|${sa.name}`] || null, // 'leave' | 'absent' | null
      load: load[sa.name] || 0,
    });
  }
  list.sort(
    (a, b) =>
      (a.status ? 1 : 0) - (b.status ? 1 : 0) ||
      (a.taken ? 1 : 0) - (b.taken ? 1 : 0) ||
      (b.free ? 1 : 0) - (a.free ? 1 : 0) ||
      (a.ot ? 1 : 0) - (b.ot ? 1 : 0) ||
      a.busyMins - b.busyMins ||
      (b.partner ? 1 : 0) - (a.partner ? 1 : 0) ||
      a.load - b.load ||
      a.name.localeCompare(b.name),
  );
  return list;
}

/** Overtime = the student is not on duty (yellow) for the whole slot, so it is non-working time (white). */
export const isOvertime = (sa, slot) =>
  !sa.shifts.some((s) => s.type === 'duty' && s.day === slot.day && s.start <= slot.start && s.end >= slot.end);

/** Names already assigned to a different slot that overlaps `slot` on the same day (one person cannot be in two rooms at once). */
export function takenAt(pieces, assignments, slot) {
  const key = pieceKey(slot);
  const out = new Set();
  for (const p of pieces) {
    const n = assignments[pieceKey(p)];
    if (n && p.day === slot.day && pieceKey(p) !== key && overlaps(p, slot)) out.add(n);
  }
  return out;
}

/**
 * Best reliever for one slot, or null when nobody on duty is available for the whole slot.
 *  - avoid: names to skip when someone else is free (rotation / "next person")
 *  - taken: names already covering another room at the same time (never picked)
 *  - random: pick among equally good people so Regenerate can give another valid result
 */
export function pickReliever({ model, me, slot, dateKey, absent, load, avoid = new Set(), random = false, taken = new Set() }) {
  // only students who are on duty and have no class: overtime needs a supervisor's approval, so it is never automatic
  const free = rankCandidates({ model, me, piece: slot, dateKey, absent, load, taken }).filter((c) => c.free && !c.ot && !c.status && !c.taken);
  if (!free.length) return null;
  // the block partner is the natural cover and is never rotated away
  const fresh = free.filter((c) => c.partner || !avoid.has(c.name));
  const pool = fresh.length ? fresh : free;
  const best = pool[0];
  const ties = pool.filter((c) => c.partner === best.partner && c.load === best.load);
  return (random ? ties[Math.floor(Math.random() * ties.length)] : best).name;
}

/**
 * Hourly relievers per laboratory room for the duty shifts of `me`.
 * Names rotate from one hour to the next when more than one person is free. Returns { pieces, assignments }
 * where pieces are the slots and assignments maps pieceKey -> name (null = nobody free).
 */
export function generateSlots({ model, me, shifts, dates, absent, labs, avoid = new Set(), random = false, load0 = {} }) {
  const pieces = buildSlots(shifts, labs);
  const assignments = {};
  const load = { ...load0 };
  const prev = new Map(); // `${day}|${lab}` -> name of the previous slot in that room, for rotation
  // time order across all rooms, so a person picked for one room is known to be busy when the next room is filled
  const ordered = [...pieces].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start - b.start || a.lab.localeCompare(b.lab));
  for (const slot of ordered) {
    const rotate = new Set(avoid);
    const before = prev.get(`${slot.day}|${slot.lab}`);
    if (before) rotate.add(before);
    const taken = takenAt(pieces, assignments, slot);
    const name = pickReliever({ model, me, slot, dateKey: dates[slot.day], absent, load, avoid: rotate, random, taken });
    assignments[pieceKey(slot)] = name;
    if (name) load[name] = (load[name] || 0) + (slot.end - slot.start);
    prev.set(`${slot.day}|${slot.lab}`, name);
  }
  return { pieces, assignments };
}

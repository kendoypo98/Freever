import { overlaps, DAYS } from './schedule.js';

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
 * Blocks that make `sa` unavailable to relieve `me`.
 * White cells = free. Blue (class) always blocks. Yellow (duty) blocks too, EXCEPT for the
 * block partner: the two students of one block share the same post, so a partner whose duty
 * overlaps yours is already at that post and can cover.
 */
export function busyBlocks(sa, me) {
  return isPartner(sa, me) ? sa.shifts.filter((s) => s.type === 'class') : sa.shifts;
}

/** Busy blocks of an SA on a day that touch [start,end). */
export function conflictsFor(sa, me, day, start, end) {
  return busyBlocks(sa, me).filter((s) => s.day === day && overlaps(s, { start, end }));
}

/**
 * Candidates for one piece, free ones first.
 * free = no duty and no class during the piece. Others stay selectable but flagged.
 */
export function rankCandidates({ model, me, piece, dateKey, absent, load }) {
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
      conflicts,
      busyMins,
      status: absent[`${dateKey}|${sa.name}`] || null, // 'leave' | 'absent' | null
      load: load[sa.name] || 0,
    });
  }
  list.sort(
    (a, b) =>
      (a.status ? 1 : 0) - (b.status ? 1 : 0) ||
      (b.free ? 1 : 0) - (a.free ? 1 : 0) ||
      a.busyMins - b.busyMins ||
      (b.partner ? 1 : 0) - (a.partner ? 1 : 0) ||
      a.load - b.load ||
      a.name.localeCompare(b.name),
  );
  return list;
}

/**
 * Overtime: the reliever covers a time that is outside their own duty. A block partner who is
 * already on duty at the same post during the slot is not overtime.
 */
export const isOvertime = (sa, slot) =>
  !sa.shifts.some((s) => s.type === 'duty' && s.day === slot.day && s.start <= slot.start && s.end >= slot.end);

/**
 * Best reliever for one slot, or null when nobody is free for the whole slot.
 *  - avoid: names to skip when someone else is free (rotation / "next person")
 *  - random: pick among equally good people so Regenerate can give another valid result
 */
export function pickReliever({ model, me, slot, dateKey, absent, load, avoid = new Set(), random = false }) {
  const free = rankCandidates({ model, me, piece: slot, dateKey, absent, load }).filter((c) => c.free && !c.status);
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
  let prev = null; // { day, lab, name } of the previous slot, for rotation
  for (const slot of pieces) {
    const rotate = new Set(avoid);
    if (prev && prev.day === slot.day && prev.lab === slot.lab && prev.name) rotate.add(prev.name);
    const name = pickReliever({ model, me, slot, dateKey: dates[slot.day], absent, load, avoid: rotate, random });
    assignments[pieceKey(slot)] = name;
    if (name) load[name] = (load[name] || 0) + (slot.end - slot.start);
    prev = { day: slot.day, lab: slot.lab, name };
  }
  return { pieces, assignments };
}

import { overlaps } from './schedule.js';

export const pieceKey = (p) => `${p.day}|${p.start}|${p.end}`;

/**
 * A reliever is only needed while a laboratory is open. Cut each duty shift down to the times
 * when at least one lab is in use that day. With no lab schedule loaded, shifts are left alone.
 */
export function clipToLabs(shifts, labs) {
  if (!labs?.length) return shifts;
  const out = [];
  for (const s of shifts) {
    const wins = labs
      .filter((l) => l.day === s.day)
      .map((l) => ({ start: Math.max(l.start, s.start), end: Math.min(l.end, s.end) }))
      .filter((w) => w.end > w.start)
      .sort((a, b) => a.start - b.start);
    const merged = [];
    for (const w of wins) {
      const last = merged[merged.length - 1];
      if (last && w.start <= last.end) last.end = Math.max(last.end, w.end); else merged.push({ ...w });
    }
    for (const w of merged) out.push({ ...s, start: w.start, end: w.end });
  }
  return out;
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

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Cover each duty shift of `me` with SAs who are FREE (no duty, no class) at that time.
 * If nobody is free for the whole shift it is split into pieces, each covered by whoever
 * is free the longest; stretches nobody can cover stay unassigned (TBD).
 *  - avoid: names to avoid when there is an alternative (used by "Regenerate")
 *  - random: shuffle ties so every regenerate can give a different valid result
 */
export function generatePieces({ model, me, shifts: allShifts, dates, absent, avoid = new Set(), random = false, labs = [], load0 = {} }) {
  const shifts = clipToLabs(allShifts, labs);
  const load = { ...load0 };
  const pieces = [];
  const assignments = {};
  const others = model.sas.filter((s) => s.name !== me.name);

  for (const shift of shifts) {
    const dateKey = dates[shift.day];
    const pool = others.filter((s) => !absent[`${dateKey}|${s.name}`]);
    let pos = shift.start;

    while (pos < shift.end) {
      const info = (random ? shuffle(pool) : pool).map((sa) => {
        const busy = busyBlocks(sa, me).filter((s) => s.day === shift.day && s.end > pos);
        if (busy.some((s) => s.start <= pos)) {
          return { sa, ext: 0, freeAt: Math.min(...busy.filter((s) => s.start <= pos).map((s) => s.end)) };
        }
        const next = Math.min(shift.end, ...busy.map((s) => s.start));
        return { sa, ext: next - pos, freeAt: pos };
      });
      const maxExt = Math.max(0, ...info.map((i) => i.ext));

      if (maxExt === 0) {
        // nobody free: leave a TBD gap until the first person becomes free (or the shift ends)
        const nextFree = Math.min(shift.end, ...info.map((i) => i.freeAt).filter((t) => t > pos));
        const end = Number.isFinite(nextFree) ? nextFree : shift.end;
        const prev = pieces[pieces.length - 1];
        if (prev && prev.day === shift.day && prev.end === pos && assignments[pieceKey(prev)] === null) {
          delete assignments[pieceKey(prev)]; // extend the previous TBD gap
          prev.end = end;
          assignments[pieceKey(prev)] = null;
        } else {
          const p = { day: shift.day, start: pos, end, note: shift.note };
          pieces.push(p);
          assignments[pieceKey(p)] = null;
        }
        pos = end;
        continue;
      }

      const need = shift.end - pos;
      const threshold = maxExt >= need ? need : Math.max(Math.min(60, maxExt), maxExt * 0.75);
      let group = info.filter((i) => i.ext >= threshold);
      const fresh = group.filter((i) => !avoid.has(i.sa.name));
      if (fresh.length) group = fresh;
      // the block partner is the natural cover; otherwise spread the load fairly
      const partners = group.filter((g) => isPartner(g.sa, me));
      if (partners.length && !partners.every((g) => avoid.has(g.sa.name))) group = partners;
      group.sort((a, b) => (load[a.sa.name] || 0) - (load[b.sa.name] || 0) || b.ext - a.ext);
      const lowest = load[group[0].sa.name] || 0;
      const top = group.filter((g) => (load[g.sa.name] || 0) === lowest);
      const pick = random ? top[Math.floor(Math.random() * top.length)] : top[0];

      const p = { day: shift.day, start: pos, end: pos + pick.ext, note: shift.note };
      pieces.push(p);
      assignments[pieceKey(p)] = pick.sa.name;
      load[pick.sa.name] = (load[pick.sa.name] || 0) + pick.ext;
      pos += pick.ext;
    }
  }
  return { pieces, assignments };
}

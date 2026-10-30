import { DAYS } from './schedule.js';
import { coverageByLab } from './reliever.js';

export const AXIS = { start: 7 * 60, end: 22 * 60 }; // the sheet runs 7:00 AM to 10:00 PM

/** The blocks of one day column: duty, class, "cover" = the part of duty while a laboratory is open, "shared" = on duty together with a room-mate. */
export function dayBlocks(sa, labs, day, shared = []) {
  const shifts = (sa?.shifts || []).filter((s) => s.day === day);
  const cover = [];
  for (const { ranges } of coverageByLab((sa?.shifts || []).filter((s) => s.type === 'duty'), labs, day)) cover.push(...ranges);
  cover.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of cover) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end); else merged.push({ ...r });
  }
  return [
    ...shifts.map((s) => ({ kind: s.type, start: s.start, end: s.end })),
    ...merged.map((r) => ({ kind: 'cover', start: r.start, end: r.end })),
    ...shared.flatMap((p) => p.windows).map((w) => ({ kind: 'shared', start: w.start, end: w.end })),
  ];
}

export const weekBlocks = (sa, labs, shared = {}) => Object.fromEntries(DAYS.map((d) => [d, dayBlocks(sa, labs, d, shared[d] || [])]));

/** Percent offsets inside the axis, clamped, for absolute positioning. */
export function place(b, axis = AXIS) {
  const span = axis.end - axis.start;
  const top = Math.max(0, Math.min(1, (b.start - axis.start) / span));
  const bottom = Math.max(0, Math.min(1, (b.end - axis.start) / span));
  return { top: top * 100, height: Math.max(0, bottom - top) * 100 };
}

import { DAYS } from './schedule.js';

/** The part of two time ranges they share, or null. */
export const intersect = (a, b) => {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
};

/**
 * Who is on duty at the same time as `me` in the same room, and when.
 * The sheet gives every room one block with its own people (the "team"), so only block-mates are considered:
 * nobody from another room is ever listed. Returns [{ name, partner, minutes, windows: [{ start, end }] }] for one day.
 * Windows already over are dropped; a running one is cut to start now. Only duty (yellow) counts, so nobody listed is in class then.
 */
export function dutyOverlaps({ model, me, day, nowMins = 0, minLen = 30, limit = 4 }) {
  const mine = model?.sas.find((s) => s.name === me);
  if (!mine?.team || !DAYS.includes(day)) return []; // no block (room) on record: nothing to compare
  const myDuty = mine.shifts.filter((s) => s.type === 'duty' && s.day === day);
  const out = [];
  for (const sa of model.sas) {
    if (sa.name === me || sa.team !== mine.team) continue; // another room
    const windows = [];
    for (const a of myDuty) for (const b of sa.shifts) {
      if (b.type !== 'duty' || b.day !== day) continue;
      const w = intersect(a, b);
      if (!w || w.end <= nowMins) continue;
      const clipped = { start: Math.max(w.start, nowMins), end: w.end };
      if (clipped.end - clipped.start >= minLen) windows.push(clipped);
    }
    if (!windows.length) continue;
    windows.sort((x, y) => x.start - y.start);
    out.push({ name: sa.name, partner: true, minutes: windows.reduce((n, w) => n + w.end - w.start, 0), windows });
  }
  out.sort((a, b) => (b.partner ? 1 : 0) - (a.partner ? 1 : 0) || b.minutes - a.minutes || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}

/** Round up to the next quarter hour, so a break never starts "in the past". */
export const nextQuarter = (mins) => Math.ceil(mins / 15) * 15;

/** Keep a break of `dur` minutes starting near `start` inside the shared window. */
export function clampBreak(window, start, dur) {
  const len = Math.min(dur, window.end - window.start);
  const s = Math.min(Math.max(start, window.start), window.end - len);
  return { start: s, end: s + len };
}

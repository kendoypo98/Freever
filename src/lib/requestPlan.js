import { pieceKey } from './reliever.js';

/** One request per person per room per unbroken stretch: 7-8, 8-9 and 9-10 with the same person becomes 7-10. */
export function requestEntries({ pieces, assignments, dates }) {
  const out = [];
  const sorted = [...pieces].sort((a, b) => a.day.localeCompare(b.day) || a.lab.localeCompare(b.lab) || a.start - b.start);
  for (const p of sorted) {
    const who = assignments[pieceKey(p)];
    if (!who || !dates[p.day]) continue;
    const last = out[out.length - 1];
    if (last && last.reliever_name === who && last.day === p.day && last.lab === p.lab && last.end_min === p.start) last.end_min = p.end;
    else out.push({ reliever_name: who, day: p.day, on_date: dates[p.day], lab: p.lab, start_min: p.start, end_min: p.end });
  }
  return out;
}

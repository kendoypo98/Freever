import { DAYS } from './schedule.js';
import { dayBlocks } from './week.js';

const len = (b) => b.end - b.start;

/** Minutes of duty, class and "a laboratory is open during duty" for each day and for the whole week. */
export function weekSummary(sa, labs) {
  const days = DAYS.map((day) => {
    const blocks = dayBlocks(sa, labs, day);
    const sum = (kind) => blocks.filter((b) => b.kind === kind).reduce((n, b) => n + len(b), 0);
    return { day, duty: sum('duty'), class: sum('class'), cover: sum('cover') };
  });
  const total = (k) => days.reduce((n, d) => n + d[k], 0);
  return { days, duty: total('duty'), class: total('class'), cover: total('cover') };
}

/** 90 -> "1.5 h", 120 -> "2 h" */
export const hoursLabel = (mins) => { const h = mins / 60; return `${Number.isInteger(h) ? h : h.toFixed(1)} h`; };

/** 135 -> "2h 15m", 45 -> "45m" */
export const spanLabel = (mins) => { const h = Math.floor(mins / 60); const m = Math.round(mins % 60); return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`; };

import { DAYS } from './schedule.js';
import { coverageByLab } from './reliever.js';

/** MON..SAT for a date, or null on Sunday (nobody is scheduled). */
export const dayOf = (d = new Date()) => DAYS[(d.getDay() + 6) % 7] ?? null;
export const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The next duty shift after `now` (today's later shifts first, then the following days). */
export function nextDuty(shifts, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let off = 0; off < 7; off++) {
    const d = new Date(now); d.setDate(d.getDate() + off);
    const day = dayOf(d);
    const list = shifts.filter((s) => s.type === 'duty' && s.day === day && (off > 0 || s.start > mins)).sort((a, b) => a.start - b.start);
    if (list.length) return { day, offset: off, date: isoOf(d), start: list[0].start, end: list[0].end };
  }
  return null;
}

/**
 * Everything the Today screen shows for one student assistant:
 *  status: 'rest' (Sunday) | 'off' (no duty today) | 'on' (on duty right now) | 'later' | 'done'
 *  rooms:  [{ lab, ranges }] laboratory rooms that are open during today's duty, i.e. what needs a reliever if you cannot come
 */
export function todayPlan({ sa, labs, now = new Date() }) {
  const day = dayOf(now);
  const mins = now.getHours() * 60 + now.getMinutes();
  const shifts = sa?.shifts || [];
  const duty = shifts.filter((s) => s.type === 'duty' && s.day === day).sort((a, b) => a.start - b.start);
  const classes = shifts.filter((s) => s.type === 'class' && s.day === day).sort((a, b) => a.start - b.start);
  const nowShift = duty.find((s) => s.start <= mins && mins < s.end) || null;
  const status = !day ? 'rest' : !duty.length ? 'off' : nowShift ? 'on' : duty.some((s) => s.start > mins) ? 'later' : 'done';
  return {
    day, date: isoOf(now), duty, classes, nowShift, status,
    rooms: day ? coverageByLab(shifts.filter((s) => s.type === 'duty'), labs, day) : [],
    next: nextDuty(shifts, now),
  };
}

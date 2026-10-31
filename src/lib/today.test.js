import { describe, it, expect } from 'vitest';
import { dayOf, nextDuty, todayPlan } from './today.js';
import { dayBlocks, place } from './week.js';

const H = (h, m = 0) => h * 60 + m;
const at = (iso, h, m = 0) => new Date(`${iso}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
const sa = { name: 'ME', shifts: [
  { day: 'MON', type: 'duty', start: H(7), end: H(14) },
  { day: 'MON', type: 'class', start: H(14), end: H(16) },
  { day: 'WED', type: 'duty', start: H(10), end: H(12) },
] };
const labs = [{ lab: '1107', day: 'MON', start: H(7), end: H(17) }, { lab: '1108', day: 'MON', start: H(13), end: H(15) }];
const MONDAY = '2026-11-02'; // a Monday

describe('todayPlan', () => {
  it('knows the weekday and returns null on Sunday', () => {
    expect(dayOf(at(MONDAY, 9))).toBe('MON');
    expect(dayOf(at('2026-11-01', 9))).toBeNull();
  });
  it('tracks on duty / later / done through the day', () => {
    expect(todayPlan({ sa, labs, now: at(MONDAY, 6) }).status).toBe('later');
    expect(todayPlan({ sa, labs, now: at(MONDAY, 9) }).status).toBe('on');
    expect(todayPlan({ sa, labs, now: at(MONDAY, 15) }).status).toBe('done');
    expect(todayPlan({ sa, labs, now: at('2026-11-03', 9) }).status).toBe('off');
    expect(todayPlan({ sa, labs, now: at('2026-11-01', 9) }).status).toBe('rest');
  });
  it('lists the rooms that need cover during duty', () => {
    const rooms = todayPlan({ sa, labs, now: at(MONDAY, 9) }).rooms;
    expect(rooms.map((r) => [r.lab, r.ranges[0].start, r.ranges[0].end])).toEqual([['1107', H(7), H(14)], ['1108', H(13), H(14)]]);
  });
  it('finds the next duty, rolling over to another day', () => {
    expect(nextDuty(sa.shifts, at(MONDAY, 15))).toMatchObject({ day: 'WED', offset: 2, start: H(10) });
  });
});

describe('week blocks', () => {
  it('draws duty, class and the merged cover range', () => {
    const b = dayBlocks(sa, labs, 'MON');
    expect(b.filter((x) => x.kind === 'cover')).toEqual([{ kind: 'cover', start: H(7), end: H(14) }]);
    expect(b.map((x) => x.kind).sort()).toEqual(['class', 'cover', 'duty']);
  });
  it('places blocks as percentages of the 7:00-22:00 axis', () => {
    expect(place({ start: H(7), end: H(22) })).toEqual({ top: 0, height: 100 });
    expect(place({ start: H(14, 30), end: H(22) }).top).toBe(50);
  });
});

import { weekSummary, hoursLabel, spanLabel } from './weekstats.js';
describe('week summary', () => {
  it('adds up duty, class and cover minutes per day and for the week', () => {
    const w = weekSummary(sa, labs);
    expect(w.days.find((d) => d.day === 'MON')).toMatchObject({ duty: H(7), class: H(2), cover: H(7) });
    expect(w.duty).toBe(H(7) + H(2)); // Monday 7 h + Wednesday 2 h
    expect(hoursLabel(90)).toBe('1.5 h');
    expect(spanLabel(135)).toBe('2h 15m');
    expect(spanLabel(45)).toBe('45m');
  });
});

import { dutyOverlaps, clampBreak, nextQuarter } from './overlaps.js';
describe('duty overlaps', () => {
  const model = { sas: [
    { name: 'ME', team: 'ME / PAL', shifts: [{ day: 'MON', type: 'duty', start: H(12), end: H(22) }] },
    { name: 'PAL', team: 'ME / PAL', shifts: [{ day: 'MON', type: 'duty', start: H(7), end: H(14) }, { day: 'MON', type: 'class', start: H(14), end: H(16) }] },
    { name: 'RAY', team: '', shifts: [{ day: 'MON', type: 'duty', start: H(13), end: H(13, 20) }, { day: 'MON', type: 'duty', start: H(18), end: H(21) }] },
    { name: 'SUE', team: '', shifts: [{ day: 'TUE', type: 'duty', start: H(12), end: H(20) }] },
  ] };
  it('lists only people of the same room (block), with the exact shared time', () => {
    const o = dutyOverlaps({ model, me: 'ME', day: 'MON' });
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ name: 'PAL', partner: true, windows: [{ start: H(12), end: H(14) }] });
    expect(o.find((x) => x.name === 'RAY')).toBeUndefined(); // on duty at the same time, but in another room
    expect(o.find((x) => x.name === 'SUE')).toBeUndefined();
  });
  it('lists nobody when the student has no room block on record', () => {
    expect(dutyOverlaps({ model: { sas: [{ name: 'A', team: '', shifts: [{ day: 'MON', type: 'duty', start: 0, end: 600 }] }, { name: 'B', team: '', shifts: [{ day: 'MON', type: 'duty', start: 0, end: 600 }] }] }, me: 'A', day: 'MON' })).toEqual([]);
  });
  it('drops windows that are over and cuts a running one to now', () => {
    expect(dutyOverlaps({ model, me: 'ME', day: 'MON', nowMins: H(13) })[0].windows).toEqual([{ start: H(13), end: H(14) }]);
    expect(dutyOverlaps({ model, me: 'ME', day: 'MON', nowMins: H(15) })).toEqual([]); // the partner's duty ended at 2 PM
  });
  it('keeps a break inside the shared window', () => {
    expect(clampBreak({ start: H(12), end: H(14) }, H(13, 45), 30)).toEqual({ start: H(13, 30), end: H(14) });
    expect(clampBreak({ start: H(12), end: H(12, 40) }, H(12), 60)).toEqual({ start: H(12), end: H(12, 40) });
    expect(nextQuarter(H(13, 1))).toBe(H(13, 15));
  });
});

describe('shared duty on the week timetable', () => {
  it('adds a shared block where a room-mate is on duty too', () => {
    const model = { sas: [{ name: 'ME', team: 'T', shifts: [{ day: 'MON', type: 'duty', start: H(12), end: H(22) }] }, { name: 'PAL', team: 'T', shifts: [{ day: 'MON', type: 'duty', start: H(7), end: H(14) }] }] };
    const shared = dutyOverlaps({ model, me: 'ME', day: 'MON' });
    expect(dayBlocks(model.sas[0], [], 'MON', shared).filter((b) => b.kind === 'shared')).toEqual([{ kind: 'shared', start: H(12), end: H(14) }]);
  });
});

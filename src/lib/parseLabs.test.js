import { describe, it, expect } from 'vitest';
import { daysOf, labsFromRows } from './parseLabs.js';

const head = ['DEPT', 'TYPE', 'ROOM', 'DAYS', 'START', 'END', 'INSTRUCTOR'];
const row = (room, days, start, end, who = 'DOE, J') => ['X', 'Lec', room, days, start, end, who];
const H = (h, m = 0) => h * 60 + m;

describe('daysOf', () => {
  it('reads day codes', () => {
    expect(daysOf('MWF')).toEqual(['MON', 'WED', 'FRI']);
    expect(daysOf('TTh')).toEqual(['TUE', 'THU']);
    expect(daysOf('Th')).toEqual(['THU']);
    expect(daysOf('S')).toEqual(['SAT']);
    expect(daysOf('Saturday')).toEqual(['SAT']);
  });
});

describe('labsFromRows', () => {
  it('joins back-to-back classes into one sorted window and expands multi-day codes', () => {
    const rows = [['TITLE'], head,
      row('1107', 'M', '12:00 PM', '2:00 PM'), row('1107', 'M', '7:00 AM', '9:00 AM'),
      row('1107', 'M', '2:00 PM', '5:00 PM'), row('1107', 'M', '9:00 AM', '12:00 PM'),
      row('1107', 'M', '7:00 PM', '10:00 PM'), row('1106', 'TTh', '8:30 AM', '10:00 AM')];
    const { labs } = labsFromRows(rows);
    expect(labs.filter((l) => l.lab === '1107' && l.day === 'MON').map((l) => [l.start, l.end]))
      .toEqual([[H(7), H(17)], [H(19), H(22)]]);
    expect(labs.filter((l) => l.lab === '1106').map((l) => l.day)).toEqual(['TUE', 'THU']);
  });
  it('skips cancelled sections and unreadable times', () => {
    const rows = [head, row('1107', 'M', '7:00 AM', '9:00 AM', 'DELETED 7-9'), row('1107', 'T', '', ''), row('1107', 'W', '7:00 AM', '8:00 AM')];
    const { labs, skipped } = labsFromRows(rows);
    expect(labs).toHaveLength(1);
    expect(skipped).toBe(2);
  });
  it('is null without the expected columns', () => {
    expect(labsFromRows([['a', 'b'], [1, 2]])).toBeNull();
  });
});

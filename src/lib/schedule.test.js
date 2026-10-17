import { describe, it, expect } from 'vitest';
import { normalizeDay, parseTime, parseRange, fmtRange, fmtTime, overlaps, findUniqueName, niceName, initialsOf, normalizeLabs } from './schedule.js';

describe('days and times', () => {
  it('understands day abbreviations used in the sheets', () => {
    expect(normalizeDay('M')).toBe('MON');
    expect(normalizeDay('Th')).toBe('THU');
    expect(normalizeDay('Sat')).toBe('SAT');
    expect(normalizeDay('nonsense')).toBeNull();
  });

  it('parses single times', () => {
    expect(parseTime('1pm')).toBe(13 * 60);
    expect(parseTime('8:30')).toBe(8 * 60 + 30);
    expect(parseTime(0.5)).toBe(12 * 60); // Excel day fraction
    expect(parseTime('25')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('parses ranges, treating small bare hours as afternoon', () => {
    expect(parseRange('8:00am - 12:00pm')).toEqual({ start: 480, end: 720 });
    expect(parseRange('1-5')).toEqual({ start: 13 * 60, end: 17 * 60 });
    expect(parseRange('10-2')).toEqual({ start: 600, end: 840 });
    expect(parseRange('not a range')).toBeNull();
  });

  it('formats 12-hour and 24-hour times', () => {
    expect(fmtTime(0)).toBe('12:00 AM');
    expect(fmtTime(13 * 60 + 5)).toBe('1:05 PM');
    expect(fmtRange(540, 720, true)).toBe('09:00 – 12:00');
  });

  it('detects overlaps but not touching ranges', () => {
    expect(overlaps({ start: 0, end: 60 }, { start: 30, end: 90 })).toBe(true);
    expect(overlaps({ start: 0, end: 60 }, { start: 60, end: 90 })).toBe(false);
  });
});

describe('names', () => {
  const sas = [{ name: 'ANA MARIE REYES' }, { name: 'JUAN DELA CRUZ' }];
  it('only reveals a single unambiguous match of at least two words', () => {
    expect(findUniqueName('ana reyes', sas)?.name).toBe('ANA MARIE REYES');
    expect(findUniqueName('ana', sas)).toBeNull(); // one word could be used to fish for names
    expect(findUniqueName('zzz yyy', sas)).toBeNull();
  });
  it('formats display names and initials', () => {
    expect(niceName('MARL BENEDICT LUKBAN')).toBe('Marl Benedict Lukban');
    expect(initialsOf('ANA MARIE REYES')).toBe('AR');
  });
});

describe('normalizeLabs', () => {
  it('drops invalid rows and merges back-to-back windows of one lab', () => {
    const labs = normalizeLabs([
      { lab: 'L1', day: 'MON', start: '08:00', end: '10:00' },
      { lab: 'L1', day: 'MON', start: '10:00', end: '12:00' },
      { lab: 'L1', day: 'TUE', start: '12:00', end: '09:00' },
      { lab: 'L1', day: 'xyz', start: '08:00', end: '09:00' },
    ]);
    expect(labs).toEqual([{ lab: 'L1', day: 'MON', start: 480, end: 720 }]);
  });
});

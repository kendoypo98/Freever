import { describe, it, expect } from 'vitest';
import { buildMessage, formatDate, mentionNames } from './message.js';
import { pieceKey } from './reliever.js';
import { fmtShort } from './schedule.js';

const H = (h, m = 0) => h * 60 + m;
const duty = (day, start, end) => ({ day, start, end, type: 'duty' });

describe('fmtShort', () => {
  it('uses lowercase am/pm and nn for noon', () => {
    expect(fmtShort(H(7))).toBe('7:00am');
    expect(fmtShort(H(12))).toBe('12:00nn');
    expect(fmtShort(H(12, 30))).toBe('12:30pm');
    expect(fmtShort(H(13))).toBe('1:00pm');
    expect(fmtShort(0)).toBe('12:00am');
    expect(fmtShort(H(13, 30), true)).toBe('13:30');
  });
});

describe('buildMessage', () => {
  const slots = [[7, 8, 'ANGELICA REYES'], [8, 9, 'MARIANNE CRUZ'], [9, 10, 'ANDREI LIM'], [10, 11, 'RLYMCH SOTO'], [11, 12, 'RLYMCH SOTO'], [12, 13, 'SARAH DIAZ']]
    .map(([a, b, who]) => ({ p: { day: 'MON', lab: '5501', start: H(a), end: H(b) }, who }));
  const model = { sas: [
    { name: 'ANGELICA REYES', shifts: [duty('MON', H(7), H(8))] },
    { name: 'MARIANNE CRUZ', shifts: [duty('MON', H(8), H(9))] },
    { name: 'ANDREI LIM', shifts: [] }, // off duty -> OT
    { name: 'RLYMCH SOTO', shifts: [duty('MON', H(10), H(12))] },
    { name: 'SARAH DIAZ', shifts: [duty('MON', H(12), H(13))] },
  ] };
  const args = {
    me: { name: 'LJ SANTOS' }, pieces: slots.map((s) => s.p),
    assignments: Object.fromEntries(slots.map((s) => [pieceKey(s.p), s.who])),
    dates: { MON: '2026-10-19' }, tpl: {}, use24: false, model, today: '2026-10-19',
  };

  it('reproduces the Messenger sample format', () => {
    expect(buildMessage(args)).toBe([
      "@LJ's Temporary Relievers for Today",
      '',
      '(5501)',
      '7:00am - 8:00am — @Angelica',
      '8:00am - 9:00am — @Marianne',
      '9:00am - 10:00am — @Andrei (OT)',
      '10:00am - 12:00nn — @Rlymch',
      '12:00nn - 1:00pm — @Sarah',
    ].join('\n'));
  });
  it('uses the weekday when the date is not today, and TBD when nobody is assigned', () => {
    const text = buildMessage({ ...args, today: '2026-10-20', assignments: {} });
    expect(text).toContain('for Monday');
    expect(text).toContain('7:00am - 1:00pm — TBD');
  });
  it('honours a custom title, signature name and closing line', () => {
    const text = buildMessage({ ...args, tpl: { title: 'Relievers of {me} ({day})', signature: 'LJ', closing: 'Thank you!' } });
    expect(text.split('\n')[0]).toBe('Relievers of LJ (Today)');
    expect(text.endsWith('Thank you!')).toBe(true);
  });
  it('adds a last initial only when two first names collide', () => {
    expect(mentionNames(['ANA REYES', 'ANA LIM', 'JOSE CRUZ'])).toEqual({ 'ANA REYES': 'Ana R.', 'ANA LIM': 'Ana L.', 'JOSE CRUZ': 'Jose' });
  });
  it('formats ISO dates without time-zone drift', () => {
    expect(formatDate('2026-01-01')).toBe('January 1, 2026');
    expect(formatDate('')).toBe('');
  });
});

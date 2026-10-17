import { describe, it, expect } from 'vitest';
import { buildMessage, formatDate } from './message.js';
import { pieceKey } from './reliever.js';

describe('buildMessage', () => {
  const piece = { day: 'MON', start: 540, end: 720 };
  const base = {
    me: { name: 'JUAN DELA CRUZ' }, pieces: [piece], assignments: { [pieceKey(piece)]: 'ANA REYES' },
    dates: { MON: '2026-10-19' }, tpl: {}, use24: false,
  };

  it('lists each day with its date, time and reliever', () => {
    const text = buildMessage(base);
    expect(text).toContain('Monday (October 19, 2026)');
    expect(text).toContain('• 9:00 AM – 12:00 PM — Reliever: Ana Reyes');
    expect(text).toContain('— Juan Dela Cruz');
  });
  it('writes TBD when nobody is assigned and honours template overrides', () => {
    const text = buildMessage({ ...base, assignments: { [pieceKey(piece)]: null }, tpl: { greeting: 'Hello!', signature: 'JD' } });
    expect(text.startsWith('Hello!')).toBe(true);
    expect(text).toContain('Reliever: TBD');
    expect(text).toContain('— JD');
  });
  it('formats ISO dates without time-zone drift', () => {
    expect(formatDate('2026-01-01')).toBe('January 1, 2026');
    expect(formatDate('')).toBe('');
  });
});

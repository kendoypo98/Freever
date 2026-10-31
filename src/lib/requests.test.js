import { describe, it, expect } from 'vitest';
import { requestEntries } from './requestPlan.js';
import { pieceKey } from './reliever.js';

const H = (h) => h * 60;
const piece = (lab, start, end) => ({ day: 'MON', lab, start: H(start), end: H(end) });

describe('requestEntries', () => {
  it('joins back-to-back hours of the same person and room into one request', () => {
    const pieces = [piece('1107', 7, 8), piece('1107', 8, 9), piece('1107', 9, 10)];
    const assignments = { [pieceKey(pieces[0])]: 'ANA', [pieceKey(pieces[1])]: 'ANA', [pieceKey(pieces[2])]: 'BEN' };
    const out = requestEntries({ pieces, assignments, dates: { MON: '2026-11-02' } });
    expect(out.map((e) => [e.reliever_name, e.start_min, e.end_min])).toEqual([['ANA', H(7), H(9)], ['BEN', H(9), H(10)]]);
  });
  it('skips empty slots and keeps rooms apart', () => {
    const pieces = [piece('1107', 7, 8), piece('1108', 7, 8), piece('1108', 8, 9)];
    const assignments = { [pieceKey(pieces[0])]: 'ANA', [pieceKey(pieces[1])]: 'ANA', [pieceKey(pieces[2])]: null };
    const out = requestEntries({ pieces, assignments, dates: { MON: '2026-11-02' } });
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.lab)).toEqual(['1107', '1108']);
  });
});

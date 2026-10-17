import { describe, it, expect } from 'vitest';
import { clipToLabs, generatePieces, pieceKey, rankCandidates } from './reliever.js';

const me = { name: 'ME' };
const sa = (name, shifts = [], team = '') => ({ name, team, shifts });
const duty = (day, start, end) => ({ day, start, end, type: 'duty' });
const cls = (day, start, end) => ({ day, start, end, type: 'class' });
const dates = { MON: '2026-10-19' };

describe('clipToLabs', () => {
  it('keeps only the part of a shift while a laboratory is open', () => {
    const out = clipToLabs([duty('MON', 420, 900)], [
      { lab: 'A', day: 'MON', start: 480, end: 600 },
      { lab: 'B', day: 'MON', start: 570, end: 660 },
    ]);
    expect(out.map((s) => [s.start, s.end])).toEqual([[480, 660]]);
  });
  it('leaves shifts alone without a lab schedule, and drops days with no lab', () => {
    expect(clipToLabs([duty('MON', 420, 900)], [])).toHaveLength(1);
    expect(clipToLabs([duty('TUE', 420, 900)], [{ lab: 'A', day: 'MON', start: 480, end: 600 }])).toHaveLength(0);
  });
});

describe('generatePieces', () => {
  it('assigns somebody who is free for the whole shift', () => {
    const model = { sas: [sa('ME', [duty('MON', 540, 720)]), sa('A'), sa('B', [cls('MON', 600, 660)])] };
    const { pieces, assignments } = generatePieces({ model, me, shifts: [duty('MON', 540, 720)], dates, absent: {} });
    expect(pieces).toHaveLength(1);
    expect(assignments[pieceKey(pieces[0])]).toBe('A');
  });

  it('leaves a TBD gap when nobody is free, then continues with whoever frees up', () => {
    const model = { sas: [sa('ME'), sa('B', [cls('MON', 540, 600)])] };
    const { pieces, assignments } = generatePieces({ model, me, shifts: [duty('MON', 540, 720)], dates, absent: {} });
    expect(pieces.map((p) => [p.start, p.end])).toEqual([[540, 600], [600, 720]]);
    expect(assignments[pieceKey(pieces[0])]).toBeNull();
    expect(assignments[pieceKey(pieces[1])]).toBe('B');
  });

  it('skips people marked absent on that date', () => {
    const model = { sas: [sa('ME'), sa('A'), sa('B')] };
    const absent = { '2026-10-19|A': 'absent' };
    const { pieces, assignments } = generatePieces({ model, me, shifts: [duty('MON', 540, 720)], dates, absent });
    expect(assignments[pieceKey(pieces[0])]).toBe('B');
  });

  it('prefers the block partner, who may already be on duty at the same post', () => {
    const model = { sas: [sa('ME', [], 'T1'), sa('PARTNER', [duty('MON', 540, 720)], 'T1'), sa('OTHER')] };
    const { pieces, assignments } = generatePieces({ model, me: { name: 'ME', team: 'T1' }, shifts: [duty('MON', 540, 720)], dates, absent: {} });
    expect(assignments[pieceKey(pieces[0])]).toBe('PARTNER');
  });
});

describe('rankCandidates', () => {
  it('lists free people first and flags busy ones with their conflicts', () => {
    const model = { sas: [sa('ME'), sa('BUSY', [cls('MON', 540, 600)]), sa('FREE')] };
    const list = rankCandidates({ model, me, piece: { day: 'MON', start: 540, end: 720 }, dateKey: '2026-10-19', absent: {}, load: {} });
    expect(list.map((c) => c.name)).toEqual(['FREE', 'BUSY']);
    expect(list[1].free).toBe(false);
    expect(list[1].conflicts).toHaveLength(1);
  });
});

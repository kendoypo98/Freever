import { describe, it, expect } from 'vitest';
import { buildSlots, coverageByLab, generateSlots, isOvertime, pickReliever, pieceKey, rankCandidates } from './reliever.js';

const me = { name: 'ME' };
const sa = (name, shifts = [], team = '') => ({ name, team, shifts });
const duty = (day, start, end) => ({ day, start, end, type: 'duty' });
const cls = (day, start, end) => ({ day, start, end, type: 'class' });
const dates = { MON: '2026-10-19' };
const lab = (room, day, start, end) => ({ lab: room, day, start, end });
const H = (h, m = 0) => h * 60 + m;

describe('buildSlots', () => {
  it('cuts the part of a duty shift while a room is open into clock-hour slots', () => {
    const out = buildSlots([duty('MON', H(7), H(10))], [lab('5501', 'MON', H(7, 30), H(12))]);
    expect(out.map((s) => [s.lab, s.start, s.end])).toEqual([
      ['5501', H(7, 30), H(8)], ['5501', H(8), H(9)], ['5501', H(9), H(10)],
    ]);
  });
  it('makes one list per room and keeps rooms apart', () => {
    const out = buildSlots([duty('MON', H(7), H(9))], [lab('B', 'MON', H(7), H(9)), lab('A', 'MON', H(8), H(9))]);
    expect(out.map((s) => `${s.lab}@${s.start}`)).toEqual([`A@${H(8)}`, `B@${H(7)}`, `B@${H(8)}`]);
  });
  it('is empty without a lab schedule or when no room is open that day', () => {
    expect(buildSlots([duty('MON', H(7), H(9))], [])).toEqual([]);
    expect(buildSlots([duty('TUE', H(7), H(9))], [lab('A', 'MON', H(7), H(9))])).toEqual([]);
  });
});

describe('generateSlots', () => {
  const labs = [lab('5501', 'MON', H(7), H(10))];
  const shifts = [duty('MON', H(7), H(10))];
  const onDuty = (name, extra = [], team = '') => sa(name, [duty('MON', H(7), H(10)), ...extra], team);
  const run = (model, extra = {}) => generateSlots({ model, me, shifts, dates, absent: {}, labs, ...extra });

  it('assigns only students who are on duty (yellow) and not in class (blue)', () => {
    const model = { sas: [sa('ME', shifts), onDuty('A'), onDuty('B', [cls('MON', H(8), H(9))])] };
    const { pieces, assignments } = run(model);
    expect(pieces).toHaveLength(3);
    expect(assignments[pieceKey(pieces[1])]).toBe('A'); // B is in class 8-9
  });

  it('rotates names between hours when several people are available', () => {
    const model = { sas: [sa('ME', shifts), onDuty('A'), onDuty('B'), onDuty('C')] };
    const { pieces, assignments } = run(model);
    const names = pieces.map((p) => assignments[pieceKey(p)]);
    expect(names[0]).not.toBe(names[1]);
    expect(names[1]).not.toBe(names[2]);
  });

  it('never assigns off-duty (white) students automatically, since that is overtime', () => {
    const model = { sas: [sa('ME', shifts), sa('WHITE')] };
    const { pieces, assignments } = run(model);
    pieces.forEach((p) => expect(assignments[pieceKey(p)]).toBeNull());
  });

  it('leaves a slot unassigned when nobody on duty is available', () => {
    const model = { sas: [sa('ME', shifts), onDuty('B', [cls('MON', H(8), H(9))])] };
    const { pieces, assignments } = run(model);
    expect(assignments[pieceKey(pieces[0])]).toBe('B');
    expect(assignments[pieceKey(pieces[1])]).toBeNull();
    expect(assignments[pieceKey(pieces[2])]).toBe('B');
  });

  it('skips people marked absent on that date', () => {
    const model = { sas: [sa('ME', shifts), onDuty('A'), onDuty('B')] };
    const { pieces, assignments } = run(model, { absent: { '2026-10-19|A': 'absent' } });
    pieces.forEach((p) => expect(assignments[pieceKey(p)]).toBe('B'));
  });

  it('prefers the block partner', () => {
    const model = { sas: [sa('ME', [], 'T1'), onDuty('OTHER'), onDuty('PARTNER', [], 'T1')] };
    const res = generateSlots({ model, me: { name: 'ME', team: 'T1' }, shifts, dates, absent: {}, labs });
    res.pieces.forEach((p) => expect(res.assignments[pieceKey(p)]).toBe('PARTNER'));
  });
});

describe('isOvertime', () => {
  const slot = { day: 'MON', start: H(9), end: H(10) };
  it('is overtime when the student is not on duty for the whole slot', () => {
    expect(isOvertime(sa('A'), slot)).toBe(true);
    expect(isOvertime(sa('A', [duty('MON', H(8), H(12))]), slot)).toBe(false);
    expect(isOvertime(sa('A', [duty('MON', H(8), H(9, 30))]), slot)).toBe(true);
  });
});

describe('pickReliever / rankCandidates', () => {
  const slot = { day: 'MON', lab: 'A', start: H(9), end: H(10) };
  it('ranks on-duty students first, then off-duty (overtime), then students in class', () => {
    const model = { sas: [
      sa('ME'),
      sa('CLASS', [duty('MON', H(7), H(10)), cls('MON', H(9), H(10))]),
      sa('OFF'),
      sa('DUTY', [duty('MON', H(9), H(10))]),
    ] };
    const list = rankCandidates({ model, me, piece: slot, dateKey: '2026-10-19', absent: {}, load: {} });
    expect(list.map((c) => c.name)).toEqual(['DUTY', 'OFF', 'CLASS']);
    expect(list.map((c) => c.ot)).toEqual([false, true, false]);
    expect(list[2].conflicts).toHaveLength(1);
  });
  it('avoids a name when somebody else is available, and returns null when nobody on duty is', () => {
    const model = { sas: [sa('ME'), sa('A', [duty('MON', H(9), H(10))]), sa('B', [duty('MON', H(9), H(10))])] };
    const args = { model, me, slot, dateKey: '2026-10-19', absent: {}, load: {} };
    expect(pickReliever({ ...args, avoid: new Set(['A']) })).toBe('B');
    expect(pickReliever({ ...args, absent: { '2026-10-19|A': 'leave', '2026-10-19|B': 'leave' } })).toBeNull();
  });
});

describe('coverageByLab', () => {
  it('shows, per room, the ranges of a duty shift that need a reliever', () => {
    const out = coverageByLab(
      [duty('MON', H(7), H(15)), duty('TUE', H(7), H(9))],
      [lab('5501', 'MON', H(7), H(12)), lab('5502', 'MON', H(13), H(18)), lab('5501', 'TUE', H(10), H(12))],
      'MON',
    );
    expect(out).toEqual([
      { lab: '5501', ranges: [{ start: H(7), end: H(12) }] },
      { lab: '5502', ranges: [{ start: H(13), end: H(15) }] },
    ]);
  });
  it('is empty when no room is open during the duty', () => {
    expect(coverageByLab([duty('TUE', H(7), H(9))], [lab('5501', 'TUE', H(10), H(12))], 'TUE')).toEqual([]);
  });
});

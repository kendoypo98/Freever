import { describe, it, expect } from 'vitest';
import { previewRows, coverageByPerson } from './messagePreview.js';

const text = "@Frankyz's Temporary Relievers for Monday\n\n(1107)\n7:00am - 9:00am — @Angelica\n9:00am - 10:00am — @Marianne (OT)\n10:00am - 11:00am — TBD";

describe('previewRows', () => {
  it('recognises the title, the room, and each time row with who covers it', () => {
    const rows = previewRows(text);
    expect(rows[0]).toMatchObject({ type: 'title' });
    expect(rows.find((r) => r.type === 'room')).toMatchObject({ label: '1107' });
    const slots = rows.filter((r) => r.type === 'slot');
    expect(slots[0]).toMatchObject({ from: '7:00am', to: '9:00am', who: '@Angelica', mention: true, ot: false });
    expect(slots[1]).toMatchObject({ who: '@Marianne', ot: true });
    expect(slots[2]).toMatchObject({ empty: true });
  });
  it('shows anything else as plain text, so edited messages still preview', () => {
    expect(previewRows('Hello team').map((r) => r.type)).toEqual(['title']);
    expect(previewRows('A\nthanks!').map((r) => r.type)).toEqual(['title', 'text']);
  });
});

describe('coverageByPerson', () => {
  it('adds up minutes per person', () => {
    const pieces = [{ s: 1, start: 0, end: 60 }, { s: 2, start: 60, end: 180 }, { s: 3, start: 180, end: 240 }];
    const asg = { 1: 'ANA', 2: 'ANA', 3: null };
    expect(coverageByPerson(pieces, asg, (p) => p.s)).toEqual([{ name: 'ANA', mins: 180 }]);
  });
});

import { describe, it, expect } from 'vitest';
import { signature, normalizeModel } from './schedule.js';

const sa = (name, shifts) => ({ name, shifts });
const sh = (day, start, end, type = 'duty') => ({ day, start, end, type });

describe('signature', () => {
  it('is equal for the same schedule and different when two partners are swapped', () => {
    const a = normalizeModel({ sas: [sa('Ana', [sh('MON', 420, 840)]), sa('Ben', [sh('MON', 720, 1320)])] });
    const same = normalizeModel({ sas: [sa('BEN', [sh('MON', 720, 1320)]), sa('ana', [sh('MON', 420, 840)])] });
    const swapped = normalizeModel({ sas: [sa('Ana', [sh('MON', 720, 1320)]), sa('Ben', [sh('MON', 420, 840)])] });
    expect(signature(same)).toBe(signature(a));
    expect(signature(swapped)).not.toBe(signature(a));
  });
});

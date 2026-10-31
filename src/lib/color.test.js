import { describe, it, expect } from 'vitest';
import { contrast, hex, onColor, readableOn } from './color.js';

describe('colour helpers', () => {
  it('picks dark text on light accents and white on dark ones', () => {
    expect(onColor('#eab308')).toBe('#111827'); // yellow
    expect(onColor('#2563eb')).toBe('#ffffff'); // the default blue
  });
  it('makes any accent readable as text on its surface, in light and dark', () => {
    for (const accent of ['#2563eb', '#eab308', '#15803d', '#e11d48', '#9333ea', '#475569']) {
      for (const surface of ['#ffffff', '#131c2e']) {
        expect(contrast(hex(readableOn(accent, surface)), hex(surface))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('leaves an accent alone when it already reads well', () => {
    expect(readableOn('#1e3a8a', '#ffffff')).toBe('#1e3a8a');
  });
});

import { describe, it, expect } from 'vitest';
import { isNear } from './parseSheet.js';

describe('isNear (cell colour matching)', () => {
  const YELLOW = [255, 255, 0];
  const BLUE = [0, 112, 192];
  it('accepts the exact colours with or without the alpha prefix', () => {
    expect(isNear('FFFF00', YELLOW)).toBe(true);
    expect(isNear('FFFFFF00', YELLOW)).toBe(true);
    expect(isNear('0070C0', BLUE)).toBe(true);
  });
  it('accepts slightly different shades', () => {
    expect(isNear('FFFF33', YELLOW)).toBe(true);
    expect(isNear('0A74C4', BLUE)).toBe(true);
  });
  it('rejects white, other colours and garbage', () => {
    expect(isNear('FFFFFF', YELLOW)).toBe(false);
    expect(isNear('00B050', BLUE)).toBe(false);
    expect(isNear('', YELLOW)).toBe(false);
    expect(isNear(undefined, YELLOW)).toBe(false);
  });
});

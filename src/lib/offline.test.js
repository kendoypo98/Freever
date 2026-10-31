import { describe, it, expect } from 'vitest';
import { isNetworkError } from './offline.js';

describe('isNetworkError', () => {
  it('recognises unreachable-network failures', () => {
    expect(isNetworkError(new Error('TypeError: Failed to fetch'), true)).toBe(true);
    expect(isNetworkError(new Error('Could not load the schedule: Load failed'), true)).toBe(true);
    expect(isNetworkError(new Error('anything'), false)).toBe(true); // the browser says it is offline
  });
  it('does not hide real server answers', () => {
    expect(isNetworkError(new Error('permission denied for table schedule_entries'), true)).toBe(false);
    expect(isNetworkError(new Error('Only an admin can change the schedule'), true)).toBe(false);
  });
});

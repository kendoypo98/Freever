import { describe, it, expect } from 'vitest';
import { formatStudentId, validateRegistration } from './validate.js';

const ok = { studentId: '2024-00123', name: 'Juan Dela Cruz', password: 'longenough' };

describe('student ID', () => {
  it('accepts only YYYY-NNNNN', () => {
    expect(validateRegistration(ok)).toBe('');
    for (const bad of ['', '2024-0012', '2024-001234', '24-00123', '202400123', 'ABCD-12345', '1850-00123', '2024-00123 ', '2024-00123-9', 'x'.repeat(200)]) {
      expect(validateRegistration({ ...ok, studentId: bad })).toMatch(/YYYY-NNNNN/);
    }
  });
  it('formats while typing and cannot grow past 10 characters', () => {
    expect(formatStudentId('202400123')).toBe('2024-00123');
    expect(formatStudentId('2024')).toBe('2024');
    expect(formatStudentId('2024-0012399999abc')).toBe('2024-00123');
  });
});

describe('name and password', () => {
  it('rejects empty, numeric and over-long names', () => {
    for (const name of ['', 'ab', 'J0hn Doe', 'a'.repeat(61), '<script>x</script>']) expect(validateRegistration({ ...ok, name })).toMatch(/S\.A name/);
    expect(validateRegistration({ ...ok, name: "Niño O'Brien-Reyes Jr." })).toBe('');
  });
  it('limits password length', () => {
    expect(validateRegistration({ ...ok, password: 'short' })).toMatch(/at least/);
    expect(validateRegistration({ ...ok, password: 'x'.repeat(73) })).toMatch(/at most/);
  });
});

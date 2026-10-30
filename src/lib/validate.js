// Input rules shared by the sign-up form and mirrored in supabase/migrations/006_validation.sql.
export const STUDENT_ID_RE = /^(19|20)\d{2}-\d{5}$/; // YYYY-NNNNN
export const NAME_RE = /^[\p{L} .'’()-]{3,60}$/u;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt ignores everything after 72 bytes

/** Typing helper: keeps digits only and inserts the dash, so "202400123" becomes "2024-00123". */
export function formatStudentId(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 9);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

/** First problem with a new account's fields, or '' when all are fine. */
export function validateRegistration({ studentId, name, password }) {
  if (!STUDENT_ID_RE.test(studentId)) return 'Student ID must be in the format YYYY-NNNNN, for example 2024-00123.';
  if (!NAME_RE.test(name)) return 'S.A name: 3-60 letters. Spaces, dots, dashes, apostrophes and brackets are allowed; no numbers.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password can be at most ${PASSWORD_MAX} characters.`;
  return '';
}

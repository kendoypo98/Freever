import { supabase } from './supabase.js';
import { validateRegistration, PASSWORD_MIN, PASSWORD_MAX } from './validate.js';

const BAD_LOGIN = 'Wrong Student ID / S.A name or password.';

/** Current account {id, name, studentId, role} or null. */
export async function getProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles').select('sa_name, student_id, role').eq('id', session.user.id).maybeSingle();
  if (error) throw new Error(error.message || 'Could not load your profile.'); // a network problem is not a logout
  if (!data) return null;
  return { id: session.user.id, name: data.sa_name, studentId: data.student_id, role: data.role };
}

const REGISTRATION_PROBLEMS = {
  sid_taken: 'That Student ID already has an account. Log in instead.',
  name_taken: 'That S.A name already has an account. Log in instead, or ask the admin to reset your password.',
  setup_code_required: 'This is the first account (the admin). Enter the admin setup code.',
  bad_setup_code: 'That admin setup code is not correct.',
  not_in_schedule: 'That S.A name is not in the schedule. Type it exactly as the admin imported it, or ask the admin to check the schedule.',
  bad_student_id: 'Student ID must be in the format YYYY-NNNNN, for example 2024-00123.',
  bad_name: 'S.A name: 3-60 letters. Spaces, dots, dashes, apostrophes and brackets are allowed; no numbers.',
};

/** True while no account exists yet, so the Create account form should ask for the admin setup code. */
export async function needsSetup() {
  const { data, error } = await supabase.rpc('needs_setup');
  return !error && data === true;
}

export async function register(studentId, saName, password, adminCode = '') {
  const sid = studentId.trim();
  const name = saName.trim().replace(/\s+/g, ' ');
  const problem = validateRegistration({ studentId: sid, name, password });
  if (problem) throw new Error(problem);

  // ask the database first: a failed sign-up trigger only ever comes back as an unexplained 500
  const { data: verdict, error: checkError } = await supabase.rpc('check_registration', {
    student_id: sid, sa_name: name, admin_code: adminCode.trim(),
  });
  if (!checkError && verdict && verdict !== 'ok') throw new Error(REGISTRATION_PROBLEMS[verdict] || 'Could not create the account.');

  // the login e-mail is a random, private identifier; people log in with Student ID or S.A name
  const email = `${crypto.randomUUID()}@freever.app`;
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { student_id: sid, sa_name: name, admin_code: adminCode.trim() } },
  });
  if (error) {
    const m = error.message || '';
    if (/not in the schedule/.test(m)) throw new Error(REGISTRATION_PROBLEMS.not_in_schedule);
    if (/format YYYY-NNNNN/.test(m)) throw new Error(REGISTRATION_PROBLEMS.bad_student_id);
    if (/3-60 letters/.test(m)) throw new Error(REGISTRATION_PROBLEMS.bad_name);
    if (/profiles_student_id_key|student_id/i.test(m)) throw new Error('That Student ID already has an account.');
    if (/setup code/i.test(m)) throw new Error(REGISTRATION_PROBLEMS.bad_setup_code);
    if (/profiles_sa_name_key|sa_name/i.test(m)) throw new Error('That S.A name already has an account.');
    if (/database error/i.test(m)) throw new Error('Could not create the account. Likely causes: that Student ID or S.A name is already registered, or the latest database updates (supabase/migrations, 003 and 004) have not been run.');
    throw new Error(m);
  }
  if (!data.session) throw new Error('Account created but e-mail confirmation is on. Turn it off in Supabase (Auth > Providers > Email).');
  return getProfile();
}

/** identifier = Student ID or S.A name */
export async function login(identifier, password) {
  const { data: email, error: lookupError } = await supabase.rpc('resolve_login', { identifier: identifier.trim() });
  if (lookupError) throw new Error('Could not reach the server. Check your connection and try again.');
  if (!email) throw new Error(BAD_LOGIN);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(/fetch|network/i.test(error.message || '') ? 'Could not reach the server. Check your connection and try again.' : BAD_LOGIN);
  return getProfile();
}

export const logout = () => supabase.auth.signOut();

/** Signed-in user changes their own password. */
export async function changePassword(password) {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) throw new Error(`Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/** Admin sets a temporary password for a student who is locked out. */
export async function resetPasswordFor(target, password) {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) throw new Error(`Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`);
  const { error } = await supabase.rpc('admin_reset_password', { target: target.trim(), new_password: password });
  if (error) throw new Error(error.message);
}

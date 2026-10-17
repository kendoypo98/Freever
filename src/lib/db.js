import { supabase } from './supabase.js';
import { normalizeModel } from './schedule.js';

const PAGE = 1000;

/** The shared schedule as the normalized model, or null if none was saved yet. */
export async function loadSchedule() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('schedule_entries').select('sa_name, team, day, start_min, end_min, type, office')
      .order('id').range(from, from + PAGE - 1);
    if (error) throw new Error('Could not load the schedule: ' + error.message);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  if (!rows.length) return null;
  const { data: meta } = await supabase.from('schedule_meta').select('uploaded_at, first_is_right').maybeSingle();
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.sa_name)) byName.set(r.sa_name, { name: r.sa_name, team: r.team, shifts: [] });
    byName.get(r.sa_name).shifts.push({ day: r.day, start: r.start_min, end: r.end_min, type: r.type, note: r.office });
  }
  return { model: normalizeModel({ sas: [...byName.values()] }), uploadedAt: meta?.uploaded_at ?? null, firstIsRight: meta?.first_is_right ?? true };
}

/** Admin only (enforced in the database): replace the whole schedule atomically. */
export async function saveSchedule(model, firstIsRight) {
  const entries = model.sas.flatMap((s) =>
    s.shifts.map((x) => ({ sa_name: s.name, team: s.team || '', day: x.day, start_min: x.start, end_min: x.end, type: x.type, office: x.note || '' })));
  const { error } = await supabase.rpc('replace_schedule', { entries, first_is_right: firstIsRight });
  if (error) throw new Error(error.message);
}

export async function loadLabs() {
  const { data, error } = await supabase.from('lab_windows').select('lab, day, start_min, end_min').order('id');
  if (error) return []; // table missing (migration 002 not run yet): behave as "no lab schedule"
  return data.map((r) => ({ lab: r.lab, day: r.day, start: r.start_min, end: r.end_min }));
}

/** Admin only: replace all laboratory windows. */
export async function saveLabs(labs) {
  const entries = labs.map((l) => ({ lab: l.lab, day: l.day, start_min: l.start, end_min: l.end }));
  const { error } = await supabase.rpc('replace_labs', { entries });
  if (error) throw new Error(error.message);
}

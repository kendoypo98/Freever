import { supabase } from './supabase.js';
import { normalizeModel, normalizeLabs } from './schedule.js';

// All AI calls go through the "ai" Supabase Edge Function so no API key ever reaches the browser.
async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (error) {
    if (error.name === 'FunctionsFetchError') {
      throw new Error('could not reach the AI function. Deploy the "ai" function with "Verify JWT" turned off (see the README), and check it is in the same Supabase project as this app');
    }
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read file.'));
    r.readAsDataURL(file);
  });
}

/** Screenshot -> { model, warnings } */
export async function extractSchedule(file, firstIsRight) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Use a PNG or JPEG screenshot (PDFs are not supported). Excel is the most accurate.');
  if (file.size > 4 * 1024 * 1024) throw new Error('Image is too large (max 4 MB).');
  const out = await invoke({ action: 'extract', mime: file.type, data: await toBase64(file), firstIsRight });
  return { model: normalizeModel(out), warnings: out.warnings || [] };
}

const DAY_CODE = { MON: 'M', TUE: 'T', WED: 'W', THU: 'H', FRI: 'F', SAT: 'S' };
const hr = (m) => (m % 60 ? (m / 60).toFixed(1) : String(m / 60));

/**
 * Compact text (S1, S2 ... instead of names, so names never leave the browser).
 * Example line: S3 M:D7-15,C9-12 T:D7-13
 */
function compact(model) {
  return model.sas.map((s, i) => {
    const perDay = Object.keys(DAY_CODE).map((d) => {
      const parts = s.shifts.filter((x) => x.day === d).map((x) => `${x.type === 'class' ? 'C' : 'D'}${hr(x.start)}-${hr(x.end)}`);
      return parts.length ? `${DAY_CODE[d]}:${parts.join(',')}` : '';
    }).filter(Boolean);
    return `S${i + 1} ${perDay.join(' ') || 'none'}`;
  }).join('\n');
}

export async function checkSchedule(model) {
  const { warnings } = await invoke({ action: 'check', lines: compact(model) });
  return (warnings || []).map((w) => String(w).replace(/\bS(\d+)\b/g, (m, n) => model.sas[+n - 1]?.name ?? m));
}

/** Laboratory schedule screenshot -> { labs: [{lab, day, start, end}], warnings } (when each lab is open / in use). */
export async function extractLabs(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Use a PNG or JPEG picture of the laboratory schedule.');
  if (file.size > 4 * 1024 * 1024) throw new Error('Image is too large (max 4 MB).');
  const out = await invoke({ action: 'labs', mime: file.type, data: await toBase64(file) });
  return { labs: normalizeLabs(out.labs), warnings: out.warnings || [] };
}

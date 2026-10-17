// @ts-nocheck -- this file runs on Deno (Supabase Edge Functions); the editor checks it as Node and cannot see Deno or npm: imports.
// Supabase Edge Function "ai": keeps the Gemini key on the server.
// Deploy: supabase functions deploy ai      Secret: supabase secrets set GEMINI_API_KEY=...
import { createClient } from 'npm:@supabase/supabase-js@2';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
// Both read pictures and check text. Override with the GEMINI_MODEL secret if Google renames or retires the model.
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const MAX_IMAGE_CHARS = 6_000_000; // base64 of roughly 4.5 MB
const MAX_TEXT_CHARS = 20_000;
const LIMIT_PER_MIN = 12;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function extractPrompt(firstIsRight: boolean) {
  const first = firstIsRight ? 'RIGHT' : 'LEFT';
  const second = firstIsRight ? 'LEFT' : 'RIGHT';
  const example = firstIsRight
    ? `  * Monday RIGHT column is yellow 07:00-15:00 -> AECIEL JOY ABEGONIA (first name), duty MON 07:00-15:00.
  * Monday LEFT column is blue 09:00-12:00 then yellow 12:00-22:00 -> KURT ANDREI TRINIDAD (second name), class MON 09:00-12:00 and duty MON 12:00-22:00.`
    : `  * Monday LEFT column is yellow 07:00-15:00 -> AECIEL JOY ABEGONIA (first name), duty MON 07:00-15:00.
  * Monday RIGHT column is blue 09:00-12:00 then yellow 12:00-22:00 -> KURT ANDREI TRINIDAD (second name), class MON 09:00-12:00 and duty MON 12:00-22:00.`;
  return `You read the weekly Student Assistant (S.A) timetable of a university. Extract the ITO DEPARTMENT ONLY.

HOW THE TIMETABLE IS DRAWN
- The sheet is made of blocks. Each block has a header with ONE or TWO student names (two names are separated by "/").
- Under the header the columns are the days: M (MON), T (TUE), W (WED), TH (THU), F (FRI), Sat (SAT). Every day has TWO narrow sub-columns (if a block has only one name, both sub-columns are that person).
- Rows are 30-minute slots. The first row is 7:00 AM-7:30 AM and the time column on the left shows each slot (it wraps to 1:00 after 12:00).
- COLOURS MATTER:
  * YELLOW cells = the student's DUTY time  -> type "duty".
  * BLUE cells   = the student's CLASS hours -> type "class".
  * WHITE (no colour) = off duty / free, no class. Never output white cells.
  * Ignore the numbers inside cells, the RELIEVER / supervisor / DUTY HOURS notes, watermarks such as "Page 2", the block number and the green header bar.
  * A cell is exactly one colour. The two partners of a block are independent and may be on duty at the same time: report each separately.
- Join consecutive slots of the same colour into one shift (start = first slot start, end = last slot end).

WHICH NAME OWNS WHICH COLUMN (very important)
- In this office the FIRST name in the header owns the ${first} sub-column of every day and the SECOND name owns the ${second} sub-column. Never swap them.
- Worked example, block 1108 "AECIEL JOY ABEGONIA / KURT ANDREI TRINIDAD":
${example}
- Before answering, double-check each person against the column they own.

STRICT RULES
- Only read blocks of the ITO DEPARTMENT. Skip any other department or office (OFFICES, ACADS, PHYSICS, CHEMISTRY, SHS-TVL, TOOLS ROOM ...). If the image does not show the ITO DEPARTMENT, return an empty "sas" list and a warning saying so.
- Days are MON, TUE, WED, THU, FRI, SAT only. Times are 24-hour HH:MM.
- Set "team" to the full header text of the block for every person in it. Keep names exactly as written. Never invent data. If a colour or time is unclear, add a short sentence to "warnings".

Reply with ONLY a JSON object of this exact shape:
{"sas":[{"name":"FULL NAME","team":"HEADER TEXT OF THE BLOCK","shifts":[{"day":"MON","start":"07:00","end":"15:00","type":"duty"}]}],"warnings":["..."]}`;
}

const LAB_PROMPT = `This picture is a LABORATORY SCHEDULE of a university: it shows when each laboratory room is open / in use (class sessions, lab hours).
Extract every period in which a laboratory is in use.
- One entry per lab, per day, per continuous block of time. Join back-to-back sessions of the same lab into one block.
- "lab" is the room/lab name or number exactly as written (empty string if the picture has only one lab and no name).
- Days are MON, TUE, WED, THU, FRI, SAT only. Times are 24-hour HH:MM (convert 1:00 PM to 13:00).
- Ignore teacher names, subject codes and section names; only the room, day and time matter.
- Never invent data. If something is unreadable or ambiguous, add a short sentence to "warnings".
Reply with ONLY a JSON object of this exact shape:
{"labs":[{"lab":"IT LAB 1","day":"MON","start":"07:30","end":"10:30"}],"warnings":["..."]}`;

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function callGemini(key: string, parts: Part[]) {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  let res!: Response;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${GEMINI_URL}/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
    });
    if (res.ok || ![429, 500, 502, 503, 504].includes(res.status) || attempt === 3) break;
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  if (!res.ok) {
    const busy = [429, 500, 502, 503, 504].includes(res.status);
    throw new Error(busy ? 'The AI is busy right now. Please try again in a minute.' : `AI error (${res.status}). Check the Gemini key and the model name (${MODEL}).`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('The AI returned an unreadable answer. Try again.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // only logged-in users (the public anon key alone is not enough)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Please log in.' }, 401);
  // admins only, with a rate limit shared by every function instance (see ai_gate in 003_hardening.sql)
  const { data: gate, error: gateError } = await supabase.rpc('ai_gate', { per_minute: LIMIT_PER_MIN });
  if (gateError) return json({ error: 'AI access is not set up yet. Run 003_hardening.sql in Supabase.' }, 500);
  if (gate === 'forbidden') return json({ error: 'Only the admin can use the AI tools.' }, 403);
  if (gate === 'limited') return json({ error: 'Too many requests. Wait a minute.' }, 429);

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'AI is not configured on the server.' }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  try {
    if (body.action === 'extract') {
      const mime = String(body.mime ?? '');
      const data = String(body.data ?? '');
      if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return json({ error: 'Only PNG, JPEG, WEBP or GIF images.' }, 400);
      if (!data || data.length > MAX_IMAGE_CHARS) return json({ error: 'Image missing or too large (max about 4 MB).' }, 413);
      const out = await callGemini(key, [
        { text: extractPrompt(body.firstIsRight !== false) },
        { inline_data: { mime_type: mime, data } },
      ]);
      return json(out);
    }
    if (body.action === 'labs') {
      const mime = String(body.mime ?? '');
      const data = String(body.data ?? '');
      if (!/^image\/(png|jpeg|webp|gif)$/.test(mime)) return json({ error: 'Only PNG, JPEG, WEBP or GIF images.' }, 400);
      if (!data || data.length > MAX_IMAGE_CHARS) return json({ error: 'Image missing or too large (max about 4 MB).' }, 413);
      const out = await callGemini(key, [
        { text: LAB_PROMPT },
        { inline_data: { mime_type: mime, data } },
      ]);
      const labs = (Array.isArray(out.labs) ? out.labs : []).slice(0, 400).map((l: Record<string, unknown>) => ({
        lab: String(l.lab ?? '').slice(0, 60), day: String(l.day ?? ''), start: String(l.start ?? ''), end: String(l.end ?? ''),
      }));
      return json({ labs, warnings: Array.isArray(out.warnings) ? out.warnings.map(String).slice(0, 8) : [] });
    }
    if (body.action === 'check') {
      const lines = String(body.lines ?? '');
      if (!lines || lines.length > MAX_TEXT_CHARS) return json({ error: 'Schedule text missing or too large.' }, 413);
      const out = await callGemini(key, [{
        text: `Student assistant schedule. D = duty (yellow), C = class (blue), times are 24h hours, days M T W H(Thu) F S(Sat).
` +
          `List only real problems: duty longer than 12h, a student with no duty, a day (M-F) with nobody on duty, duty overlapping the same student's class. ` +
          `Refer to students by their S-number. Max 8 short items. Reply with ONLY JSON: {"warnings":["..."]} (empty list if fine).
${lines}`,
      }]);
      return json({ warnings: Array.isArray(out.warnings) ? out.warnings.map(String).slice(0, 8) : [] });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'AI error.' }, 502);
  }
});

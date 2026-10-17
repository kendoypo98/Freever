import { DAY_NAMES, DAYS, fmtShort, niceName } from './schedule.js';
import { pieceKey, isOvertime } from './reliever.js';

export const DEFAULT_TEMPLATE = {
  title: "@{me}'s Temporary Relievers for {day}",
  closing: '',
};

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Names used in @mentions: first name, plus the last initial when two people would share a first name. */
export function mentionNames(fullNames) {
  const unique = [...new Set(fullNames.filter(Boolean))];
  // initials such as "LJ" stay upper case
  const word = (w) => (w.length <= 2 ? w.toUpperCase() : w);
  const first = (n) => word(niceName(n).split(/\s+/)[0]);
  const count = {};
  unique.forEach((n) => { count[first(n)] = (count[first(n)] || 0) + 1; });
  const out = {};
  unique.forEach((n) => {
    const parts = niceName(n).split(/\s+/);
    out[n] = count[first(n)] > 1 && parts.length > 1 ? `${first(n)} ${parts[parts.length - 1][0]}.` : first(n);
  });
  return out;
}

/**
 * The Messenger post: a title per day, then each laboratory room with hourly "7:00am - 8:00am — @Name" lines.
 * Back-to-back hours with the same person are joined into one line.
 */
export function buildMessage({ me, pieces, assignments, dates, tpl, use24, model, today = isoOf(new Date()) }) {
  const t = { ...DEFAULT_TEMPLATE, ...tpl };
  const people = (model?.sas || []);
  const nameOf = mentionNames([me.name, ...pieces.map((p) => assignments[pieceKey(p)])]);
  const lines = [];

  for (const day of DAYS) {
    const dayPieces = pieces.filter((p) => p.day === day);
    if (!dayPieces.length) continue;
    const dayWord = dates[day] && dates[day] === today ? 'Today' : DAY_NAMES[day];
    if (lines.length) lines.push('');
    lines.push(t.title.replace('{me}', t.signature || nameOf[me.name]).replace('{day}', dayWord));

    const labs = [...new Set(dayPieces.map((p) => p.lab))];
    for (const lab of labs) {
      lines.push('', `(${lab})`);
      const rows = [];
      for (const p of dayPieces.filter((x) => x.lab === lab)) {
        const who = assignments[pieceKey(p)] || null;
        const ot = !!who && isOvertime(people.find((s) => s.name === who) || { shifts: [] }, p);
        const last = rows[rows.length - 1];
        if (last && last.who === who && last.ot === ot && last.end === p.start) last.end = p.end;
        else rows.push({ start: p.start, end: p.end, who, ot });
      }
      for (const r of rows) {
        const mention = r.who ? `@${nameOf[r.who]}${r.ot ? ' (OT)' : ''}` : 'TBD';
        lines.push(`${fmtShort(r.start, use24)} - ${fmtShort(r.end, use24)} — ${mention}`);
      }
    }
  }
  if (t.closing) lines.push('', t.closing);
  return lines.join('\n');
}

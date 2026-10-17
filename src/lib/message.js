import { DAY_NAMES, DAYS, fmtRange, niceName } from './schedule.js';
import { pieceKey } from './reliever.js';

export const DEFAULT_TEMPLATE = {
  greeting: 'Good day!',
  intro: 'I would like to request a reliever for my scheduled duty as a Student Assistant:',
  closing: 'Thank you very much for your help and understanding. Kindly confirm if you are available.',
  signature: '',
};

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function buildMessage({ me, pieces, assignments, dates, tpl, use24 }) {
  const t = { ...DEFAULT_TEMPLATE, ...tpl };
  const lines = [t.greeting, '', t.intro, ''];
  for (const day of DAYS) {
    const dayPieces = pieces.filter((p) => p.day === day);
    if (!dayPieces.length) continue;
    const date = dates[day] ? ` (${formatDate(dates[day])})` : '';
    lines.push(`${DAY_NAMES[day]}${date}`);
    for (const p of dayPieces) {
      const rel = niceName(assignments[pieceKey(p)]) || 'TBD';
      lines.push(`• ${fmtRange(p.start, p.end, use24)} — Reliever: ${rel}`);
    }
    lines.push('');
  }
  lines.push(t.closing, '', `— ${t.signature || niceName(me.name)}`);
  return lines.join('\n');
}

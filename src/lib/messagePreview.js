// Turns the plain message text into rows the chat preview can draw. It works on the text itself (not on the data),
// so the preview always matches what the person has edited.
const TIME = /^(\S+)\s+-\s+(\S+)\s+[—-]\s+(.+)$/; // "7:00am - 8:00am — @Ana (OT)"

export function previewRows(text) {
  const rows = [];
  let titled = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) { rows.push({ type: 'gap' }); continue; }
    let m = /^\((.+)\)$/.exec(line);
    if (m) { rows.push({ type: 'room', label: m[1] }); continue; }
    m = TIME.exec(line);
    if (m) {
      const who = m[3].trim();
      const ot = /\(OT\)\s*$/.test(who);
      const mention = /^@/.test(who) ? who.replace(/\s*\(OT\)\s*$/, '') : '';
      rows.push({ type: 'slot', from: m[1], to: m[2], who: mention || who, mention: !!mention, empty: /^TBD$/i.test(who), ot });
      continue;
    }
    rows.push({ type: !titled ? 'title' : 'text', text: line });
    titled = true;
  }
  return rows;
}

/** Hours covered per person: [{ name, mins }] biggest first. */
export function coverageByPerson(pieces, assignments, keyOf) {
  const by = new Map();
  for (const p of pieces) {
    const n = assignments[keyOf(p)];
    if (n) by.set(n, (by.get(n) || 0) + p.end - p.start);
  }
  return [...by].map(([name, mins]) => ({ name, mins })).sort((a, b) => b.mins - a.mins || a.name.localeCompare(b.name));
}

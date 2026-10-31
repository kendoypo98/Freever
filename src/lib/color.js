// Colour helpers so the interface stays readable whatever accent a theme or a person picks.
export const hex = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const toHex = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Text colour for something painted in `accentHex` (white or near-black, whichever reads better). */
export function onColor(accentHex) {
  const a = hex(accentHex);
  if (!a) return '#ffffff';
  return contrast(a, [255, 255, 255]) >= contrast(a, [17, 24, 39]) ? '#ffffff' : '#111827';
}

/** The accent, moved only as far toward black (light surface) or white (dark surface) as needed to reach `min`:1 contrast as text. */
export function readableOn(accentHex, surfaceHex, min = 4.5) {
  const a = hex(accentHex);
  const s = hex(surfaceHex);
  if (!a || !s) return accentHex;
  const toward = luminance(s) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(a, toward, Math.min(1, t));
    if (contrast(c, s) >= min) return toHex(c);
  }
  return toHex(toward);
}

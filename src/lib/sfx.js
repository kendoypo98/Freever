// Small synthesized sound effects (Web Audio): no sound files, nothing to download.
// Quiet by design: on at a low volume, switchable in Settings. With no seasonal scene the sounds are soft sine "glass" ticks
// (short, low-passed, no loops); a seasonal scene keeps its own playful wave shape.
const WAVES = { pixel: 'square', valentine: 'sine', christmas: 'triangle', halloween: 'sawtooth', '': 'sine' };
let ctx = null;
let on = false;
let volume = 0.4;

export function setSfx(enabled, vol) {
  on = !!enabled;
  volume = Math.min(1, Math.max(0, Number(vol) || 0));
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, at, dur, gain = 1, slideTo = 0) {
  const a = audio();
  if (!a) return;
  const wave = WAVES[document.documentElement.dataset.scene || ''] || 'sine';
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur); // a tiny pitch drop makes a tick feel like a tap
  const peak = Math.max(0.0002, volume * 0.25 * gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = a.createBiquadFilter(); // round off the top so nothing is shrill
  lp.type = 'lowpass';
  lp.frequency.value = 6500;
  osc.connect(g).connect(lp).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

const play = (fn) => { if (on && volume > 0) { try { fn(); } catch { /* audio is optional */ } } };

const xmas = () => document.documentElement.dataset.scene === 'christmas';
const plain = () => !document.documentElement.dataset.scene; // no seasonal scene: the quiet professional set
let lastHover = 0;
// the first bars of "Jingle Bells" (E E E, E E E, E G C D E)
const JINGLE = [[659, 0, 0.12], [659, 0.15, 0.12], [659, 0.3, 0.26], [659, 0.6, 0.12], [659, 0.75, 0.12], [659, 0.9, 0.26], [659, 1.2, 0.12], [784, 1.35, 0.12], [523, 1.5, 0.18], [587, 1.7, 0.12], [659, 1.85, 0.4]];

export const sfx = {
  click: () => play(() => {
    if (plain()) { tone(760, 0, 0.055, 0.55, 520); tone(1520, 0, 0.03, 0.12); return; } // a soft tap
    return xmas() ? (tone(1568, 0, 0.07, 0.7), tone(2093, 0.02, 0.1, 0.35)) : tone(660, 0, 0.06, 0.6);
  }),
  // hovering a control: barely there, and never more often than every 45 ms
  hover: () => play(() => {
    const now = performance.now();
    if (now - lastHover < 45) return;
    lastHover = now;
    tone(plain() ? 2300 : 1100, 0, 0.022, 0.1);
  }),
  step: () => play(() => { if (plain()) { tone(560, 0, 0.06, 0.5, 460); tone(840, 0.06, 0.08, 0.4); return; } tone(440, 0, 0.07); tone(660, 0.07, 0.09); }),
  ready: () => play(() => { if (plain()) { tone(523, 0, 0.16, 0.5); tone(784, 0.08, 0.26, 0.5); } else if (xmas()) { tone(1047, 0, 0.1); tone(1319, 0.1, 0.1); tone(1568, 0.2, 0.2); } else { tone(392, 0, 0.09); tone(523, 0.09, 0.09); tone(659, 0.18, 0.14); } }),
  success: () => play(() => { if (plain()) { tone(659, 0, 0.22, 0.6); tone(988, 0.1, 0.4, 0.55); tone(1319, 0.1, 0.4, 0.15); } else if (xmas()) JINGLE.forEach(([f, at, d]) => tone(f, at, d)); else [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14)); }),
  error: () => play(() => { if (plain()) { tone(220, 0, 0.18, 0.6, 170); tone(165, 0.12, 0.24, 0.5, 130); return; } tone(220, 0, 0.14); tone(165, 0.14, 0.22); }),
};

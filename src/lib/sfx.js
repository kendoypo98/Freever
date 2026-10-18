// Small synthesized sound effects (Web Audio): no sound files, nothing to download.
// Off by default; turned on in Settings. The wave shape follows the background scene.
const WAVES = { pixel: 'square', valentine: 'sine', christmas: 'triangle', halloween: 'sawtooth', '': 'square' };
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

function tone(freq, at, dur, gain = 1) {
  const a = audio();
  if (!a) return;
  const wave = WAVES[document.documentElement.dataset.scene || ''] || 'square';
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  const peak = Math.max(0.0002, volume * 0.25 * gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

const play = (fn) => { if (on && volume > 0) { try { fn(); } catch { /* audio is optional */ } } };

export const sfx = {
  click: () => play(() => tone(660, 0, 0.06, 0.6)),
  step: () => play(() => { tone(440, 0, 0.07); tone(660, 0.07, 0.09); }),
  ready: () => play(() => { tone(392, 0, 0.09); tone(523, 0.09, 0.09); tone(659, 0.18, 0.14); }),
  success: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14)); }),
  error: () => play(() => { tone(220, 0, 0.14); tone(165, 0.14, 0.22); }),
};

// A short confetti burst for small rewards (message copied, reliever list ready).
// Skipped when the game style is off or the person prefers reduced motion.
const COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#a855f7', '#ef4444'];
const rand = (min, max) => min + Math.random() * (max - min);

export function burst(count = 56) {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.fun !== '1') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${rand(0, 100)}%`;
    bit.style.background = COLORS[i % COLORS.length];
    bit.style.setProperty('--dx', `${rand(-18, 18)}vw`);
    bit.style.setProperty('--r', `${rand(180, 900)}deg`);
    bit.style.setProperty('--d', `${rand(1.4, 2.6)}s`);
    bit.style.setProperty('--delay', `${rand(0, 0.35)}s`);
    layer.appendChild(bit);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

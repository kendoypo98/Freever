// Pointer effects, written straight to CSS variables so nothing re-renders: card spotlight, game-card tilt, magnetic button.
const hasMouse = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function installFx(app) {
  app.directive('magnet', {
    mounted(el) {
      if (!hasMouse() || still()) return;
      el.classList.add('magnet');
      const move = (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--tx', `${((e.clientX - (r.left + r.width / 2)) * 0.16).toFixed(1)}px`);
        el.style.setProperty('--ty', `${((e.clientY - (r.top + r.height / 2)) * 0.26).toFixed(1)}px`);
      };
      const leave = () => { el.style.removeProperty('--tx'); el.style.removeProperty('--ty'); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      el._fx = { move, leave };
    },
    unmounted(el) {
      if (!el._fx) return;
      el.removeEventListener('pointermove', el._fx.move);
      el.removeEventListener('pointerleave', el._fx.leave);
    },
  });

  if (!hasMouse() || still()) return;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.t-card, .t-link');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
    const rc = e.target.closest?.('.rcard');
    if (rc) {
      const r = rc.getBoundingClientRect();
      rc.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(2)}deg`);
      rc.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 12).toFixed(2)}deg`);
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const rc = e.target.closest?.('.rcard');
    if (rc && !rc.contains(e.relatedTarget)) { rc.style.removeProperty('--rx'); rc.style.removeProperty('--ry'); }
  }, { passive: true });
}

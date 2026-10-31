import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import './premium.css';
import { installSpriteVars } from './lib/sprites.js';
import { installFx } from './lib/fx.js';

installSpriteVars();
const app = createApp(App);
installFx(app);
app.mount('#root');

// installable app + offline shell (production builds only; the dev server must never be cached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(() => navigator.serviceWorker.ready).then((reg) => {
      const own = performance.getEntriesByType('resource').map((r) => r.name).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ precache: [location.href, ...own] });
    }).catch(() => {});
  });
}

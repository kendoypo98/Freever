import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// Content-Security-Policy is added to the production build only (the dev server needs inline scripts).
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'";
const cspPlugin = {
  name: 'freever-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">`),
};

// base './' keeps asset paths relative so it works on GitHub Pages sub-paths, Netlify, Cloudflare Pages.
export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss(), cspPlugin],
});

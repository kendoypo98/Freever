// FreeVer service worker: keeps the app shell available offline. Data is never cached here.
const CACHE = 'freever-shell-v1';
const SHELL = ['./', 'favicon.svg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { // the page lists its own files once, so offline works after the first visit
  if (e.data?.precache) e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.precache.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase and fonts go straight to the network
  if (request.mode === 'navigate') { // always try for the newest page, fall back to the cached one when offline
    e.respondWith(fetch(request).then((r) => { caches.open(CACHE).then((c) => c.put('./', r.clone())); return r; }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((r) => {
    if (r.ok && url.pathname.includes('/assets/')) caches.open(CACHE).then((c) => c.put(request, r.clone())); // hashed build files never change
    return r;
  })));
});

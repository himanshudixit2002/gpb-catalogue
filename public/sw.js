/* Catalogue Maker – optional offline support.
 * Upload this file next to the app's HTML file on your website (same folder).
 * The app then opens without internet once it has been opened online one time.
 * Your products are not stored here; they stay inside the phone's browser storage.
 */
const CACHE = 'catalogue-maker-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // App page: network first (so updates arrive), cached copy when offline
  if (req.mode === 'navigate' || (url.origin === location.origin && /\.html?$/.test(url.pathname))) {
    // Only a good response replaces the saved copy, so a brief server error never breaks offline use.
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; } return caches.match(req).then(r => r || res); }).catch(() => caches.match(req).then(r => r || caches.match(url.pathname))));
    return;
  }
  // AI library and model files from the CDN: cache first (they never change for a version)
  if (/cdn\.jsdelivr\.net|staticimgly\.com|esm\.sh/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
  }
});

/* Service worker: makes Kashuv an installable app that also opens offline.
   It lives in the project root so it controls the whole site, locally and on GitHub Pages. */
const VERSION = 'kashuv-v4';
const SHELL = ['./', 'static/style.css', 'static/app.js', 'static/plus.js', 'static/a11y.js', 'static/logo.svg', 'static/noya-app.js',
  'static/faq.js', 'static/manifest.webmanifest', 'static/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const save = (req, res) => { if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {}); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // never cache the API or recordings (audio is streamed in ranges)
  if (req.method !== 'GET' || url.origin !== location.origin || /\/(api|media)\//.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    // pages: fresh from the network, cached copy when offline
    e.respondWith(fetch(req).then((res) => save(req, res)).catch(() => caches.match(req).then((r) => r || caches.match(SHELL[0]))));
    return;
  }
  // files: fresh from the network so updates show right away, cached copy when offline
  e.respondWith(fetch(req).then((res) => save(req, res)).catch(() => caches.match(req)));
});

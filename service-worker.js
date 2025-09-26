// service-worker.js
// Works at "/" (local) and "/<repo>/" (GitHub Pages). No edits needed.
// Bump APP_VERSION whenever you change the app shell.
const APP_VERSION = 'ndpwj-v1.3.0';

// Detect base path from the service worker scope, e.g. "/NiceDay/" on GH Pages.
const BASE = new URL('./', self.registration.scope).pathname.replace(/\/+$/, '/') || '/';

// Build cache name unique to this base path (prevents clashes if you host multiple apps).
const CACHE_NAME = `ndpwj:${APP_VERSION}:${BASE}`;

// Files to cache for offline (app shell)
const APP_SHELL = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}dist/styles.css`,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/maskable-192.png`,
  `${BASE}icons/maskable-512.png`,
];

// --- Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// --- Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(`ndpwj:${APP_VERSION}:`)) // delete older versions
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch: network-first for navigations, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Handle SPA/doc navigations
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          return await fetch(req);
        } catch {
          // Fallback to cached index.html
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(`${BASE}index.html`)) || Response.error();
        }
      })()
    );
    return;
  }

  // For other requests: cache-first with background update
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          // Only cache successful same-origin / opaque responses
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'opaque')) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      return cached || fetchPromise || Response.error();
    })()
  );
});

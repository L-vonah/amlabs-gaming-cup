const CACHE = 'amlabs-v1';
const STATIC = [
  '/',
  '/index.html',
  '/campeonato.html',
  '/css/style.css',
  '/js/app.js',
  '/js/state.js',
  '/js/actions.js',
  '/js/renderers.js',
  '/js/renderers-matches.js',
  '/js/ui.js',
  '/js/firestore-service.js',
  '/assets/icon.svg',
  '/assets/logo-amlabs.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Firestore/Firebase requests always go to network
  if (e.request.url.includes('firestore') || e.request.url.includes('firebase')) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

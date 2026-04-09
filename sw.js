const STATIC_CACHE = 'amlabs-static-v2';
const FONT_CACHE = 'amlabs-fonts-v2';
const FIREBASE_SDK_CACHE = 'amlabs-firebase-sdk-v2';

const APP_SHELL = [
  '',
  'index.html',
  'campeonato.html',
  'manifest.json',
  'css/style.css',
  'js/env.js',
  'js/firebase-config.js',
  'js/game-types.js',
  'js/auth.js',
  'js/firestore-service.js',
  'js/state.js',
  'js/ui.js',
  'js/playoff-formats.js',
  'js/renderers-home.js',
  'js/renderers-matches.js',
  'js/renderers.js',
  'js/actions.js',
  'js/app.js',
  'js/portal.js',
  'assets/icon.svg',
  'assets/logo-amlabs.png'
];

function buildScopedUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function isFirebaseApiRequest(url) {
  return [
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebaseinstallations.googleapis.com'
  ].includes(url.hostname);
}

function isRuntimeAsset(url) {
  return url.hostname === 'fonts.googleapis.com'
    || url.hostname === 'fonts.gstatic.com'
    || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
}

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(APP_SHELL.map(buildScopedUrl));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, FONT_CACHE, FIREBASE_SDK_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (isFirebaseApiRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (isRuntimeAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, FIREBASE_SDK_CACHE));
  }
});

// SuiteRhythm Service Worker
const CACHE_NAME = 'SuiteRhythm-v30'; // Bumped: cooperative update flow (no forced navigate)
const UPDATE_MESSAGE = 'SR_SW_UPDATE_AVAILABLE';

// Note: Sound files are served via /r2-audio/* proxy (Cloudflare R2) and NOT cached here
// because they are:
// 1. Too large (~100MB total) for browser cache
// 2. Cross-origin resources with CORS complexity
// 3. Better served fresh from CDN/backend
// Audio files are streamed on-demand with Howler.js html5 mode

const urlsToCache = [
  '/',
  '/manifest.json',
  '/saved-sounds.json',
  '/stories.json',
  '/icon.svg',
  '/favicon.svg'
];

function shouldBypassCache(request, url) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  return url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/r2-audio/') ||
    url.pathname.startsWith('/sounds/');
}

function isLegacySavedSoundsPath(url) {
  return url.origin === self.location.origin &&
    (url.pathname.startsWith('/Saved%20sounds/') || url.pathname.startsWith('/Saved sounds/'));
}

function buildR2AudioProxyUrl(url) {
  const proxyPath = url.pathname.replace(/^\/Saved(?:%20| )sounds\//i, '/r2-audio/sounds/');
  return `${url.origin}${proxyPath}${url.search}`;
}

function isStaticAsset(url) {
  return /\.(?:js|css|json|svg|png|jpg|jpeg|webp|gif|ico|woff2?)$/i.test(url.pathname);
}

// Install event - cache core files
self.addEventListener('install', (event) => {
  // Immediately take over on next load so updates don't sit in "waiting"
  // and serve stale code across hard reloads.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.info(`SW: Opened cache ${CACHE_NAME}`);
        // Cache files individually so a single 404 does not abort the whole install
        return Promise.all(
          urlsToCache.map(url =>
            cache.add(url).catch(err => console.warn(`SW: Failed to cache ${url}:`, err.message))
          )
        );
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (isLegacySavedSoundsPath(url)) {
    event.respondWith(fetch(buildR2AudioProxyUrl(url)));
    return;
  }

  if (shouldBypassCache(event.request, url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle legacy icon paths from older manifests to avoid 404 noise
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('/icon-192.png') || url.pathname.endsWith('/icon-512.png') ||
     url.pathname.endsWith('icon-192.png') || url.pathname.endsWith('icon-512.png'))
  ) {
    // Return a tiny valid transparent PNG to satisfy the request
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8W8z8AAAAASUVORK5CYII=';
    event.respondWith(fetch(tinyPng));
    return;
  }

  // Use network-first for app shell files (HTML, JS, CSS) and navigation requests
  // so deploys do not keep serving stale chunks while online.
  const isAppShell = url.origin === self.location.origin && 
    (event.request.mode === 'navigate' ||
     url.pathname.endsWith('.html') || url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') || url.pathname === '/' || url.pathname.endsWith('/'));
  
  if (isAppShell) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(event.request);
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'default')
        ) {
          const clone = networkResponse.clone();
          // Ensure the SW does not die before the cache write completes.
          event.waitUntil(cache.put(event.request, clone).catch(() => {}));
        }
        return networkResponse;
      } catch (_) {
        const cached = await cache.match(event.request);
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (
        response &&
        response.status === 200 &&
        response.type === 'basic' &&
        url.origin === self.location.origin &&
        isStaticAsset(url)
      ) {
        const cache = await caches.open(CACHE_NAME);
        const clone = response.clone();
        event.waitUntil(cache.put(event.request, clone).catch(() => {}));
      }
      return response;
    } catch (_) {
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});

// Activate event - cleanup old caches and notify open clients cooperatively
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => cacheWhitelist.indexOf(name) === -1)
        .map((name) => caches.delete(name))
    );
    // Take control of uncontrolled clients right away so the new SW
    // serves the next fetch (including the page the user is on).
    await self.clients.claim();
    // Cooperative update: notify open tabs so the page can decide when to
    // reload (e.g. silently when hidden, or via a non-blocking banner). This
    // replaces the old behavior of force-navigating every tab, which would
    // destroy in-progress recordings, transcripts, and unsaved cues.
    await notifyClientsOfUpdate();
  })());
});

async function notifyClientsOfUpdate() {
  try {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windowClients) {
      try { client.postMessage({ type: UPDATE_MESSAGE, cacheName: CACHE_NAME }); } catch (_) {}
    }
  } catch (_) { /* ignore */ }
}

// Allow the page to force an activation ("reload now") if desired.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// CueAI Service Worker
const CACHE_NAME = 'cueai-v6'; // Bumped for refactor changes

// Note: Backend media files (https://cueai-backend.onrender.com/media/*) are NOT cached here
// because they are:
// 1. Too large (~100MB total) for browser cache
// 2. Cross-origin resources with CORS complexity
// 3. Better served fresh from CDN/backend
// Audio files are streamed on-demand with Howler.js html5 mode

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './api.js', // NEW: Centralized API service layer
  './manifest.json',
  './saved-sounds.json',
  './icon.svg',
  './favicon.svg'
];

// Install event - cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

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

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache URLs from allowed origins
        if (event.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      });
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

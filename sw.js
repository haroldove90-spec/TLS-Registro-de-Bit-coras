const CACHE_NAME = 'tls-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  'https://tritex.com.mx/tlslogo.png',
  'https://tritex.com.mx/tlsicono.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Strategy: Network first, fallback to cache for offline usage
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
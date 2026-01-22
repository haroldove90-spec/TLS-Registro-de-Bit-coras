
/* Service Worker for TLS App */
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

// 1. Handle incoming PUSH events (From a Push Server - Simulated here)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  showNotification(data.title || 'TLS Notificación', data.body || 'Actualización de viaje');
});

// 2. Handle MESSAGES from the Main Thread (Client-side Notification delegation)
// This is critical for reliable "background" notifications triggered by the app logic itself
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NOTIFY') {
    const { title, body } = event.data;
    showNotification(title, body);
  }
});

function showNotification(title, body) {
  const options = {
    body: body,
    icon: 'https://cdn-icons-png.flaticon.com/512/759/759988.png', // Truck Icon
    badge: 'https://cdn-icons-png.flaticon.com/512/759/759988.png',
    vibrate: [500, 250, 500, 250, 500], // High Priority Pattern
    tag: 'tls-alert', // Stack notifications or replace?
    renotify: true, // Vibrate again even if tag is same
    requireInteraction: true, // Keeps notification on screen until interacted
    data: {
      url: '/'
    }
  };

  self.registration.showNotification(title, options);
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Focus the open window or open a new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Cache Strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

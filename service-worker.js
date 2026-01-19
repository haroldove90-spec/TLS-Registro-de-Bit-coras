/* Service Worker for TLS App */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming push events (Simulated via client for this demo)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'Tienes una nueva actualización en tu ruta.',
    icon: 'https://cdn-icons-png.flaticon.com/512/759/759988.png', // Truck Icon
    badge: 'https://cdn-icons-png.flaticon.com/512/759/759988.png',
    vibrate: [500, 200, 500, 200, 500], // High Priority Vibration Pattern
    tag: 'tls-trip-update',
    renotify: true,
    requireInteraction: true, // Keeps notification on screen until interacted
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TLS Notificación', options)
  );
});

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
      // If no window is open, open one (optional logic for real PWA)
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
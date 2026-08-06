self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
// The game state is server-authoritative, so this service worker deliberately
// does not cache gameplay requests or Socket.IO traffic.

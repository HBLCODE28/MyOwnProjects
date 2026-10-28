'use strict';

const CACHE_NAME = 'sharedcart-shell-v1';
const APP_SHELL = [
  '/index.html',
  '/style.css?v=20261028-1',
  '/app.js?v=20261028-2',
  '/favicon.svg',
  '/img/tabler-icons.svg',
  '/vendor/jquery-3.7.1.min.js?v=3.7.1-full-1',
  '/vendor/qrcode.min.js?v=1.0.0',
  '/vendor/jsQR.js?v=1.4.0'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sharedcart-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.includes('admin')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(response => response || caches.match('/index.html'))));
    return;
  }

  event.respondWith(caches.match(request).then(response => response || fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      const copy = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return networkResponse;
  })));
});

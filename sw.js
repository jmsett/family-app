
const VERSION = 'ad3e2d56b2831ede';
const PREFIX = 'family-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + VERSION;
const FILES = ["assets/HistoryPanel-CRfQuAgT.js","assets/demo-household-Br9aKkI6.js","assets/fancy-canvas-LICENSE.txt","assets/index-DPiUYOzV.js","assets/index-ggG_CPc3.css","assets/lightweight-charts-LICENSE.txt","assets/lightweight-charts-NOTICE.txt","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","manifest.webmanifest"].map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Cache only the built application shell. Never intercept GitHub or private API data.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const assetUrl = new URL(url.href);
  assetUrl.search = '';
  assetUrl.hash = '';
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', self.registration.scope).href, { ignoreVary: true }))));
  } else if (FILES.includes(assetUrl.href)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(assetUrl.href, { ignoreVary: true })) || fetch(request)));
  }
});

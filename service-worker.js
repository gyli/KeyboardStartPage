// Caches site icons from Google's favicon service, so pages don't download
// them again on every new tab and icons still show offline.
// The service doesn't allow CORS, so responses are opaque: the Cache API can
// store and replay them, but nothing can read them. That's all we need.
// The cache name changes every 30 days, which refreshes all icons.

const FAVICON_SERVICE = 'https://www.google.com/s2/favicons';
const CACHE_PREFIX = 'favicons-';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const currentCacheName = () => CACHE_PREFIX + Math.floor(Date.now() / MAX_AGE_MS);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(FAVICON_SERVICE)) {
    event.respondWith(fetchWithCache(event.request));
  }
});

async function fetchWithCache(request) {
  const name = currentCacheName();
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await cache.put(request, response.clone());
  await deleteOldCaches(name);
  return response;
}

async function deleteOldCaches(current) {
  for (const name of await caches.keys()) {
    if (name.startsWith(CACHE_PREFIX) && name !== current) await caches.delete(name);
  }
}

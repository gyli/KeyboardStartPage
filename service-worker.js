// The extension's service worker. It does two things:
// 1. Runs the custom launcher shortcut (see src/launcher.js).
// 2. Caches site icons (below).

// --- Custom launcher shortcut ---
// The launcher script runs on web pages only while a shortcut is set and the
// user has granted the optional access to websites.

const LAUNCHER_SCRIPT = {
  id: 'launcher',
  js: ['src/shortcut-keys.js', 'src/launcher.js'],
  matches: ['<all_urls>'],
  runAt: 'document_start',
};
const ALL_SITES = { origins: ['<all_urls>'] };

async function updateLauncherScript() {
  const { launcherShortcut } = await chrome.storage.sync.get('launcherShortcut');
  const wanted = Boolean(launcherShortcut) && (await chrome.permissions.contains(ALL_SITES));
  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [LAUNCHER_SCRIPT.id] })).length > 0;
  if (wanted && !registered) await chrome.scripting.registerContentScripts([LAUNCHER_SCRIPT]);
  if (!wanted && registered) await chrome.scripting.unregisterContentScripts({ ids: [LAUNCHER_SCRIPT.id] });
}

// Updates run one at a time, so two events in a row can't register the script twice.
let pendingUpdate = Promise.resolve();
function queueLauncherUpdate() {
  pendingUpdate = pendingUpdate.then(updateLauncherScript).catch((error) => console.error(error));
}

chrome.runtime.onInstalled.addListener(queueLauncherUpdate);
chrome.permissions.onAdded.addListener(queueLauncherUpdate);
chrome.permissions.onRemoved.addListener(queueLauncherUpdate);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'launcherShortcut' in changes) queueLauncherUpdate();
});

chrome.runtime.onMessage.addListener((message) => {
  // Fails quietly if the window isn't focused; there's nothing useful to do then.
  if (message?.type === 'open-launcher') chrome.action.openPopup().catch(() => {});
});

// --- Site icon cache ---
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

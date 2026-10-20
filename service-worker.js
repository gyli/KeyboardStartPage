// The extension's service worker. It does two things:
// 1. Runs the prefix shortcuts on web pages (see src/page-shortcuts.js).
// 2. Caches site icons (below).
import { loadSettings } from './src/storage.js';

// --- Prefix shortcuts on web pages ---
// The script runs on web pages only while "Open links from any page" is on
// and the user has granted the optional access to websites.

const PAGE_SCRIPT = {
  id: 'page-shortcuts',
  js: ['src/prefix-shortcut.js', 'src/page-shortcuts.js'],
  matches: ['<all_urls>'],
  runAt: 'document_start',
};
const ALL_SITES = { origins: ['<all_urls>'] };

async function updatePageScript() {
  const { pageShortcuts } = await chrome.storage.sync.get('pageShortcuts');
  const wanted = Boolean(pageShortcuts) && (await chrome.permissions.contains(ALL_SITES));

  // Chrome keeps registered scripts across extension updates. Remove any left by
  // an older version, or registered with a different file list, so they can't
  // run outdated code.
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const isCurrent = (script) => script.id === PAGE_SCRIPT.id && JSON.stringify(script.js) === JSON.stringify(PAGE_SCRIPT.js);
  const stale = scripts.filter((script) => !isCurrent(script) || !wanted);
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale.map((script) => script.id) });
  const registered = scripts.some(isCurrent) && wanted;

  if (wanted && !registered) {
    await chrome.scripting.registerContentScripts([PAGE_SCRIPT]);
    // Registered scripts only run on pages loaded from now on, so add it to open tabs too.
    for (const tab of await chrome.tabs.query({})) {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: PAGE_SCRIPT.js }).catch(() => {
        // Chrome's own pages and the Web Store don't allow scripts.
      });
    }
  }
}

// Updates run one at a time, so two events in a row can't register the script twice.
let pendingUpdate = Promise.resolve();
function queuePageScriptUpdate() {
  pendingUpdate = pendingUpdate.then(updatePageScript).catch((error) => console.error(error));
}

chrome.runtime.onInstalled.addListener(queuePageScriptUpdate);
chrome.permissions.onAdded.addListener(queuePageScriptUpdate);
chrome.permissions.onRemoved.addListener(queuePageScriptUpdate);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'pageShortcuts' in changes) queuePageScriptUpdate();
});

// Opens a key's link from a web page, where the user chose in settings.
// New tabs open next to the page.
async function openKey(key, tab) {
  const settings = await loadSettings();
  const url = settings.links[key];
  if (!url) return;
  switch (settings.prefixOpenMode) {
    case 'same':
      return chrome.tabs.update(tab.id, { url });
    case 'active':
    case 'inactive':
      return chrome.tabs.create({ url, active: settings.prefixOpenMode === 'active', index: tab.index + 1, windowId: tab.windowId });
    case 'window':
      return chrome.windows.create({ url });
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'open-key' && sender.tab) openKey(message.key, sender.tab);
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

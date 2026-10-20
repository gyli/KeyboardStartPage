// Runs on web pages only while "Open links from any page" is on and the user
// has allowed access to websites. When a key with a link is tapped while the
// prefix keys are held, it asks the service worker to open that link.
// It never reads or changes the page. Uses prefix-shortcut.js, injected first.

if (!globalThis.keyboardStartPageShortcuts) {
  globalThis.keyboardStartPageShortcuts = true;

  // A copy of the settings it needs, so it can decide during the keydown event.
  let prefix = null;
  let boundKeys = new Set();

  const update = (items) => {
    prefix = items.pageShortcuts ? items.shortcutPrefix ?? 'Alt' : null;
    boundKeys = new Set(Object.keys(items).filter((name) => name.startsWith('li_')).map((name) => name.slice(3)));
  };
  chrome.storage.sync.get(null).then(update);
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') chrome.storage.sync.get(null).then(update);
  });

  // Listens in the capture phase on window, so pages can't swallow the shortcut first.
  prefixShortcut.listen({
    getPrefix: () => prefix,
    isBound: (key) => boundKeys.has(key),
    onOpen: (key) => chrome.runtime.sendMessage({ type: 'open-key', key }).catch(() => {
      // The extension was updated or removed since this page loaded.
    }),
  });
}

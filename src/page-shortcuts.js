// Runs on web pages only after the user picks a shortcut prefix in settings
// and allows access to websites. On prefix + key (e.g. Alt + G), it asks the
// service worker to open that key's link. It never reads or changes the page.
// Keep modifiersOf() and keyFromCode() in sync with src/keyboard.js.

if (!globalThis.keyboardStartPageShortcuts) {
  globalThis.keyboardStartPageShortcuts = true;

  // A copy of the settings it needs, so it can decide during the keydown event.
  let prefix = null;
  let boundKeys = new Set();

  const update = (items) => {
    prefix = items.shortcutPrefix ?? null;
    boundKeys = new Set(Object.keys(items).filter((name) => name.startsWith('li_')).map((name) => name.slice(3)));
  };
  chrome.storage.sync.get(null).then(update);
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') chrome.storage.sync.get(null).then(update);
  });

  const modifiersOf = (event) =>
    [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean).join('+');

  // Uses the physical key, because Alt/Option changes the typed character on a Mac.
  const keyFromCode = (code) => {
    const match = /^(?:Key([A-Z])|Digit(\d))$/.exec(code);
    return match ? (match[1] ?? match[2]).toLowerCase() : null;
  };

  // Capture phase on window, so pages can't swallow the shortcut first.
  window.addEventListener('keydown', (event) => {
    if (!prefix || event.repeat || modifiersOf(event) !== prefix) return;
    const key = keyFromCode(event.code);
    // Keys without a link are left to the page.
    if (!key || !boundKeys.has(key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    chrome.runtime.sendMessage({ type: 'open-key', key }).catch(() => {
      // The extension was updated or removed since this page loaded.
    });
  }, true);
}

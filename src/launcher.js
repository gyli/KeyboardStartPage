// Runs on web pages only after the user sets a custom launcher shortcut and
// grants access to websites. It listens for that one shortcut and asks the
// service worker to open the popup. It never reads or changes the page.
// Uses shortcutFromEvent() from shortcut-keys.js, which is injected first.

let launcherShortcut = null;

chrome.storage.sync.get('launcherShortcut').then((items) => {
  launcherShortcut = items.launcherShortcut ?? null;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.launcherShortcut) launcherShortcut = changes.launcherShortcut.newValue ?? null;
});

// Capture phase on window, so pages can't swallow the shortcut first.
window.addEventListener('keydown', (event) => {
  if (!launcherShortcut || event.repeat || shortcutFromEvent(event) !== launcherShortcut) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({ type: 'open-launcher' });
}, true);

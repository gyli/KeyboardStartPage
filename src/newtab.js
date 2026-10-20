import { loadSettings, loadWallpaper, onSettingsChanged, onWallpaperChanged, setLink } from './storage.js';
import { createKeyboard, keyFromEvent } from './keyboard.js';
import { createEditor } from './editor.js';
import { openLink } from './open.js';
import { siteName } from './url.js';
import { applyTheme } from './theme.js';

const toast = document.getElementById('toast');
let settings;

// Chrome always focuses the address bar on a new tab page, and nothing on the
// page can take focus back. A tab opened through the tabs API focuses its page
// instead, so we replace this tab with one. Reloading the same tab is not enough.
// The address bar then shows the extension URL, so this is opt-in.
async function maybeTakeFocus() {
  if (!settings.focusPage || location.search.includes('focus')) return false;
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html?focus'), index: tab.index, windowId: tab.windowId });
  await chrome.tabs.remove(tab.id);
  return true;
}

function render() {
  applyTheme(settings);
  document.getElementById('hint').hidden = !settings.showHints;
  document.getElementById('focus-hint').hidden = location.search.includes('focus');
  keyboard.render(settings);
}

function renderWallpaper(dataUrl) {
  const layer = document.getElementById('wallpaper');
  layer.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
  document.body.classList.toggle('has-wallpaper', Boolean(dataUrl));
}

function editKey(key, url) {
  editor.open(key, {
    url: url ?? settings.links[key] ?? '',
    name: settings.names[key] ?? '',
    isBound: Boolean(settings.links[key]),
  });
}

// Dropping a link on an empty key saves it right away. On a key that already
// has a link, the editor opens so the user can confirm the replacement.
async function handleDropUrl(key, url) {
  if (settings.links[key]) {
    editKey(key, url);
  } else {
    await setLink(key, url);
    showToast(`Added ${siteName(url)} to ${key.toUpperCase()}`);
  }
}

function handleKeydown(event) {
  if (editor.isOpen) return;
  const key = keyFromEvent(event);
  if (!key) return;
  event.preventDefault();
  keyboard.flash(key);
  const url = settings.links[key];
  if (url) openLink(url, settings.shortcuts[event.shiftKey ? 'ShiftKey' : 'Key']);
  else showToast(`${key.toUpperCase()} has no link yet. Click the key to add one.`);
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

settings = await loadSettings();
const keyboard = createKeyboard(document.getElementById('keyboard'), {
  onEdit: (key) => editKey(key),
  onDropUrl: handleDropUrl,
});
const editor = createEditor();

if (!(await maybeTakeFocus())) {
  render();
  document.addEventListener('keydown', handleKeydown);
  document.getElementById('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  onSettingsChanged((next) => {
    settings = next;
    render();
  });
  onWallpaperChanged(renderWallpaper);
  renderWallpaper(await loadWallpaper());
}

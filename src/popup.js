// The toolbar popup: the same keyboard, opened from any page with the
// extension's toolbar button. Links open over the current page.
import { loadSettings } from './storage.js';
import { createKeyboard, keyFromEvent } from './keyboard.js';
import { createEditor } from './editor.js';
import { modeForClick, openLink } from './open.js';
import { isWebUrl } from './url.js';
import { applyTheme } from './theme.js';

const settings = await loadSettings();
applyTheme(settings);

// activeTab lets the popup read the current page's URL, to offer it for empty keys.
const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
const pageUrl = activeTab?.url && isWebUrl(activeTab.url) ? activeTab.url : '';

async function go(url, mode) {
  await openLink(url, mode);
  window.close();
}

function editKey(key, url) {
  const isBound = Boolean(settings.links[key]);
  editor.open(key, {
    url: url ?? (isBound ? settings.links[key] : pageUrl),
    name: settings.names[key] ?? '',
    isBound,
  });
}

const keyboard = createKeyboard(document.getElementById('keyboard'), {
  onEdit: (key) => editKey(key),
  onOpen: (key, event) => go(settings.links[key], modeForClick(event)),
  onDropUrl: (key, url) => editKey(key, url),
});
const editor = createEditor();
keyboard.render(settings);

// Show links saved from the popup's own editor.
chrome.storage.onChanged.addListener(async () => {
  Object.assign(settings, await loadSettings());
  keyboard.render(settings);
});

document.addEventListener('keydown', (event) => {
  if (editor.isOpen) return;
  const key = keyFromEvent(event);
  if (!key) return;
  event.preventDefault();
  keyboard.flash(key);
  const url = settings.links[key];
  if (url) go(url, settings.shortcuts[event.shiftKey ? 'ShiftKey' : 'Key']);
  else editKey(key);
});

document.getElementById('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

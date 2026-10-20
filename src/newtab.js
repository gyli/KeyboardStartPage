import { KEY_ROWS, loadSettings, onSettingsChanged, setLink } from './storage.js';
import { faviconUrl, normalizeUrl, siteName } from './url.js';
import { applyTheme } from './theme.js';

const keyboard = document.getElementById('keyboard');
const keyTemplate = document.getElementById('key-template');
const editor = document.getElementById('editor');
const editorKey = document.getElementById('editor-key');
const editorUrl = document.getElementById('editor-url');
const editorError = document.getElementById('editor-error');
const editorRemove = document.getElementById('editor-remove');
const toast = document.getElementById('toast');

const keyElements = new Map();
let settings;

// Chrome always focuses the address bar on a new tab page. Reloading the page
// through the tabs API moves focus to the page, at the cost of showing the
// extension URL in the address bar. It's opt-in for that reason.
async function maybeTakeFocus() {
  if (!settings.focusPage || location.search.includes('focus')) return false;
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('newtab.html?focus') });
  return true;
}

function buildKeyboard() {
  KEY_ROWS.forEach((row, index) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'row';
    rowElement.dataset.row = index;
    for (const key of row) {
      const element = keyTemplate.content.firstElementChild.cloneNode(true);
      element.dataset.key = key;
      element.querySelector('.key-label').textContent = key.toUpperCase();
      keyElements.set(key, element);
      rowElement.append(element);
    }
    keyboard.append(rowElement);
  });
}

function render() {
  applyTheme(settings);
  document.getElementById('hint').hidden = !settings.showHints;
  document.getElementById('focus-hint').hidden = location.search.includes('focus');

  for (const [key, element] of keyElements) {
    const url = settings.links[key];
    const cap = element.querySelector('.key-cap');
    const icon = element.querySelector('.key-icon');
    const iconSrc = url ? faviconUrl(url) : null;

    element.classList.toggle('bound', Boolean(url));
    element.querySelector('.key-site').textContent = url ? siteName(url) : '';
    cap.title = url ?? `Add a link for ${key.toUpperCase()}`;
    cap.setAttribute('aria-label', url ? `${key.toUpperCase()}: ${siteName(url)}` : `${key.toUpperCase()}: add a link`);
    if (icon.getAttribute('src') !== iconSrc) {
      icon.hidden = true;
      if (iconSrc) icon.src = iconSrc;
      else icon.removeAttribute('src');
    }
  }
}

async function openLink(url, mode) {
  const tab = await chrome.tabs.getCurrent();
  switch (mode) {
    case 'same':
      return chrome.tabs.update(tab.id, { url });
    case 'active':
    case 'inactive':
      return chrome.tabs.create({ url, active: mode === 'active', openerTabId: tab.id });
    case 'window':
      return chrome.windows.create({ url });
  }
}

function activate(key, trigger) {
  const element = keyElements.get(key);
  element.classList.add('pressed');
  setTimeout(() => element.classList.remove('pressed'), 150);

  const url = settings.links[key];
  if (url) openLink(url, settings.shortcuts[trigger]);
  else showToast(`${key.toUpperCase()} has no link yet. Click the key to add one.`);
}

function clickTrigger(event) {
  const modifier = event.ctrlKey || event.metaKey;
  if (event.button === 1) return event.shiftKey ? 'ShiftMiddleClick' : 'MiddleClick';
  if (modifier && event.shiftKey) return 'CtrlShiftClick';
  if (modifier) return 'CtrlClick';
  if (event.shiftKey) return 'ShiftClick';
  return 'Click';
}

// Prefer the typed character so non-QWERTY layouts open the key they see printed.
// Fall back to the physical key for layouts without Latin letters, and for Shift + digit.
function keyFromEvent(event) {
  const char = event.key.toLowerCase();
  if (keyElements.has(char)) return char;
  const match = /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code);
  return match ? (match[1] ?? match[2]).toLowerCase() : null;
}

function handleKeyboardClick(event) {
  const element = event.target.closest('.key');
  if (!element) return;
  const { key } = element.dataset;

  if (event.target.closest('.key-edit') || !settings.links[key]) {
    if (event.button === 0) openEditor(key);
    return;
  }
  event.preventDefault();
  activate(key, clickTrigger(event));
}

function handleKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return;
  if (editor.open) return;
  const key = keyFromEvent(event);
  if (!key) return;
  event.preventDefault();
  activate(key, event.shiftKey ? 'ShiftKey' : 'Key');
}

function openEditor(key) {
  editor.dataset.key = key;
  editorKey.textContent = key.toUpperCase();
  editorUrl.value = settings.links[key] ?? '';
  editorError.textContent = '';
  editorRemove.hidden = !settings.links[key];
  editor.showModal();
  editorUrl.select();
}

function handleEditorSubmit(event) {
  if (event.submitter?.value !== 'save') return;
  const url = normalizeUrl(editorUrl.value);
  if (editorUrl.value.trim() && !url) {
    event.preventDefault();
    editorError.textContent = 'That doesn’t look like a web address.';
    return;
  }
  setLink(editor.dataset.key, url);
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
}

settings = await loadSettings();
if (!(await maybeTakeFocus())) {
  buildKeyboard();
  render();

  keyboard.addEventListener('click', handleKeyboardClick);
  keyboard.addEventListener('auxclick', handleKeyboardClick);
  // Stop middle click from starting autoscroll.
  keyboard.addEventListener('mousedown', (event) => event.button === 1 && event.preventDefault());
  // Favicons stay hidden until they load, so a failed request shows nothing instead of a broken image.
  keyboard.addEventListener('load', (event) => { event.target.hidden = false; }, true);
  document.addEventListener('keydown', handleKeydown);

  editor.addEventListener('submit', handleEditorSubmit);
  editorRemove.addEventListener('click', () => {
    setLink(editor.dataset.key, null);
    editor.close();
  });
  document.getElementById('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

  onSettingsChanged((next) => {
    settings = next;
    render();
  });
}

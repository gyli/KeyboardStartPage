import {
  DEFAULT_PREFERENCES, KEYS, OPEN_MODES, TRIGGERS,
  exportBackup, importBackup, loadSettings, loadWallpaper, onSettingsChanged,
  onWallpaperChanged, setLink, setPreference, setShortcut, setWallpaper,
} from './storage.js';
import { faviconUrl } from './url.js';
import { applyTheme } from './theme.js';

const $ = (id) => document.getElementById(id);
const toast = $('toast');

// The color picker needs a hex value, so read the theme background back from the page.
function themeBackgroundHex() {
  const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function buildShortcuts() {
  for (const [trigger, label] of Object.entries(TRIGGERS)) {
    const row = document.createElement('label');
    row.className = 'shortcut';
    row.textContent = label;

    const select = document.createElement('select');
    select.dataset.trigger = trigger;
    for (const [mode, text] of Object.entries(OPEN_MODES)) select.add(new Option(text, mode));
    select.addEventListener('change', () => save(setShortcut(trigger, select.value)));

    row.append(select);
    $('shortcuts').append(row);
  }
}

function renderLinks(links, names) {
  const list = $('links');
  list.replaceChildren();
  const bound = [...KEYS].filter((key) => links[key]);
  if (!bound.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No links yet.';
    list.append(empty);
    return;
  }

  for (const key of bound) {
    const item = document.createElement('li');

    const kbd = document.createElement('kbd');
    kbd.textContent = key.toUpperCase();

    const icon = document.createElement('img');
    icon.alt = '';
    // Invisible until it loads, but it keeps its space so the rows line up.
    icon.style.visibility = 'hidden';
    icon.addEventListener('load', () => { icon.style.visibility = ''; });
    const src = faviconUrl(links[key]);
    if (src) icon.src = src;

    const url = document.createElement('a');
    url.href = links[key];
    url.target = '_blank';
    if (names[key]) {
      const name = document.createElement('strong');
      name.textContent = names[key];
      url.append(name, ' ');
    }
    url.append(links[key]);

    const remove = document.createElement('button');
    remove.className = 'icon-button small';
    remove.type = 'button';
    remove.title = `Remove link for ${key.toUpperCase()}`;
    remove.setAttribute('aria-label', remove.title);
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    remove.addEventListener('click', () => save(setLink(key, null), 'Link removed'));

    item.append(kbd, icon, url, remove);
    list.append(item);
  }
}

function render(settings) {
  applyTheme(settings);
  document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;
  $('bg-color').value = settings.bgColor ?? themeBackgroundHex();
  $('bg-reset').disabled = !settings.bgColor;
  $('show-hints').checked = settings.showHints;
  $('focus-page').checked = settings.focusPage;
  for (const select of document.querySelectorAll('#shortcuts select')) {
    select.value = settings.shortcuts[select.dataset.trigger];
  }
  renderLinks(settings.links, settings.names);
  renderPrefix(settings);
}

let wallpaperUrl;
function renderWallpaper(image) {
  if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = image ? URL.createObjectURL(image) : null;
  $('wallpaper-preview').hidden = !image;
  $('wallpaper-preview').style.backgroundImage = wallpaperUrl ? `url("${wallpaperUrl}")` : '';
  $('wallpaper-remove').disabled = !image;
}

async function chooseWallpaper(file) {
  try {
    // Decoding the image first rejects files Chrome can't display.
    (await createImageBitmap(file)).close();
  } catch {
    showToast('Couldn’t use this image. Try a JPEG, PNG or WebP file.');
    return;
  }
  await save(setWallpaper(file), 'Wallpaper saved');
}

// --- Prefix shortcut on any page ---
// prefixShortcut comes from prefix-shortcut.js.
const ALL_SITES = { origins: ['<all_urls>'] };
const IS_MAC = navigator.platform.startsWith('Mac');
let currentPrefix = DEFAULT_PREFERENCES.shortcutPrefix;
let exampleKey = 'G';
let recording = null; // { pressed, modifiers, keys } while recording

// Keycap labels, e.g. "⌃ Control" on a Mac, like the printed keys.
const KEYCAP_NAMES = IS_MAC ? { Ctrl: '⌃ Control', Alt: '⌥ Option', Shift: '⇧ Shift', Meta: '⌘ Command' } : {};
const keycapLabels = (modifiers, keys) => [
  ...prefixShortcut.MODIFIERS.filter((m) => modifiers.includes(m)).map((m) => KEYCAP_NAMES[m] ?? prefixShortcut.modifierLabel(m, IS_MAC)),
  ...keys.map(prefixShortcut.keyLabel),
];

// Shows labels as keycaps: ⌃ + X + P.
function renderKeycaps(labels) {
  const container = $('prefix-keys');
  container.replaceChildren();
  labels.forEach((label, index) => {
    if (index) container.append(Object.assign(document.createElement('span'), { className: 'plus', textContent: '+' }));
    container.append(Object.assign(document.createElement('kbd'), { textContent: label }));
  });
}

function renderPrefix({ pageShortcuts, shortcutPrefix, prefixOpenMode, links }) {
  $('prefix-open-mode').value = prefixOpenMode;
  currentPrefix = prefixShortcut.parse(shortcutPrefix) ? shortcutPrefix : DEFAULT_PREFERENCES.shortcutPrefix;
  exampleKey = ([...KEYS].find((key) => links[key]) ?? 'g').toUpperCase();
  renderPageShortcutsSwitch(pageShortcuts);
  if (recording) return;

  const { modifiers, keys } = prefixShortcut.parse(currentPrefix);
  renderKeycaps(keycapLabels(modifiers, keys));
  $('prefix-keys').classList.remove('recording');
  $('prefix-record').textContent = 'Record';
  $('prefix-example').textContent =
    `On any website, hold ${prefixShortcut.format(currentPrefix, IS_MAC)} and press ${exampleKey} to open the link on ${exampleKey}.`;

  $('prefix-note').textContent = keys.length
    ? `Holding several letters together doesn't work on every keyboard. While the prefix is held, ${keys.map(prefixShortcut.keyLabel).join(' and ')} won't type on websites.`
    : 'Click Record, hold the keys you want together, then let go.';
}

function startRecording() {
  recording = { pressed: new Set(), modifiers: new Set(), keys: [] };
  $('prefix-keys').classList.add('recording');
  $('prefix-keys').textContent = 'Hold your keys together, then let go…';
  $('prefix-record').textContent = 'Cancel';
  $('prefix-note').textContent = 'Use Control, Option or Command, plus up to 3 other keys. Esc cancels.';
}

async function stopRecording() {
  recording = null;
  renderPrefix(await loadSettings());
}

function handleRecordingKeydown(event) {
  if (!recording) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat) return;
  if (event.code === 'Escape' && !recording.pressed.size) return stopRecording();
  const modifier = prefixShortcut.modifierFromCode(event.code);
  if (modifier) recording.modifiers.add(modifier);
  else if (!recording.keys.includes(event.code) && recording.keys.length < prefixShortcut.MAX_KEYS) recording.keys.push(event.code);
  recording.pressed.add(event.code);
  renderKeycaps(keycapLabels([...recording.modifiers], recording.keys));
}

// The prefix is everything held before all keys were let go.
async function handleRecordingKeyup(event) {
  if (!recording) return;
  event.preventDefault();
  recording.pressed.delete(event.code);
  // While ⌘ is held, macOS doesn't send keyup for other keys.
  if (prefixShortcut.modifierFromCode(event.code) === 'Meta') {
    for (const code of recording.pressed) if (!prefixShortcut.modifierFromCode(code)) recording.pressed.delete(code);
  }
  if (recording.pressed.size) return;

  const prefix = prefixShortcut.serialize({ modifiers: [...recording.modifiers], keys: recording.keys });
  if (!prefixShortcut.parse(prefix)) {
    showToast(IS_MAC ? 'Include ⌃ Control, ⌥ Option or ⌘ Command.' : 'Include Ctrl, Alt or Win.');
    return startRecording();
  }
  recording = null;
  await save(setPreference('shortcutPrefix', prefix), `Prefix is now ${prefixShortcut.format(prefix, IS_MAC)}`);
  renderPrefix(await loadSettings());
}

function changePageShortcuts(event) {
  const toggle = event.target;
  if (!toggle.checked) {
    chrome.permissions.remove(ALL_SITES);
    save(setPreference('pageShortcuts', false), 'Turned off');
    return;
  }
  // The switch stays off until Chrome grants access and the setting is saved.
  toggle.checked = false;
  showToast('Chrome is asking for access to websites. Choose Allow to turn this on.', 10_000);
  // Ask right away: Chrome only shows the prompt during a user action.
  chrome.permissions.request(ALL_SITES)
    .then(async (granted) => {
      if (!granted) {
        showToast('Not turned on, because access to websites wasn’t allowed.');
        return;
      }
      await setPreference('pageShortcuts', true);
      toggle.checked = true;
      showToast(`Turned on. Hold ${prefixShortcut.format(currentPrefix, IS_MAC)} and press ${exampleKey} on any website.`, 5000);
    })
    .catch((error) => showToast(`Couldn’t turn on: ${error.message}`, 5000));
}

// On only when the setting is saved and Chrome still grants access, which the
// user can take away on chrome://extensions.
async function renderPageShortcutsSwitch(pageShortcuts) {
  $('page-shortcuts').checked = pageShortcuts && (await chrome.permissions.contains(ALL_SITES));
}

let toastTimer;
function showToast(message, duration = 2000) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

async function save(promise, message = 'Saved') {
  try {
    await promise;
    showToast(message);
  } catch (error) {
    showToast(`Couldn't save: ${error.message}`);
  }
}

async function downloadBackup() {
  const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `keyboard-start-page-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function restoreBackup(file) {
  try {
    await importBackup(JSON.parse(await file.text()));
    showToast('Backup restored');
  } catch (error) {
    showToast(error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message);
  }
}

// Event listeners are attached before anything is loaded, so early clicks aren't lost.
buildShortcuts();
onSettingsChanged(render);
onWallpaperChanged(renderWallpaper);
$('page-shortcuts').addEventListener('change', changePageShortcuts);
for (const [mode, text] of Object.entries(OPEN_MODES)) $('prefix-open-mode').add(new Option(text, mode));
$('prefix-open-mode').addEventListener('change', (event) => save(setPreference('prefixOpenMode', event.target.value)));
// Access may have changed on chrome://extensions while this page was in the background.
window.addEventListener('focus', () => !recording && loadSettings().then(render));
$('prefix-record').addEventListener('click', () => (recording ? stopRecording() : startRecording()));
document.addEventListener('keydown', handleRecordingKeydown, true);
document.addEventListener('keyup', handleRecordingKeyup, true);
// Keys let go while the page isn't focused never send keyup.
window.addEventListener('blur', () => recording && stopRecording());

for (const radio of document.querySelectorAll('input[name="theme"]')) {
  radio.addEventListener('change', () => save(setPreference('theme', radio.value)));
}
$('bg-color').addEventListener('change', (event) => save(setPreference('bgColor', event.target.value)));
$('bg-reset').addEventListener('click', () => save(setPreference('bgColor', DEFAULT_PREFERENCES.bgColor)));
$('show-hints').addEventListener('change', (event) => save(setPreference('showHints', event.target.checked)));
$('focus-page').addEventListener('change', (event) => save(setPreference('focusPage', event.target.checked)));
$('wallpaper-choose').addEventListener('click', () => $('wallpaper-file').click());
$('wallpaper-file').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) chooseWallpaper(file);
  event.target.value = '';
});
$('wallpaper-remove').addEventListener('click', () => save(setWallpaper(null), 'Wallpaper removed'));
$('export').addEventListener('click', downloadBackup);
$('import-button').addEventListener('click', () => $('import').click());
$('import').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) restoreBackup(file);
  event.target.value = '';
});

render(await loadSettings());
renderWallpaper(await loadWallpaper());

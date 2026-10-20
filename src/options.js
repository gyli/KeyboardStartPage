import {
  DEFAULT_PREFERENCES, KEYS, OPEN_MODES, SHORTCUT_PREFIXES, TRIGGERS,
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
    icon.hidden = true;
    icon.addEventListener('load', () => { icon.hidden = false; });
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

// --- Prefix shortcuts on any page ---
const ALL_SITES = { origins: ['<all_urls>'] };
const IS_MAC = navigator.platform.startsWith('Mac');
const MODIFIER_NAMES = IS_MAC ? { Ctrl: '⌃ Control', Alt: '⌥ Option', Shift: '⇧ Shift' } : {};

// "Alt+Shift" -> "Alt + Shift", or "⌥ Option + ⇧ Shift" on a Mac.
const formatPrefix = (prefix) => prefix.split('+').map((part) => MODIFIER_NAMES[part] ?? part).join(' + ');

function buildPrefixOptions() {
  const select = $('shortcut-prefix');
  select.add(new Option('Off', ''));
  for (const prefix of SHORTCUT_PREFIXES) select.add(new Option(`${formatPrefix(prefix)} + key`, prefix));
}

function renderPrefix({ shortcutPrefix, links }) {
  $('shortcut-prefix').value = shortcutPrefix ?? '';
  const example = [...KEYS].find((key) => links[key]) ?? 'g';
  $('prefix-example').textContent = shortcutPrefix
    ? `Press ${formatPrefix(shortcutPrefix)} + ${example.toUpperCase()} on any website to open the link on ${example.toUpperCase()}.`
    : 'Hold the prefix and press a key to open its link from any website.';
}

function changePrefix(event) {
  const prefix = event.target.value || null;
  if (!prefix) {
    chrome.permissions.remove(ALL_SITES);
    save(setPreference('shortcutPrefix', null), 'Shortcuts turned off');
    return;
  }
  // Ask right away: Chrome only shows the prompt during a user action.
  chrome.permissions.request(ALL_SITES).then((granted) => {
    if (granted) {
      save(setPreference('shortcutPrefix', prefix), `Saved. Try ${formatPrefix(prefix)} + a key on any website.`);
    } else {
      showToast('Shortcuts need access to websites to work.');
      loadSettings().then(renderPrefix);
    }
  });
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
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
buildPrefixOptions();
$('shortcut-prefix').addEventListener('change', changePrefix);

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

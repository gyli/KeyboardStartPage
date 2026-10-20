import {
  DEFAULT_PREFERENCES, KEYS, OPEN_MODES, TRIGGERS,
  exportBackup, importBackup, loadSettings, loadWallpaper, onSettingsChanged,
  onWallpaperChanged, setLink, setPreference, setShortcut, setWallpaper,
} from './storage.js';
import { faviconUrl } from './url.js';
import { applyTheme } from './theme.js';

const $ = (id) => document.getElementById(id);
const toast = $('toast');
const MAX_WALLPAPER_SIZE = 2560;

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
}

function renderWallpaper(dataUrl) {
  $('wallpaper-preview').hidden = !dataUrl;
  $('wallpaper-preview').style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
  $('wallpaper-remove').disabled = !dataUrl;
}

// Scales the image down and re-encodes it as JPEG, so even large photos stay
// well under chrome.storage.local's 10 MB limit.
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WALLPAPER_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function chooseWallpaper(file) {
  try {
    await setWallpaper(await compressImage(file));
    showToast('Wallpaper saved');
  } catch {
    showToast('Couldn’t use this image. Try a JPEG or PNG file.');
  }
}

// Chrome only lets users set extension shortcuts on its own shortcuts page.
async function renderLauncherShortcut() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((command) => command.name === '_execute_action')?.shortcut;
  $('launcher-shortcut').textContent = shortcut
    ? `Currently ${shortcut}. To turn it off, remove it on Chrome's shortcuts page.`
    : 'Not set. Choose one on Chrome\'s shortcuts page to turn this on.';
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

buildShortcuts();
render(await loadSettings());
renderWallpaper(await loadWallpaper());
renderLauncherShortcut();
onSettingsChanged(render);
onWallpaperChanged(renderWallpaper);
// Pick up shortcut changes when the user comes back from Chrome's shortcuts page.
window.addEventListener('focus', renderLauncherShortcut);

for (const radio of document.querySelectorAll('input[name="theme"]')) {
  radio.addEventListener('change', () => save(setPreference('theme', radio.value)));
}
$('bg-color').addEventListener('change', (event) => save(setPreference('bgColor', event.target.value)));
$('bg-reset').addEventListener('click', () => save(setPreference('bgColor', DEFAULT_PREFERENCES.bgColor)));
$('show-hints').addEventListener('change', (event) => save(setPreference('showHints', event.target.checked)));
$('focus-page').addEventListener('change', (event) => save(setPreference('focusPage', event.target.checked)));
$('launcher-change').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
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

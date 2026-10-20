// Settings live in chrome.storage.sync. The wallpaper is too large for that,
// so the original image file is kept in IndexedDB on this device.
// Key names (li_<key>, ShiftKey, bgColor, ...) are the same as in v0.4,
// so existing users keep their links and preferences after updating.

import { normalizeUrl } from './url.js';

export const KEY_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
export const KEYS = KEY_ROWS.join('');

export const OPEN_MODES = {
  same: 'In the same tab',
  active: 'In a new tab',
  inactive: 'In a new background tab',
  window: 'In a new window',
};

// Only keyboard shortcuts are configurable. Keys are real links, so Chrome
// handles clicks (Ctrl/⌘, Shift, middle click) the same way as on any website.
export const TRIGGERS = {
  Key: 'Press a key',
  ShiftKey: 'Shift + key',
};

export const DEFAULT_SHORTCUTS = {
  Key: 'same',
  ShiftKey: 'inactive',
};

// Click settings from v0.4 that Chrome now handles natively.
const LEGACY_CLICK_SETTINGS = ['Click', 'MiddleClick', 'CtrlClick', 'ShiftClick', 'CtrlShiftClick', 'ShiftMiddleClick'];

export const DEFAULT_PREFERENCES = {
  theme: 'system', // 'system' | 'light' | 'dark'
  bgColor: null, // null means "use the theme's background"
  focusPage: false,
  showHints: true,
  pageShortcuts: false, // "Open links from any page" is on
  prefixOpenMode: 'same', // where those links open: one of OPEN_MODES
  shortcutPrefix: 'Alt', // see src/prefix-shortcut.js for the format
};

const STARTER_LINKS = {
  g: 'https://www.google.com/',
  y: 'https://www.youtube.com/',
  w: 'https://www.wikipedia.org/',
  m: 'https://mail.google.com/',
};

// v0.4 wrote this color to storage on first run, so it does not mean the user picked it.
const LEGACY_DEFAULT_BG = '#eeeeee';

export const MAX_NAME_LENGTH = 30;

const linkId = (key) => `li_${key}`;
const nameId = (key) => `name_${key}`;
const store = chrome.storage.sync;

// Turns the raw storage object into { links, names, shortcuts, ...preferences },
// filling in defaults and ignoring invalid values.
function parse(raw) {
  const links = {};
  const names = {};
  for (const key of KEYS) {
    if (typeof raw[linkId(key)] === 'string') links[key] = raw[linkId(key)];
    if (links[key] && typeof raw[nameId(key)] === 'string') names[key] = raw[nameId(key)];
  }

  const shortcuts = {};
  for (const [trigger, mode] of Object.entries(DEFAULT_SHORTCUTS)) {
    shortcuts[trigger] = raw[trigger] in OPEN_MODES ? raw[trigger] : mode;
  }

  const preferences = {};
  for (const [name, value] of Object.entries(DEFAULT_PREFERENCES)) {
    preferences[name] = raw[name] ?? value;
  }
  if (!(preferences.prefixOpenMode in OPEN_MODES)) preferences.prefixOpenMode = DEFAULT_PREFERENCES.prefixOpenMode;

  return { links, names, shortcuts, ...preferences };
}

// Seeds a fresh install and cleans up values left by older versions. Safe to run every time.
async function migrate(raw) {
  const isFreshInstall = raw.default === undefined && !KEYS.split('').some((key) => raw[linkId(key)]);
  if (isFreshInstall) {
    const seed = { default: 'passed' };
    for (const [key, url] of Object.entries(STARTER_LINKS)) seed[linkId(key)] = url;
    await store.set(seed);
    Object.assign(raw, seed);
  }

  const stale = [];
  if (typeof raw.bgColor === 'string' && raw.bgColor.toLowerCase() === LEGACY_DEFAULT_BG) stale.push('bgColor');
  for (const name of ['defaultActions', ...LEGACY_CLICK_SETTINGS]) {
    if (name in raw) stale.push(name);
  }
  if (stale.length) {
    await store.remove(stale);
    for (const name of stale) delete raw[name];
  }
}

export async function loadSettings() {
  const raw = await store.get(null);
  await migrate(raw);
  return parse(raw);
}

export function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener(async (_changes, area) => {
    if (area === 'sync') callback(parse(await store.get(null)));
  });
}

// Saves or (with url = null) removes a key's link. An empty name removes the custom name.
export async function setLink(key, url, name = '') {
  if (!url) return store.remove([linkId(key), nameId(key)]);
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  await store.set({ [linkId(key)]: url });
  await (trimmed ? store.set({ [nameId(key)]: trimmed }) : store.remove(nameId(key)));
}

// Applies many link changes in one write: { q: { url, name }, w: null, ... }.
// null removes the key's link; an empty name removes its custom name.
export async function saveLinks(changes) {
  const set = {};
  const remove = [];
  for (const [key, link] of Object.entries(changes)) {
    if (!KEYS.includes(key) || key.length !== 1) continue;
    if (!link) {
      remove.push(linkId(key), nameId(key));
      continue;
    }
    set[linkId(key)] = link.url;
    const name = (link.name ?? '').trim().slice(0, MAX_NAME_LENGTH);
    if (name) set[nameId(key)] = name;
    else remove.push(nameId(key));
  }
  if (remove.length) await store.remove(remove);
  if (Object.keys(set).length) await store.set(set);
}

export function setShortcut(trigger, mode) {
  return store.set({ [trigger]: mode });
}

export function setPreference(name, value) {
  return value === null ? store.remove(name) : store.set({ [name]: value });
}

// Runs one request against the "files" store in IndexedDB.
function filesRequest(mode, makeRequest) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('keyboard-start-page', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = makeRequest(open.result.transaction('files', mode).objectStore('files'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
}

// Returns the wallpaper image as a Blob, or null.
export async function loadWallpaper() {
  return (await filesRequest('readonly', (files) => files.get('wallpaper'))) ?? null;
}

// Saves the image file as is, without resizing, or removes it when image is null.
export async function setWallpaper(image) {
  await filesRequest('readwrite', (files) => (image ? files.put(image, 'wallpaper') : files.delete('wallpaper')));
  // IndexedDB has no change events, so tell other open pages through storage.
  await chrome.storage.local.set({ wallpaperChanged: Date.now() });
}

export function onWallpaperChanged(callback) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && changes.wallpaperChanged) callback(await loadWallpaper());
  });
}

// Backup format: { app, version, links: { q: url }, names: { q: name }, shortcuts, preferences }.
// The wallpaper is not included, to keep backups small.
export async function exportBackup() {
  const { links, names, shortcuts, ...preferences } = parse(await store.get(null));
  return {
    app: 'keyboard-start-page',
    version: chrome.runtime.getManifest().version,
    links,
    names,
    shortcuts,
    preferences,
  };
}

// Replaces everything with the backup's contents. Throws if the file is not a backup.
export async function importBackup(backup) {
  if (backup?.app !== 'keyboard-start-page' || !backup.links || typeof backup.links !== 'object') {
    throw new Error('This file is not a Keyboard Start Page backup.');
  }
  const raw = { default: 'passed' };
  for (const [key, value] of Object.entries(backup.links)) {
    const url = typeof value === 'string' && normalizeUrl(value);
    if (key.length !== 1 || !KEYS.includes(key) || !url) continue;
    raw[linkId(key)] = url;
    const name = backup.names?.[key];
    if (typeof name === 'string' && name.trim()) raw[nameId(key)] = name.trim().slice(0, MAX_NAME_LENGTH);
  }
  for (const trigger of Object.keys(DEFAULT_SHORTCUTS)) {
    if (backup.shortcuts?.[trigger] in OPEN_MODES) raw[trigger] = backup.shortcuts[trigger];
  }
  const preferences = backup.preferences ?? {};
  if (['system', 'light', 'dark'].includes(preferences.theme)) raw.theme = preferences.theme;
  if (preferences.prefixOpenMode in OPEN_MODES) raw.prefixOpenMode = preferences.prefixOpenMode;
  if (/^#[\da-f]{6}$/i.test(preferences.bgColor)) raw.bgColor = preferences.bgColor;
  // Same rule as parse() in prefix-shortcut.js: key codes joined by "+", with Ctrl, Alt or Meta.
  if (/^(?=.*\b(Ctrl|Alt|Meta)\b)[A-Za-z0-9+]+$/.test(preferences.shortcutPrefix)) raw.shortcutPrefix = preferences.shortcutPrefix;
  for (const name of ['focusPage', 'showHints', 'pageShortcuts']) {
    if (typeof preferences[name] === 'boolean') raw[name] = preferences[name];
  }
  await store.clear();
  await store.set(raw);
}

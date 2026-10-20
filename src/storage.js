// Settings live in chrome.storage.sync. The wallpaper is too large for sync,
// so it lives in chrome.storage.local and stays on this device.
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

export function setShortcut(trigger, mode) {
  return store.set({ [trigger]: mode });
}

export function setPreference(name, value) {
  return value === null ? store.remove(name) : store.set({ [name]: value });
}

export async function loadWallpaper() {
  const { wallpaper } = await chrome.storage.local.get('wallpaper');
  return wallpaper ?? null;
}

// dataUrl is an image data URL, or null to remove the wallpaper.
export function setWallpaper(dataUrl) {
  return dataUrl ? chrome.storage.local.set({ wallpaper: dataUrl }) : chrome.storage.local.remove('wallpaper');
}

export function onWallpaperChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.wallpaper) callback(changes.wallpaper.newValue ?? null);
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
  if (backup?.app !== 'keyboard-start-page' || typeof backup.links !== 'object') {
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
  if (/^#[\da-f]{6}$/i.test(preferences.bgColor)) raw.bgColor = preferences.bgColor;
  for (const name of ['focusPage', 'showHints']) {
    if (typeof preferences[name] === 'boolean') raw[name] = preferences[name];
  }
  await store.clear();
  await store.set(raw);
}

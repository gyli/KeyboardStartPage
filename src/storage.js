// All settings live in chrome.storage.sync.
// Key names (li_<key>, Click, ShiftKey, bgColor, ...) are the same as in v0.4,
// so existing users keep their links and preferences after updating.

import { normalizeUrl } from './url.js';

export const KEY_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
export const KEYS = KEY_ROWS.join('');

export const OPEN_MODES = {
  same: 'In the same tab',
  active: 'In a new tab',
  inactive: 'In a new background tab',
  window: 'In a new window',
  none: 'Do nothing',
};

export const TRIGGERS = {
  Key: 'Press key',
  ShiftKey: 'Shift + key',
  Click: 'Click',
  MiddleClick: 'Middle click',
  CtrlClick: 'Ctrl/⌘ + click',
  ShiftClick: 'Shift + click',
  CtrlShiftClick: 'Ctrl/⌘ + Shift + click',
  ShiftMiddleClick: 'Shift + middle click',
};

export const DEFAULT_SHORTCUTS = {
  Key: 'same',
  ShiftKey: 'inactive',
  Click: 'same',
  MiddleClick: 'inactive',
  CtrlClick: 'inactive',
  ShiftClick: 'window',
  CtrlShiftClick: 'active',
  ShiftMiddleClick: 'active',
};

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

const linkId = (key) => `li_${key}`;
const store = chrome.storage.sync;

// Turns the raw storage object into { links, shortcuts, ...preferences },
// filling in defaults and ignoring invalid values.
function parse(raw) {
  const links = {};
  for (const key of KEYS) {
    if (typeof raw[linkId(key)] === 'string') links[key] = raw[linkId(key)];
  }

  const shortcuts = {};
  for (const [trigger, mode] of Object.entries(DEFAULT_SHORTCUTS)) {
    shortcuts[trigger] = raw[trigger] in OPEN_MODES ? raw[trigger] : mode;
  }

  const preferences = {};
  for (const [name, value] of Object.entries(DEFAULT_PREFERENCES)) {
    preferences[name] = raw[name] ?? value;
  }

  return { links, shortcuts, ...preferences };
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
  if ('defaultActions' in raw) stale.push('defaultActions');
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

export function setLink(key, url) {
  return url ? store.set({ [linkId(key)]: url }) : store.remove(linkId(key));
}

export function setShortcut(trigger, mode) {
  return store.set({ [trigger]: mode });
}

export function resetShortcuts() {
  return store.set(DEFAULT_SHORTCUTS);
}

export function setPreference(name, value) {
  return value === null ? store.remove(name) : store.set({ [name]: value });
}

// Backup format: { app, version, links: { q: url, ... }, shortcuts: {...}, preferences: {...} }
export async function exportBackup() {
  const { links, shortcuts, ...preferences } = parse(await store.get(null));
  return {
    app: 'keyboard-start-page',
    version: chrome.runtime.getManifest().version,
    links,
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
    if (key.length === 1 && KEYS.includes(key) && url) raw[linkId(key)] = url;
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

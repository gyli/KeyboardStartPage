import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

// A minimal in-memory chrome.storage, installed before storage.js is imported.
const areas = { sync: {}, local: {} };
const area = (name) => ({
  get: async (keys) => {
    const data = areas[name];
    if (keys === null) return structuredClone(data);
    return Object.fromEntries([].concat(keys).filter((key) => key in data).map((key) => [key, data[key]]));
  },
  set: async (items) => { Object.assign(areas[name], structuredClone(items)); },
  remove: async (keys) => { for (const key of [].concat(keys)) delete areas[name][key]; },
  clear: async () => { areas[name] = {}; },
});
globalThis.chrome = {
  storage: { sync: area('sync'), local: area('local'), onChanged: { addListener() {} } },
  runtime: { getManifest: () => ({ version: 'test' }) },
};

const storage = await import('../../src/storage.js');

beforeEach(() => {
  areas.sync = {};
  areas.local = {};
});

test('a fresh install gets starter links', async () => {
  const settings = await storage.loadSettings();
  assert.deepEqual(Object.keys(settings.links).sort(), ['g', 'm', 'w', 'y']);
  assert.equal(areas.sync.default, 'passed');
});

test('v0.4 data is kept and cleaned up', async () => {
  areas.sync = {
    default: 'passed', defaultActions: 'passed', bgColor: '#EEEEEE',
    li_t: 'https://twitter.com/', Key: 'inactive', Click: 'window', ShiftMiddleClick: 'active',
  };
  const settings = await storage.loadSettings();
  assert.deepEqual(settings.links, { t: 'https://twitter.com/' });
  assert.equal(settings.shortcuts.Key, 'inactive');
  assert.equal(settings.bgColor, null);
  assert.deepEqual(Object.keys(areas.sync).sort(), ['Key', 'default', 'li_t']);
});

test('a user who removed every link does not get starter links again', async () => {
  areas.sync = { default: 'passed' };
  assert.deepEqual((await storage.loadSettings()).links, {});
});

test('invalid shortcut values fall back to defaults', async () => {
  areas.sync = { default: 'passed', Key: 'none', ShiftKey: 'bogus', prefixOpenMode: 'nowhere' };
  const settings = await storage.loadSettings();
  assert.deepEqual(settings.shortcuts, storage.DEFAULT_SHORTCUTS);
  assert.equal(settings.prefixOpenMode, 'same');
});

test('setLink saves an optional name and removing the link removes it', async () => {
  await storage.setLink('q', 'https://example.com/', '  Example  ');
  assert.equal(areas.sync.name_q, 'Example');
  await storage.setLink('q', 'https://example.com/', '');
  assert.equal('name_q' in areas.sync, false);
  await storage.setLink('q', 'https://example.com/', 'x'.repeat(100));
  assert.equal(areas.sync.name_q.length, storage.MAX_NAME_LENGTH);
  await storage.setLink('q', null);
  assert.equal('li_q' in areas.sync || 'name_q' in areas.sync, false);
});

test('backups round-trip and reject bad values', async () => {
  areas.sync = { default: 'passed', li_a: 'https://a.example/', name_a: 'A', theme: 'dark', ShiftKey: 'window', shortcutPrefix: 'Ctrl+Alt', prefixOpenMode: 'inactive' };
  const backup = await storage.exportBackup();
  areas.sync = {};
  await storage.importBackup(backup);
  const settings = await storage.loadSettings();
  assert.deepEqual(settings.links, { a: 'https://a.example/' });
  assert.deepEqual(settings.names, { a: 'A' });
  assert.equal(settings.theme, 'dark');
  assert.equal(settings.shortcuts.ShiftKey, 'window');
  assert.equal(settings.shortcutPrefix, 'Ctrl+Alt');
  assert.equal(settings.prefixOpenMode, 'inactive');

  await storage.importBackup({
    app: 'keyboard-start-page',
    links: { a: 'javascript:alert(1)', b: 'example.org', zz: 'https://x.example/' },
    preferences: { theme: 'neon', bgColor: 'red', focusPage: 'yes', shortcutPrefix: 'Shift' },
  });
  assert.deepEqual(areas.sync, { default: 'passed', li_b: 'https://example.org/' });

  await assert.rejects(storage.importBackup({ hello: 'world' }), /not a Keyboard Start Page backup/);
  await assert.rejects(storage.importBackup({ app: 'keyboard-start-page', links: null }), /not a Keyboard Start Page backup/);
});

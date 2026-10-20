import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../src/prefix-shortcut.js');
const { parse, serialize, format, createMatcher } = globalThis.prefixShortcut;

const keydown = (code, modifiers = {}, key = code.replace(/^Key/, '').toLowerCase()) => ({
  code, key, repeat: false, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers,
  used: false,
  preventDefault() { this.used = true; },
  stopImmediatePropagation() {},
});

test('parse and serialize prefixes', () => {
  assert.deepEqual(parse('Alt'), { modifiers: ['Alt'], key: null });
  assert.deepEqual(parse('Meta+Ctrl+KeyP'), { modifiers: ['Ctrl', 'Meta'], key: 'KeyP' });
  assert.equal(serialize({ modifiers: ['Meta', 'Ctrl'], key: 'KeyP' }), 'Ctrl+Meta+KeyP');
  assert.equal(parse('Shift'), null, 'Shift alone would get in the way of typing');
  assert.equal(parse('KeyP'), null);
  assert.equal(parse('Alt+KeyP+KeyQ'), null);
  assert.equal(parse(null), null);
});

test('format shows Mac symbols or names', () => {
  assert.equal(format('Ctrl+Meta+KeyP', true), '⌃⌘P');
  assert.equal(format('Ctrl+Meta+KeyP', false), 'Ctrl + Win + P');
  assert.equal(format('Alt+Shift+Semicolon', true), '⌥⇧;');
});

function matcher(prefix, bound = ['g']) {
  const opened = [];
  let waiting = 0;
  const handle = createMatcher({
    getPrefix: () => prefix,
    isBound: (key) => bound.includes(key),
    onOpen: (key) => opened.push(key),
    onWaiting: () => waiting++,
  });
  return { handle, opened, waiting: () => waiting };
}

test('modifiers only: prefix + key opens the link', () => {
  const { handle, opened } = matcher('Alt');
  const event = keydown('KeyG', { altKey: true }, '©');
  assert.equal(handle(event), true);
  assert.equal(event.used, true);
  assert.deepEqual(opened, ['g']);
});

test('keys without a link and other modifiers are left alone', () => {
  const { handle, opened } = matcher('Alt');
  assert.equal(handle(keydown('KeyQ', { altKey: true })), false);
  assert.equal(handle(keydown('KeyG', { altKey: true, shiftKey: true })), false);
  assert.equal(handle(keydown('KeyG')), false);
  assert.deepEqual(opened, []);
});

test('two steps: prefix with a key, then the link key', () => {
  const { handle, opened, waiting } = matcher('Ctrl+Meta+KeyP');
  assert.equal(handle(keydown('KeyP', { ctrlKey: true, metaKey: true })), true);
  assert.equal(waiting(), 1);
  // Modifier presses while waiting don't cancel it, and the modifiers may still be held.
  assert.equal(handle(keydown('MetaLeft', { metaKey: true }, 'Meta')), false);
  assert.equal(handle(keydown('KeyG', { ctrlKey: true, metaKey: true })), true);
  assert.deepEqual(opened, ['g']);
  // Waiting ends after one key.
  assert.equal(handle(keydown('KeyG')), false);
});

test('two steps: the first step alone does nothing else, and no prefix means off', () => {
  const { handle, opened } = matcher('Ctrl+Meta+KeyP');
  assert.equal(handle(keydown('KeyG', { ctrlKey: true, metaKey: true })), false);
  assert.deepEqual(opened, []);
  assert.equal(matcher(null).handle(keydown('KeyG', { altKey: true })), false);
});

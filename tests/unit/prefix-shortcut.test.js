import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../../src/prefix-shortcut.js');
const { parse, serialize, format, listen } = globalThis.prefixShortcut;

test('parse and serialize prefixes', () => {
  assert.deepEqual(parse('Alt'), { modifiers: ['Alt'], keys: [] });
  assert.deepEqual(parse('KeyX+Ctrl+KeyP'), { modifiers: ['Ctrl'], keys: ['KeyX', 'KeyP'] });
  assert.equal(serialize({ modifiers: ['Meta', 'Ctrl'], keys: ['KeyX', 'KeyP'] }), 'Ctrl+Meta+KeyX+KeyP');
  assert.equal(parse('Shift+KeyX'), null, 'needs Ctrl, Alt or Meta');
  assert.equal(parse('KeyX+KeyP'), null);
  assert.equal(parse('Alt+KeyA+KeyB+KeyC+KeyD'), null, 'at most 3 other keys');
  assert.equal(parse('Alt+KeyA+KeyA'), null);
  assert.equal(parse(null), null);
});

test('format shows Mac symbols or names', () => {
  assert.equal(format('Ctrl+KeyX+KeyP', true), '⌃ + X + P');
  assert.equal(format('Ctrl+Meta+Semicolon', false), 'Ctrl + Win + ;');
});

// A fake page: tracks which keys are down and sends keydown/keyup like a browser.
function page(prefix, bound = ['g']) {
  const target = new EventTarget();
  const opened = [];
  listen({ target, getPrefix: () => prefix, isBound: (key) => bound.includes(key), onOpen: (key) => opened.push(key) });
  const down = new Set();
  const flags = () => ({
    ctrlKey: [...down].some((c) => c.startsWith('Control')),
    altKey: [...down].some((c) => c.startsWith('Alt')),
    shiftKey: [...down].some((c) => c.startsWith('Shift')),
    metaKey: [...down].some((c) => c.startsWith('Meta')),
  });
  const send = (type, code, extra = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, repeat: false, ...flags(), ...extra });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return {
    opened,
    press: (code) => { down.add(code); return send('keydown', code); },
    release: (code, { silent = false } = {}) => { down.delete(code); if (!silent) send('keyup', code); },
    repeat: (code) => send('keydown', code, { repeat: true }),
    blur: () => { down.clear(); target.dispatchEvent(Object.assign(new Event('blur'))); },
  };
}

test('modifiers only: hold Alt and tap G', () => {
  const p = page('Alt');
  p.press('AltLeft');
  assert.equal(p.press('KeyG'), true);
  assert.deepEqual(p.opened, ['g']);
});

test('hold Ctrl + X + P and tap G', () => {
  const p = page('Ctrl+KeyX+KeyP');
  p.press('ControlLeft');
  assert.equal(p.press('KeyX'), true, 'prefix keys are kept from typing');
  assert.equal(p.repeat('KeyX'), true, 'and from repeating');
  p.press('KeyP');
  assert.equal(p.press('KeyG'), true);
  assert.deepEqual(p.opened, ['g']);
});

test('nothing opens unless exactly the prefix is held', () => {
  const p = page('Ctrl+KeyX+KeyP');
  p.press('ControlLeft');
  p.press('KeyX');
  assert.equal(p.press('KeyG'), false, 'P is missing');
  p.release('KeyG');
  p.press('KeyP');
  p.press('KeyQ');
  assert.equal(p.press('KeyG'), false, 'Q is held too');
  assert.deepEqual(p.opened, []);
});

test('keys without a link and plain typing are left alone', () => {
  const p = page('Alt');
  assert.equal(p.press('KeyG'), false);
  p.release('KeyG');
  p.press('AltLeft');
  assert.equal(p.press('KeyQ'), false);
  assert.deepEqual(p.opened, []);
});

test('on a Mac, releasing ⌘ releases keys that never sent keyup', () => {
  const p = page('Meta+KeyX');
  p.press('MetaLeft');
  p.press('KeyX');
  p.release('KeyX', { silent: true }); // macOS drops this keyup while ⌘ is held
  p.release('MetaLeft');
  p.press('MetaLeft');
  assert.equal(p.press('KeyG'), false, 'X is no longer held');
  assert.deepEqual(p.opened, []);
});

test('losing focus forgets held keys', () => {
  const p = page('Ctrl+KeyX');
  p.press('ControlLeft');
  p.press('KeyX');
  p.blur();
  p.press('ControlLeft');
  assert.equal(p.press('KeyG'), false);
});

test('no prefix means off', () => {
  const p = page(null);
  p.press('AltLeft');
  assert.equal(p.press('KeyG'), false);
});

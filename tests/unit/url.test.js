import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faviconUrl, isWebUrl, normalizeUrl, siteName } from '../../src/url.js';

test('normalizeUrl adds https:// to bare domains', () => {
  assert.equal(normalizeUrl('github.com'), 'https://github.com/');
  assert.equal(normalizeUrl('  news.ycombinator.com/news '), 'https://news.ycombinator.com/news');
  assert.equal(normalizeUrl('localhost:3000'), 'https://localhost:3000/');
});

test('normalizeUrl keeps explicit schemes', () => {
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com/');
  assert.equal(normalizeUrl('chrome://settings'), 'chrome://settings');
  assert.equal(normalizeUrl('mailto:me@example.com'), 'mailto:me@example.com');
});

test('normalizeUrl rejects things that are not addresses', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('not a url'), null);
  assert.equal(normalizeUrl('hello'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
});

test('siteName shows the host without www', () => {
  assert.equal(siteName('https://www.youtube.com/watch?v=1'), 'youtube.com');
  assert.equal(siteName('chrome://settings'), 'settings');
  assert.equal(siteName('not a url'), 'not a url');
});

test('faviconUrl only covers web pages', () => {
  assert.match(faviconUrl('https://github.com/gyli'), /domain=github\.com/);
  assert.equal(faviconUrl('chrome://settings'), null);
});

test('isWebUrl', () => {
  assert.equal(isWebUrl('https://example.com'), true);
  assert.equal(isWebUrl('chrome://settings'), false);
  assert.equal(isWebUrl('nonsense'), false);
});

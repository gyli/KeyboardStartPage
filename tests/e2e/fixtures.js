// Loads the unpacked extension into Chromium for each test.
import { test as base, chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const iconPng = readFileSync(path.join(root, 'icons/icon-32.png'));

// An address that is never opened, for tests that only store links.
export const SITE = 'https://site.example.test/';

export const test = base.extend({
  // A real local web server for tests that open links. Playwright can't intercept
  // requests in tabs the extension opens in the background, so fake routes won't do.
  site: [async ({}, use) => {
    const server = http.createServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end('<title>Test site</title>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    await use(`http://127.0.0.1:${server.address().port}/`);
    server.close();
  }, { scope: 'worker' }],

  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
    });
    // Fake favicons, so tests never touch the network.
    await context.route(/^https:\/\/www\.google\.com\/s2\/favicons/, (route) =>
      route.fulfill({ contentType: 'image/png', body: iconPng }));
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker'));
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  // Opens an extension page by file name, e.g. open('newtab.html').
  open: async ({ context, extensionId }, use) => {
    await use(async (file, page) => {
      page ??= await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/${file}`);
      return page;
    });
  },

  // Replaces chrome.storage.sync with data. Call before opening the page under test.
  // Runs in the service worker, because extension pages seed starter links on load.
  seed: async ({ serviceWorker }, use) => {
    await use((data) => serviceWorker.evaluate(async (items) => {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(items);
    }, { default: 'passed', ...data }));
  },
});

export { expect };

export const key = (page, letter) => page.locator(`.key[data-key="${letter}"]`);

export const storage = (page, area = 'sync') => page.evaluate((name) => chrome.storage[name].get(null), area);

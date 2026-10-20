import { statSync } from 'node:fs';
import path from 'node:path';
import { SITE, expect, key, storage, test } from './fixtures.js';

test('the popup opens a link over the current page', async ({ context, site, seed, open }) => {
  await seed({ li_e: site });
  // Opened as a tab, "the current page" is the popup's own tab. The popup then
  // closes itself, so check the request instead of the page.
  const page = await open('popup.html');
  await expect(key(page, 'e')).toHaveClass(/bound/);
  const request = context.waitForEvent('request', (r) => r.url() === site);
  // The popup closes itself on keydown, so don't wait for the key to be released.
  await page.keyboard.down('e');
  await request;
});

test('the popup offers to add a link when an empty key is pressed', async ({ seed, open }) => {
  await seed({});
  const page = await open('popup.html');
  await expect(page.locator('.key')).toHaveCount(36);
  await page.keyboard.press('k');
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('dialog kbd')).toHaveText('K');
});

test('settings show saved values and save changes', async ({ seed, open }) => {
  await seed({ li_e: SITE, name_e: 'Example', ShiftKey: 'window' });
  const page = await open('options.html');

  await expect(page.locator('select[data-trigger="ShiftKey"]')).toHaveValue('window');
  await expect(page.locator('#launcher-shortcut')).toHaveText(/Not set/);
  await expect(page.locator('#links li')).toHaveText(/Example/);

  await page.locator('select[data-trigger="Key"]').selectOption('active');
  await page.getByRole('switch', { name: /Show hints/ }).uncheck();
  expect(await storage(page)).toMatchObject({ Key: 'active', showHints: false });
});

test('a chosen wallpaper is saved at full quality and can be removed', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  const file = path.resolve(import.meta.dirname, '../../screenshot/screenshot-1.png');
  const savedSize = () => page.evaluate(async () => {
    const { loadWallpaper } = await import('/src/storage.js');
    return (await loadWallpaper())?.size ?? null;
  });

  await page.locator('#wallpaper-file').setInputFiles(file);
  await expect(page.locator('#toast')).toHaveText('Wallpaper saved');
  expect(await savedSize()).toBe(statSync(file).size);
  await expect(page.locator('#wallpaper-preview')).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('#toast')).toHaveText('Wallpaper removed');
  expect(await savedSize()).toBe(null);
});

test('choosing a new wallpaper replaces the old one in storage', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  const stored = () => page.evaluate(() => new Promise((resolve) => {
    indexedDB.open('keyboard-start-page').onsuccess = (event) => {
      const files = event.target.result.transaction('files').objectStore('files');
      files.getAll().onsuccess = (all) => resolve(all.target.result.map((file) => file.size));
    };
  }));
  const first = path.resolve(import.meta.dirname, '../../screenshot/screenshot-1.png');
  const second = path.resolve(import.meta.dirname, '../../screenshot/screenshot-2.png');

  await page.locator('#wallpaper-file').setInputFiles(first);
  await expect(page.locator('#toast')).toHaveText('Wallpaper saved');
  await page.locator('#wallpaper-file').setInputFiles(second);
  await expect.poll(stored).toEqual([statSync(second).size]);
});

test('a file that is not an image is rejected as a wallpaper', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  await page.locator('#wallpaper-file').setInputFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.locator('#toast')).toHaveText(/Couldn’t use this image/);
});

test('"Focus the page on new tabs" gives the page keyboard focus', async ({ context, seed, open }) => {
  await seed({ focusPage: true });
  const options = await open('options.html');
  const swapped = context.waitForEvent('page', (page) => page.url().includes('newtab.html?focus'));
  await options.evaluate(() => chrome.tabs.create({}));
  const page = await swapped;
  await expect(key(page, 'q')).toBeVisible();
  expect(await page.evaluate(() => document.hasFocus())).toBe(true);
});

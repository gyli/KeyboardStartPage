import path from 'node:path';
import { SITE, expect, key, storage, test } from './fixtures.js';

test('the popup opens a link over the current page', async ({ context, site, seed, open }) => {
  await seed({ li_e: site });
  // Opened as a tab, "the current page" is the popup's own tab. The popup then
  // closes itself, so check the request instead of the page.
  const page = await open('popup.html');
  await expect(key(page, 'e')).toHaveClass(/bound/);
  const request = context.waitForEvent('request', (r) => r.url() === site);
  await page.keyboard.press('e');
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

test('a chosen wallpaper is resized, saved locally and can be removed', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');

  await page.locator('#wallpaper-file').setInputFiles(path.resolve(import.meta.dirname, '../../screenshot/screenshot-1.png'));
  await expect(page.locator('#toast')).toHaveText('Wallpaper saved');
  const { wallpaper } = await storage(page, 'local');
  expect(wallpaper).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.locator('#wallpaper-preview')).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  expect(await storage(page, 'local')).not.toHaveProperty('wallpaper');
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

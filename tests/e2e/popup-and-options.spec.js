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

  await page.getByRole('button', { name: 'Remove', exact: true }).click();
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

test('turning on shortcuts asks for website access, and turning off removes it', async ({ seed, open }) => {
  await seed({ li_g: SITE });
  const page = await open('options.html');
  // Stand in for Chrome's permission prompt, which tests can't click.
  await page.evaluate(() => {
    window.permissionCalls = [];
    chrome.permissions.request = async (p) => { permissionCalls.push(['request', p.origins]); return true; };
    chrome.permissions.remove = async (p) => { permissionCalls.push(['remove', p.origins]); return true; };
  });
  const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });

  await toggle.check();
  await expect(page.locator('#toast')).toHaveText(/Turned on/);
  expect(await storage(page)).toMatchObject({ pageShortcuts: true });

  await toggle.uncheck();
  await expect(page.locator('#toast')).toHaveText('Turned off');
  expect(await storage(page)).toMatchObject({ pageShortcuts: false });
  expect(await page.evaluate(() => permissionCalls)).toEqual([['request', ['<all_urls>']], ['remove', ['<all_urls>']]]);
});

test('declining website access keeps shortcuts off', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  await page.evaluate(() => { chrome.permissions.request = async () => false; });
  const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });
  // The switch flips back off once access is declined, so click instead of check().
  await toggle.click();
  await expect(page.locator('#toast')).toHaveText(/needs access to websites/);
  await expect(toggle).not.toBeChecked();
  expect(await storage(page)).not.toHaveProperty('pageShortcuts');
});

test('the prefix is built from modifier chips and an optional key', async ({ seed, open }) => {
  await seed({ li_g: SITE });
  const page = await open('options.html');
  const chip = (modifier) => page.locator(`#prefix-modifiers [data-modifier="${modifier}"]`);
  const prefix = async () => (await storage(page)).shortcutPrefix;

  // Default is Alt.
  await expect(chip('Alt')).toHaveAttribute('aria-pressed', 'true');
  await chip('Ctrl').click();
  await expect.poll(prefix).toBe('Ctrl+Alt');
  await chip('Alt').click();
  await expect.poll(prefix).toBe('Ctrl');

  // Removing the last of Ctrl/Alt/Meta isn't allowed.
  await chip('Ctrl').click();
  await expect(page.locator('#toast')).toHaveText(/The prefix needs/);
  await expect.poll(prefix).toBe('Ctrl');

  await chip('Meta').click();
  await page.locator('#prefix-key').click();
  await expect(page.locator('#prefix-key')).toHaveText('Press a key…');
  await page.keyboard.press('Shift'); // modifiers alone are ignored
  await page.keyboard.press('p');
  await expect.poll(prefix).toBe('Ctrl+Meta+KeyP');
  await expect(page.locator('#prefix-key')).toHaveText('P');
  await expect(page.locator('#prefix-example')).toHaveText(/, then G to open the link on G/);

  await page.locator('#prefix-key-clear').click();
  await expect.poll(prefix).toBe('Ctrl+Meta');
  await expect(page.locator('#prefix-key')).toHaveText('Add key');
});

test.describe('with access to websites', () => {
  test.use({ allSitesAccess: true });

  const registeredScripts = (serviceWorker) => serviceWorker.evaluate(async () =>
    (await chrome.scripting.getRegisteredContentScripts()).map((script) => script.id));

  test('prefix + key opens the link from a web page', async ({ context, serviceWorker, site, seed }) => {
    // This page is open before the prefix is set, and must not need a reload.
    const page = await context.newPage();
    await page.goto(`${site}start`);

    await seed({ li_e: `${site}target`, pageShortcuts: true, shortcutPrefix: 'Alt' });
    await expect.poll(() => registeredScripts(serviceWorker)).toEqual(['page-shortcuts']);

    // Q has no link, so the page keeps the key press.
    await page.keyboard.press('Alt+Q');
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(`${site}start`);

    await expect(async () => {
      await page.keyboard.press('Alt+E');
      await expect(page).toHaveURL(`${site}target`, { timeout: 1000 });
    }).toPass();

    await seed({});
    await expect.poll(() => registeredScripts(serviceWorker)).toEqual([]);
  });

  test('a two-step prefix opens the link from a web page', async ({ context, serviceWorker, site, seed }) => {
    await seed({ li_e: `${site}target`, pageShortcuts: true, shortcutPrefix: 'Ctrl+Shift+KeyP' });
    await expect.poll(() => registeredScripts(serviceWorker)).toEqual(['page-shortcuts']);
    const page = await context.newPage();
    await page.goto(`${site}start`);

    await expect(async () => {
      await page.keyboard.press('Control+Shift+P');
      await page.keyboard.press('e');
      await expect(page).toHaveURL(`${site}target`, { timeout: 1000 });
    }).toPass();
  });
});

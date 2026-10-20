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
    let granted = false;
    chrome.permissions.request = async (p) => { permissionCalls.push(['request', p.origins]); granted = true; return true; };
    chrome.permissions.remove = async (p) => { permissionCalls.push(['remove', p.origins]); granted = false; return true; };
    chrome.permissions.contains = async () => granted;
  });
  const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });

  // The switch turns on only after access is granted, so click instead of check().
  await toggle.click();
  await expect(page.locator('#toast')).toHaveText(/Turned on/);
  await expect(toggle).toBeChecked();
  expect(await storage(page)).toMatchObject({ pageShortcuts: true });

  await toggle.uncheck();
  await expect(page.locator('#toast')).toHaveText('Turned off');
  expect(await storage(page)).toMatchObject({ pageShortcuts: false });
  expect(await page.evaluate(() => permissionCalls)).toEqual([['request', ['<all_urls>']], ['remove', ['<all_urls>']]]);
});

test('the switch stays off while Chrome is still asking for access', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  // Chrome's prompt is open and the user hasn't answered yet.
  await page.evaluate(() => { chrome.permissions.request = () => new Promise(() => {}); });
  const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });
  await toggle.click();
  await expect(page.locator('#toast')).toHaveText(/Choose Allow/);
  await expect(toggle).not.toBeChecked();
  expect(await storage(page)).not.toHaveProperty('pageShortcuts');
});

test('a failed access request is reported', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  await page.evaluate(() => { chrome.permissions.request = async () => { throw new Error('Something went wrong'); }; });
  const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });
  await toggle.click();
  await expect(page.locator('#toast')).toHaveText('Couldn’t turn on: Something went wrong');
  await expect(toggle).not.toBeChecked();
});

test('declining website access keeps shortcuts off', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  await page.evaluate(() => { chrome.permissions.request = async () => false; });
  const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });
  // The switch flips back off once access is declined, so click instead of check().
  await toggle.click();
  await expect(page.locator('#toast')).toHaveText(/access to websites wasn’t allowed/);
  await expect(toggle).not.toBeChecked();
  expect(await storage(page)).not.toHaveProperty('pageShortcuts');
});

test('the prefix is recorded by holding keys together', async ({ seed, open }) => {
  await seed({ li_g: SITE });
  const page = await open('options.html');
  const prefix = async () => (await storage(page)).shortcutPrefix;
  const keycaps = page.locator('#prefix-keys kbd');

  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.locator('#prefix-keys')).toHaveText(/Hold your keys/);
  await page.keyboard.down('Control');
  await page.keyboard.down('x');
  await page.keyboard.down('p');
  await expect(keycaps).toHaveCount(3); // shown while held
  await page.keyboard.up('p');
  await page.keyboard.up('x');
  await page.keyboard.up('Control');

  await expect.poll(prefix).toBe('Ctrl+KeyX+KeyP');
  await expect(keycaps).toHaveText([/Ctrl|⌃/, 'X', 'P']);
  await expect(page.locator('#prefix-example')).toHaveText(/hold .* and press G to open the link on G/);
  await expect(page.locator('#prefix-note')).toHaveText(/X and P won't type/);
});

test('where prefix shortcut links open is saved', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  const select = page.getByLabel('Open links');
  await expect(select).toHaveValue('same');
  await select.selectOption('active');
  await expect.poll(async () => (await storage(page)).prefixOpenMode).toBe('active');
  await page.reload();
  await expect(page.getByLabel('Open links')).toHaveValue('active');
});

test('a prefix without Control, Option or Command is rejected', async ({ seed, open }) => {
  await seed({});
  const page = await open('options.html');
  await page.getByRole('button', { name: 'Record' }).click();
  await page.keyboard.down('Shift');
  await page.keyboard.down('x');
  await page.keyboard.up('x');
  await page.keyboard.up('Shift');
  await expect(page.locator('#toast')).toHaveText(/Include/);
  // Still recording, so the user can try again; Esc cancels.
  await expect(page.locator('#prefix-keys')).toHaveText(/Hold your keys/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#prefix-record')).toHaveText('Record');
  expect(await storage(page)).not.toHaveProperty('shortcutPrefix');
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

  test('the switch stays on after the prefix changes and after a reload', async ({ seed, open }) => {
    await seed({ li_g: SITE });
    const page = await open('options.html');
    const toggle = page.getByRole('switch', { name: /Use a shortcut on websites/ });
    await toggle.click();
    await expect(toggle).toBeChecked();

    await page.getByRole('button', { name: 'Record' }).click();
    await page.keyboard.down('Alt');
    await page.keyboard.down('p');
    await page.keyboard.up('p');
    await page.keyboard.up('Alt');
    await expect.poll(async () => (await storage(page)).shortcutPrefix).toBe('Alt+KeyP');
    await expect(toggle).toBeChecked();

    await page.reload();
    await expect(toggle).toBeChecked();
    expect(await storage(page)).toMatchObject({ pageShortcuts: true });
  });

  test('a script left registered by an older version is replaced', async ({ serviceWorker, seed }) => {
    await serviceWorker.evaluate(() => chrome.scripting.registerContentScripts([
      { id: 'page-shortcuts', js: ['src/page-shortcuts.js'], matches: ['<all_urls>'] },
      { id: 'launcher', js: ['src/page-shortcuts.js'], matches: ['<all_urls>'] },
    ]));
    await seed({ pageShortcuts: true });
    await expect.poll(() => serviceWorker.evaluate(async () =>
      (await chrome.scripting.getRegisteredContentScripts()).map((script) => [script.id, script.js])))
      .toEqual([['page-shortcuts', ['src/prefix-shortcut.js', 'src/page-shortcuts.js']]]);
  });

  test('a prefix shortcut can open the link in a new tab next to the page', async ({ context, serviceWorker, site, seed }) => {
    await seed({ li_e: `${site}target`, pageShortcuts: true, shortcutPrefix: 'Alt', prefixOpenMode: 'active' });
    await expect.poll(() => registeredScripts(serviceWorker)).toEqual(['page-shortcuts']);
    const page = await context.newPage();
    await page.goto(`${site}start`);

    const newTab = context.waitForEvent('page');
    await expect(async () => {
      await page.keyboard.press('Alt+E');
      await newTab;
    }).toPass({ timeout: 5000 });
    await expect(await newTab).toHaveURL(`${site}target`);
    await expect(page).toHaveURL(`${site}start`);
    // Opened right after the page, not at the end of the tab strip.
    const [pageTab, openedTab] = await serviceWorker.evaluate(async (urls) => {
      const tabs = await chrome.tabs.query({});
      return urls.map((url) => tabs.find((tab) => tab.url === url).index);
    }, [`${site}start`, `${site}target`]);
    expect(openedTab).toBe(pageTab + 1);
  });

  test('holding Ctrl + X + P and tapping a key opens its link from a web page', async ({ context, serviceWorker, site, seed }) => {
    await seed({ li_e: `${site}target`, pageShortcuts: true, shortcutPrefix: 'Ctrl+KeyX+KeyP' });
    await expect.poll(() => registeredScripts(serviceWorker)).toEqual(['page-shortcuts']);
    const page = await context.newPage();
    await page.goto(`${site}start`);

    await expect(async () => {
      await page.keyboard.down('Control');
      await page.keyboard.down('x');
      await page.keyboard.down('p');
      await page.keyboard.press('e');
      await page.keyboard.up('p');
      await page.keyboard.up('x');
      await page.keyboard.up('Control');
      await expect(page).toHaveURL(`${site}target`, { timeout: 1000 });
    }).toPass();
  });
});

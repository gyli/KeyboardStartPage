import { SITE, expect, key, storage, test } from './fixtures.js';

test('shows every key, with an icon only where a link is set', async ({ seed, open }) => {
  await seed({ li_e: SITE });
  const page = await open('newtab.html');

  await expect(page.locator('.key')).toHaveCount(36);
  await expect(key(page, 'e').locator('.key-label')).toHaveText('E');
  await expect(key(page, 'e').locator('.key-icon')).toBeVisible();
  await expect(key(page, 'q').locator('.key-icon')).toBeHidden();
});

test('adds, names and removes a link with the editor', async ({ seed, open }) => {
  await seed({});
  const page = await open('newtab.html');
  const dialog = page.locator('dialog');

  await key(page, 'q').locator('.key-cap').click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Website address').fill('not a url');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.locator('.error')).toHaveText(/doesn’t look like a web address/);

  await dialog.getByLabel('Website address').fill('site.example.test');
  await dialog.getByLabel(/Name/).fill('My site');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(key(page, 'q')).toHaveClass(/bound/);
  await expect(key(page, 'q').locator('.key-cap')).toHaveAttribute('title', `My site\n${SITE}`);
  await expect(key(page, 'q').locator('.key-name')).toHaveText('My site');
  await expect(key(page, 'q').locator('.key-label')).toHaveText('Q');
  expect(await storage(page)).toMatchObject({ li_q: SITE, name_q: 'My site' });

  await key(page, 'q').hover();
  await key(page, 'q').locator('.key-edit').click();
  await expect(dialog.getByLabel('Website address')).toHaveValue(SITE);
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(key(page, 'q')).not.toHaveClass(/bound/);
  expect(await storage(page)).not.toHaveProperty('li_q');
});

test('pressing Enter in the editor saves the link', async ({ seed, open }) => {
  await seed({});
  const page = await open('newtab.html');
  await key(page, 'q').locator('.key-cap').click();
  await page.locator('dialog').getByLabel('Website address').fill('site.example.test');
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog')).toBeHidden();
  expect(await storage(page)).toMatchObject({ li_q: SITE });
});

test('pressing a key opens its link, and Shift opens it in the background', async ({ context, site, seed, open }) => {
  await seed({ li_e: site });
  const page = await open('newtab.html');

  const backgroundTab = context.waitForEvent('page');
  await page.keyboard.press('Shift+E');
  await expect(await backgroundTab).toHaveURL(site);
  await expect(page).toHaveURL(/newtab\.html/);

  await page.keyboard.press('e');
  await expect(page).toHaveURL(site);
});

test('the shortcut prefix works on the new tab page too', async ({ site, seed, open }) => {
  await seed({ li_e: site, pageShortcuts: true, shortcutPrefix: 'Alt+KeyP' });
  const page = await open('newtab.html');
  await expect(key(page, 'e')).toHaveClass(/bound/);
  await page.keyboard.down('Alt');
  await page.keyboard.down('p');
  await page.keyboard.press('e');
  await expect(page).toHaveURL(site);
});

test('pressing an empty key explains how to add a link', async ({ seed, open }) => {
  await seed({});
  const page = await open('newtab.html');
  // Keys get their labels in the same step that starts listening for key presses.
  await expect(page.getByRole('button', { name: 'K: add a link' })).toBeAttached();
  await page.keyboard.press('k');
  await expect(page.locator('#toast')).toHaveText(/K has no link yet/);
});

test('clicking a key follows Chrome link rules', async ({ context, site, seed, open }) => {
  await seed({ li_e: site });
  const page = await open('newtab.html');
  const cap = key(page, 'e').locator('.key-cap');
  const windowCount = () => page.evaluate(async () => (await chrome.windows.getAll()).length);
  const windowsBefore = await windowCount();

  let opened = context.waitForEvent('page');
  await cap.click({ modifiers: ['ControlOrMeta'] });
  await expect(await opened).toHaveURL(site);

  opened = context.waitForEvent('page');
  await cap.click({ button: 'middle' });
  await expect(await opened).toHaveURL(site);

  opened = context.waitForEvent('page');
  await cap.click({ modifiers: ['Shift'] });
  await expect(await opened).toHaveURL(site);
  expect(await windowCount()).toBe(windowsBefore + 1);

  await cap.click();
  await expect(page).toHaveURL(site);
});

test('dropping a link on a key adds it, or asks before replacing one', async ({ seed, open }) => {
  await seed({ li_e: SITE });
  const page = await open('newtab.html');
  const drop = (letter, url) => page.evaluate(({ letter, url }) => {
    const target = document.querySelector(`.key[data-key="${letter}"] .key-cap`);
    const data = new DataTransfer();
    data.setData('text/uri-list', url);
    for (const type of ['dragover', 'drop']) {
      target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
    }
  }, { letter, url });

  await drop('d', 'https://dropped.example.test/');
  await expect(key(page, 'd')).toHaveClass(/bound/);
  await expect(page.locator('#toast')).toHaveText('Added dropped.example.test to D');

  await drop('e', 'https://other.example.test/');
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('dialog').getByLabel('Website address')).toHaveValue('https://other.example.test/');
});

test('the wallpaper shows behind the keyboard', async ({ seed, open }) => {
  await seed({});
  const page = await open('newtab.html');
  await page.evaluate(async () => {
    const { setWallpaper } = await import('/src/storage.js');
    const image = await (await fetch('/icons/icon-128.png')).blob();
    await setWallpaper(image);
  });
  await expect(page.locator('body')).toHaveClass(/has-wallpaper/);
  await expect(page.locator('#wallpaper')).toHaveCSS('background-image', /blob:/);
});

test('site icons are cached by the service worker', async ({ seed, open }) => {
  await seed({ li_e: SITE });
  const page = await open('newtab.html');
  await expect(key(page, 'e').locator('.key-icon')).toBeVisible();

  const cached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('favicons-'));
    const entries = names.length ? await (await caches.open(names[0])).keys() : [];
    return entries.map((request) => request.url);
  });
  expect(cached).toEqual([expect.stringContaining('google.com/s2/favicons')]);
});

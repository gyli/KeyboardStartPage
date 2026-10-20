import { expect, storage, test } from './fixtures.js';

const LINKS = {
  li_a: 'https://a.example.test/', name_a: 'A site',
  li_b: 'https://b.example.test/',
  li_c: 'https://c.example.test/', name_c: 'C site',
};

const linkStorage = async (page) =>
  Object.fromEntries(Object.entries(await storage(page)).filter(([name]) => /^(li|name)_/.test(name)));

test('edits, additions and removals are saved together', async ({ seed, open }) => {
  await seed(LINKS);
  const page = await open('options.html');
  const actions = page.locator('#links-actions');
  await expect(actions).toBeHidden();

  await page.getByLabel('Name for B').fill('B site');
  await page.getByLabel('Address for C').fill('c2.example.test');
  await page.getByRole('button', { name: 'Remove A' }).click();
  await page.getByLabel('Key', { exact: true }).selectOption('z');
  await page.getByLabel('Address for the new link').fill('z.example.test');
  await page.getByLabel('Name for the new link').fill('Zed');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(actions).toBeVisible();
  await expect(page.locator('#links-changes')).toHaveText('4 unsaved changes');
  // Nothing is stored until Save.
  expect(await linkStorage(page)).toEqual(LINKS);

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#toast')).toHaveText('Saved 4 changes');
  await expect(actions).toBeHidden();
  expect(await linkStorage(page)).toEqual({
    li_b: 'https://b.example.test/', name_b: 'B site',
    li_c: 'https://c2.example.test/', name_c: 'C site',
    li_z: 'https://z.example.test/', name_z: 'Zed',
  });
});

test('selected links are removed together, and Undo brings one back', async ({ seed, open }) => {
  await seed(LINKS);
  const page = await open('options.html');
  await page.getByLabel('Select all').check();
  await expect(page.getByRole('button', { name: 'Remove selected (3)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove selected (3)' }).click();
  await expect(page.locator('#links li.removed')).toHaveCount(3);

  await page.locator('#links li[data-key="b"]').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#links-changes')).toHaveText('2 unsaved changes');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#links-actions')).toBeHidden();
  expect(await linkStorage(page)).toEqual({ li_b: 'https://b.example.test/' });
});

test('an invalid address blocks saving until it is fixed', async ({ seed, open }) => {
  await seed(LINKS);
  const page = await open('options.html');
  await page.getByLabel('Address for A').fill('not a url');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#toast')).toHaveText('Fix the highlighted address first.');
  await expect(page.locator('#links li[data-key="a"]')).toHaveClass(/invalid/);
  expect(await linkStorage(page)).toEqual(LINKS);

  await page.getByLabel('Address for A').fill('a2.example.test');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#links-actions')).toBeHidden();
  expect((await storage(page)).li_a).toBe('https://a2.example.test/');
});

test('Discard drops unsaved changes, and editing back to the saved value is not a change', async ({ seed, open }) => {
  await seed(LINKS);
  const page = await open('options.html');
  await page.getByLabel('Name for A').fill('Changed');
  await expect(page.locator('#links-actions')).toBeVisible();
  await page.getByLabel('Name for A').fill('A site');
  await expect(page.locator('#links-actions')).toBeHidden();

  await page.getByLabel('Name for A').fill('Changed');
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByLabel('Name for A')).toHaveValue('A site');
  expect(await linkStorage(page)).toEqual(LINKS);
});

test('the add row only offers keys without a link', async ({ seed, open }) => {
  await seed(LINKS);
  const page = await open('options.html');
  const options = await page.getByLabel('Key', { exact: true }).locator('option').allTextContents();
  expect(options).toHaveLength(33);
  expect(options).not.toContain('A');
  await page.getByLabel('Address for the new link').fill('not a url');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText(/doesn’t look like a web address/);
});

test('links changed on the new tab page show up, without losing unsaved edits', async ({ seed, open, serviceWorker }) => {
  await seed(LINKS);
  const page = await open('options.html');
  await page.getByLabel('Name for A').fill('Edited here');
  await serviceWorker.evaluate(() => chrome.storage.sync.set({ li_d: 'https://d.example.test/' }));
  await expect(page.getByLabel('Address for D')).toHaveValue('https://d.example.test/');
  await expect(page.getByLabel('Name for A')).toHaveValue('Edited here');
});

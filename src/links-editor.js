// "Your links" on the settings page: edit, add and remove many links, then
// save them together. Changes stay in a draft until the user saves.
import { KEYS, MAX_NAME_LENGTH, saveLinks } from './storage.js';
import { faviconUrl, normalizeUrl } from './url.js';

const REMOVE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

export function createLinksEditor({ showToast }) {
  const $ = (id) => document.getElementById(id);
  const list = $('links');
  let saved = { links: {}, names: {} };
  // key -> { url, name } for an edited or added link, or null for a removed one.
  let draft = new Map();
  const selected = new Set();
  const invalid = new Set();

  const savedLink = (key) => (saved.links[key] ? { url: saved.links[key], name: saved.names[key] ?? '' } : null);
  const currentLink = (key) => (draft.has(key) ? draft.get(key) : savedLink(key));
  const isChanged = (key) => JSON.stringify(currentLink(key)) !== JSON.stringify(savedLink(key));
  const changedKeys = () => [...draft.keys()].filter(isChanged);
  // Keys shown as rows: saved links, plus links added in the draft.
  const rowKeys = () => [...KEYS].filter((key) => savedLink(key) || draft.get(key));

  function setDraft(key, link) {
    draft.set(key, link);
    if (!isChanged(key)) draft.delete(key);
    invalid.delete(key);
  }

  function input(className, value, placeholder, onInput) {
    const element = document.createElement('input');
    element.type = 'text';
    element.className = className;
    element.value = value;
    element.placeholder = placeholder;
    element.spellcheck = false;
    element.addEventListener('input', () => onInput(element.value));
    return element;
  }

  function renderRow(key) {
    const link = currentLink(key);
    const removed = link === null;
    const shown = link ?? savedLink(key);
    const item = document.createElement('li');
    item.dataset.key = key;
    item.classList.toggle('removed', removed);
    item.classList.toggle('changed', isChanged(key) && !removed);
    item.classList.toggle('invalid', invalid.has(key));

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = selected.has(key);
    check.disabled = removed;
    check.setAttribute('aria-label', `Select ${key.toUpperCase()}`);
    check.addEventListener('change', () => {
      if (check.checked) selected.add(key);
      else selected.delete(key);
      renderToolbar();
    });

    const kbd = document.createElement('kbd');
    kbd.textContent = key.toUpperCase();

    const icon = document.createElement('img');
    icon.alt = '';
    // Invisible until it loads, but it keeps its space so the rows line up.
    icon.style.visibility = 'hidden';
    icon.addEventListener('load', () => { icon.style.visibility = ''; });
    const src = faviconUrl(shown.url);
    if (src) icon.src = src;

    const name = input('link-name', shown.name, 'Name', (value) => {
      setDraft(key, { ...currentLink(key), name: value });
      refreshRowState(item, key);
    });
    name.maxLength = MAX_NAME_LENGTH;
    name.setAttribute('aria-label', `Name for ${key.toUpperCase()}`);
    const url = input('link-url', shown.url, 'example.com', (value) => {
      setDraft(key, { ...currentLink(key), url: value });
      refreshRowState(item, key);
    });
    url.setAttribute('aria-label', `Address for ${key.toUpperCase()}`);
    name.disabled = url.disabled = removed;

    const action = document.createElement('button');
    action.type = 'button';
    if (removed) {
      action.className = 'button undo';
      action.textContent = 'Undo';
      action.addEventListener('click', () => {
        setDraft(key, savedLink(key));
        render();
      });
    } else {
      action.className = 'icon-button small';
      action.title = `Remove ${key.toUpperCase()}`;
      action.setAttribute('aria-label', action.title);
      action.innerHTML = REMOVE_ICON;
      action.addEventListener('click', () => {
        // A link added in this draft just disappears; a saved one is marked for removal.
        if (savedLink(key)) setDraft(key, null);
        else draft.delete(key);
        selected.delete(key);
        render();
      });
    }

    item.append(check, kbd, icon, name, url, action);
    return item;
  }

  // Updates a row's markers and the save bar without rebuilding the row,
  // so typing keeps its focus.
  function refreshRowState(item, key) {
    item.classList.toggle('changed', isChanged(key));
    item.classList.remove('invalid');
    renderActions();
  }

  function renderToolbar() {
    const selectable = rowKeys().filter((key) => currentLink(key) !== null);
    $('links-select-all').checked = selectable.length > 0 && selectable.every((key) => selected.has(key));
    $('links-select-all').disabled = selectable.length === 0;
    $('links-remove-selected').disabled = selected.size === 0;
    $('links-remove-selected').textContent = selected.size ? `Remove selected (${selected.size})` : 'Remove selected';
  }

  function renderAddRow() {
    const used = new Set(rowKeys());
    const select = $('add-key');
    const previous = select.value;
    select.replaceChildren(...[...KEYS].filter((key) => !used.has(key)).map((key) => new Option(key.toUpperCase(), key)));
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    const full = select.options.length === 0;
    for (const id of ['add-key', 'add-url', 'add-name', 'add-link']) $(id).disabled = full;
    $('add-url').placeholder = full ? 'Every key has a link' : 'example.com';
  }

  function renderActions() {
    const count = changedKeys().length;
    $('links-actions').hidden = count === 0;
    $('links-changes').textContent = `${count} unsaved ${count === 1 ? 'change' : 'changes'}`;
  }

  function render() {
    for (const key of [...selected]) if (!rowKeys().includes(key) || currentLink(key) === null) selected.delete(key);
    const keys = rowKeys();
    list.replaceChildren(...keys.map(renderRow));
    if (!keys.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No links yet. Add one below.';
      list.append(empty);
    }
    renderToolbar();
    renderAddRow();
    renderActions();
  }

  function addLink() {
    const key = $('add-key').value;
    const url = normalizeUrl($('add-url').value);
    if (!key) return;
    if (!url) {
      showToast('That doesn’t look like a web address.');
      $('add-url').focus();
      return;
    }
    setDraft(key, { url, name: $('add-name').value.trim() });
    $('add-url').value = '';
    $('add-name').value = '';
    render();
    $('add-url').focus();
  }

  async function save() {
    const changes = {};
    for (const key of changedKeys()) {
      const link = currentLink(key);
      if (link === null) {
        changes[key] = null;
        continue;
      }
      const url = normalizeUrl(link.url);
      if (!url) invalid.add(key);
      else changes[key] = { url, name: link.name };
    }
    if (invalid.size) {
      render();
      showToast(`Fix the highlighted ${invalid.size === 1 ? 'address' : 'addresses'} first.`);
      return;
    }
    try {
      await saveLinks(changes);
      const count = Object.keys(changes).length;
      draft = new Map();
      showToast(`Saved ${count} ${count === 1 ? 'change' : 'changes'}`);
    } catch (error) {
      showToast(`Couldn’t save: ${error.message}`);
    }
  }

  $('links-select-all').addEventListener('change', (event) => {
    for (const key of rowKeys()) {
      if (event.target.checked && currentLink(key) !== null) selected.add(key);
      else selected.delete(key);
    }
    render();
  });
  $('links-remove-selected').addEventListener('click', () => {
    for (const key of selected) {
      if (savedLink(key)) setDraft(key, null);
      else draft.delete(key);
    }
    selected.clear();
    render();
  });
  $('add-name').maxLength = MAX_NAME_LENGTH;
  $('add-link').addEventListener('click', addLink);
  for (const id of ['add-url', 'add-name']) {
    $(id).addEventListener('keydown', (event) => event.key === 'Enter' && addLink());
  }
  $('links-save').addEventListener('click', save);
  $('links-discard').addEventListener('click', () => {
    draft = new Map();
    invalid.clear();
    render();
  });

  return {
    // Called with fresh settings. Unsaved edits are kept.
    update(settings) {
      saved = { links: settings.links, names: settings.names };
      for (const key of [...draft.keys()]) if (!isChanged(key)) draft.delete(key);
      render();
    },
    hasUnsavedChanges: () => changedKeys().length > 0,
  };
}

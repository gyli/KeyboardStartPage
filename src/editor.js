// The "edit link" dialog, shared by the new tab page and the popup.
import { MAX_NAME_LENGTH, setLink } from './storage.js';
import { normalizeUrl } from './url.js';

const DIALOG_HTML = `
  <form method="dialog">
    <h2>Link for <kbd data-ref="key"></kbd></h2>
    <label>
      Website address
      <input data-ref="url" type="text" inputmode="url" placeholder="example.com" autocomplete="off" spellcheck="false">
    </label>
    <label>
      Name <span class="optional">(optional, shown on the key, short names fit best)</span>
      <input data-ref="name" type="text" maxlength="${MAX_NAME_LENGTH}" autocomplete="off">
    </label>
    <p data-ref="error" class="error" role="alert"></p>
    <div class="dialog-actions">
      <button data-ref="remove" class="button danger" type="button">Remove</button>
      <span class="spacer"></span>
      <button class="button" value="cancel" formnovalidate>Cancel</button>
      <button class="button primary" value="save">Save</button>
    </div>
  </form>`;

export function createEditor() {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = DIALOG_HTML;
  document.body.append(dialog);
  const ref = (name) => dialog.querySelector(`[data-ref="${name}"]`);
  let currentKey;

  dialog.addEventListener('submit', (event) => {
    if (event.submitter?.value !== 'save') return;
    const input = ref('url').value;
    const url = normalizeUrl(input);
    if (input.trim() && !url) {
      event.preventDefault();
      ref('error').textContent = 'That doesn’t look like a web address.';
      return;
    }
    setLink(currentKey, url, ref('name').value);
  });

  ref('remove').addEventListener('click', () => {
    setLink(currentKey, null);
    dialog.close();
  });

  return {
    get isOpen() {
      return dialog.open;
    },
    // Opens the dialog for key. url and name prefill the fields; isBound shows the Remove button.
    open(key, { url = '', name = '', isBound = false } = {}) {
      currentKey = key;
      ref('key').textContent = key.toUpperCase();
      ref('url').value = url;
      ref('name').value = name;
      ref('error').textContent = '';
      ref('remove').hidden = !isBound;
      dialog.showModal();
      ref('url').select();
    },
  };
}

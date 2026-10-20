// The on-screen keyboard, shared by the new tab page and the toolbar popup.
import { KEY_ROWS } from './storage.js';
import { faviconUrl, isWebUrl, normalizeUrl, siteName } from './url.js';
import { modeForClick, openLink } from './open.js';

const KEY_HTML = `
  <a class="key-cap"><span class="key-label"></span><img class="key-icon" alt="" hidden></a>
  <button class="key-edit" type="button" tabindex="-1" aria-label="Edit link">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>
  </button>`;

// Builds the keyboard inside container.
//   onEdit(key, url?)     open the editor, optionally with a URL to prefill
//   onOpen(key, event)    called when a key with a link is clicked. Optional: without
//                         it, Chrome follows the link itself, except for non-web URLs.
//   onDropUrl(key, url)   called when a link is dropped on a key
// Returns { render(settings), flash(key) }.
export function createKeyboard(container, { onEdit, onOpen, onDropUrl }) {
  const elements = new Map();
  let links = {};

  KEY_ROWS.forEach((row) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'row';
    for (const key of row) {
      const element = document.createElement('div');
      element.className = 'key';
      element.dataset.key = key;
      element.innerHTML = KEY_HTML;
      element.querySelector('.key-label').textContent = key.toUpperCase();
      elements.set(key, element);
      rowElement.append(element);
    }
    container.append(rowElement);
  });

  function handleClick(event) {
    const element = event.target.closest('.key');
    if (!element) return;
    const { key } = element.dataset;
    const url = links[key];

    if (event.target.closest('.key-edit') || !url) {
      event.preventDefault();
      if (event.button === 0) onEdit(key);
    } else if (onOpen || !isWebUrl(url)) {
      // Chrome blocks extension pages from following links to chrome:// and similar pages.
      event.preventDefault();
      if (onOpen) onOpen(key, event);
      else openLink(url, modeForClick(event));
    }
  }

  // Enter or Space on a focused empty key opens the editor, like a button.
  function handleKeydown(event) {
    const cap = event.target.closest('.key-cap[role="button"]');
    if (!cap || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onEdit(cap.parentElement.dataset.key);
  }

  function handleDrag(event) {
    const element = event.target.closest('.key');
    const types = event.dataTransfer?.types ?? [];
    if (!element || !(types.includes('text/uri-list') || types.includes('text/plain'))) return;
    event.preventDefault();
    element.classList.toggle('drop-target', event.type === 'dragover');
  }

  function handleDrop(event) {
    const element = event.target.closest('.key');
    if (!element) return;
    event.preventDefault();
    element.classList.remove('drop-target');
    const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
    // uri-list may hold several lines and # comments; use the first URL.
    const first = text.split(/\r?\n/).find((line) => line && !line.startsWith('#')) ?? '';
    const url = normalizeUrl(first);
    if (url) onDropUrl(element.dataset.key, url);
  }

  container.addEventListener('click', handleClick);
  container.addEventListener('auxclick', handleClick);
  container.addEventListener('keydown', handleKeydown);
  container.addEventListener('dragover', handleDrag);
  container.addEventListener('dragleave', handleDrag);
  container.addEventListener('drop', handleDrop);
  // Favicons stay hidden until they load, so a failed request shows nothing instead of a broken image.
  container.addEventListener('load', (event) => { event.target.hidden = false; }, true);

  function render(settings) {
    links = settings.links;
    for (const [key, element] of elements) {
      const url = links[key];
      const label = key.toUpperCase();
      const name = settings.names[key] ?? (url && siteName(url));
      const cap = element.querySelector('.key-cap');
      const icon = element.querySelector('.key-icon');
      const iconSrc = url ? faviconUrl(url) : null;

      element.classList.toggle('bound', Boolean(url));
      if (url) {
        cap.href = url;
        cap.title = settings.names[key] ? `${name}\n${url}` : url;
        cap.setAttribute('aria-label', `${label}: ${name}`);
        cap.removeAttribute('role');
        cap.removeAttribute('tabindex');
      } else {
        cap.removeAttribute('href');
        cap.title = `Add a link for ${label}`;
        cap.setAttribute('aria-label', `${label}: add a link`);
        cap.setAttribute('role', 'button');
        cap.setAttribute('tabindex', '0');
      }
      if (icon.getAttribute('src') !== iconSrc) {
        icon.hidden = true;
        if (iconSrc) icon.src = iconSrc;
        else icon.removeAttribute('src');
      }
    }
  }

  function flash(key) {
    const element = elements.get(key);
    element.classList.add('pressed');
    setTimeout(() => element.classList.remove('pressed'), 150);
  }

  return { render, flash };
}

// Prefer the typed character so non-QWERTY layouts open the key they see printed.
// Fall back to the physical key for layouts without Latin letters, and for Shift + digit.
export function keyFromEvent(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return null;
  const char = event.key.toLowerCase();
  if (/^[a-z0-9]$/.test(char)) return char;
  const match = /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code);
  return match ? (match[1] ?? match[2]).toLowerCase() : null;
}

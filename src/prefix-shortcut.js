// Prefix shortcuts, shared by web pages (page-shortcuts.js), the new tab page
// and the settings page. A classic script, not a module, because content
// scripts can't be modules. It may run twice in a page, so it only defines
// globalThis.prefixShortcut once.
//
// A prefix is stored as text: modifiers, then an optional extra key, using
// physical key codes so keyboard layouts don't matter. Examples:
//   "Alt"            Alt + G opens the link on G.
//   "Ctrl+Meta+KeyP" press Ctrl + ⌘ + P, then G (within 2 seconds).

globalThis.prefixShortcut ??= (() => {
  const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const WAIT_MS = 2000;

  // Returns { modifiers, key } or null if text isn't a usable prefix. It needs
  // Ctrl, Alt or ⌘: Shift alone would get in the way of typing.
  function parse(text) {
    if (typeof text !== 'string' || !text) return null;
    const parts = text.split('+');
    const modifiers = MODIFIERS.filter((modifier) => parts.includes(modifier));
    const others = parts.filter((part) => !MODIFIERS.includes(part));
    if (others.length > 1 || !modifiers.some((modifier) => modifier !== 'Shift')) return null;
    return { modifiers, key: others[0] ?? null };
  }

  function serialize({ modifiers, key }) {
    return [...MODIFIERS.filter((modifier) => modifiers.includes(modifier)), ...(key ? [key] : [])].join('+');
  }

  const modifiersOf = (event) =>
    [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean).join('+');

  const isModifierKey = (event) => ['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(event.key);

  // The keyboard key a link is on. Uses the physical key, because Alt/Option
  // changes the typed character on a Mac.
  function keyFromCode(code) {
    const match = /^(?:Key([A-Z])|Digit(\d))$/.exec(code);
    return match ? (match[1] ?? match[2]).toLowerCase() : null;
  }

  const KEY_LABELS = {
    Space: 'Space', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Backquote: '`',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Enter: 'Enter', Tab: 'Tab',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };

  // "KeyP" -> "P", "Digit1" -> "1", "Semicolon" -> ";", "F2" -> "F2".
  function keyLabel(code) {
    return KEY_LABELS[code] ?? code.replace(/^(Key|Digit|Numpad)/, '');
  }

  function modifierLabel(modifier, isMac) {
    return (isMac ? { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' } : { Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win' })[modifier];
  }

  // "Ctrl+Meta+KeyP" -> "⌃⌘P" on a Mac, "Ctrl + Win + P" elsewhere.
  function format(text, isMac) {
    const prefix = parse(text);
    if (!prefix) return '';
    const parts = [...prefix.modifiers.map((modifier) => modifierLabel(modifier, isMac)), ...(prefix.key ? [keyLabel(prefix.key)] : [])];
    return parts.join(isMac ? '' : ' + ');
  }

  // Returns a keydown handler. It calls onOpen(key) when the shortcut for a key
  // with a link is pressed, and onWaiting() after a two-step prefix's first step.
  // Returns true when it used the event.
  function createMatcher({ getPrefix, isBound, onOpen, onWaiting = () => {} }) {
    let waitingUntil = 0;

    const use = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    };

    return (event) => {
      const prefix = parse(getPrefix());
      if (!prefix || event.repeat) return false;

      // Second step of a two-step prefix. Modifiers may still be held down.
      if (Date.now() < waitingUntil) {
        if (isModifierKey(event)) return false;
        waitingUntil = 0;
        const key = keyFromCode(event.code);
        if (!key || !isBound(key)) return false;
        onOpen(key);
        return use(event);
      }

      if (modifiersOf(event) !== prefix.modifiers.join('+')) return false;
      if (prefix.key) {
        if (event.code !== prefix.key) return false;
        waitingUntil = Date.now() + WAIT_MS;
        onWaiting();
        return use(event);
      }
      // Keys without a link are left to the page.
      const key = keyFromCode(event.code);
      if (!key || !isBound(key)) return false;
      onOpen(key);
      return use(event);
    };
  }

  return { MODIFIERS, parse, serialize, format, keyLabel, modifierLabel, createMatcher };
})();

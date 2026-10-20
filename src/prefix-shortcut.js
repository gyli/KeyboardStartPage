// Prefix shortcuts, shared by web pages (page-shortcuts.js), the new tab page
// and the settings page. A classic script, not a module, because content
// scripts can't be modules. It may run twice in a page, so it only defines
// globalThis.prefixShortcut once.
//
// A prefix is a set of keys held down together. While they are held, tapping
// a key with a link opens it. It is stored as text: modifiers first, then
// other keys by physical key code, so keyboard layouts don't matter.
//   "Alt"              hold Alt, tap G
//   "Ctrl+KeyX+KeyP"   hold Ctrl + X + P, tap G

globalThis.prefixShortcut ??= (() => {
  const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'];
  const MAX_KEYS = 3; // besides modifiers

  // Returns { modifiers, keys } or null if text isn't a usable prefix. It needs
  // Ctrl, Alt or ⌘: without one, the prefix couldn't be told apart from typing.
  function parse(text) {
    if (typeof text !== 'string' || !text) return null;
    const parts = text.split('+');
    const modifiers = MODIFIERS.filter((modifier) => parts.includes(modifier));
    const keys = parts.filter((part) => !MODIFIERS.includes(part));
    if (keys.length > MAX_KEYS || new Set(keys).size !== keys.length) return null;
    if (!modifiers.some((modifier) => modifier !== 'Shift')) return null;
    return { modifiers, keys };
  }

  function serialize({ modifiers, keys }) {
    return [...MODIFIERS.filter((modifier) => modifiers.includes(modifier)), ...keys].join('+');
  }

  const modifiersOf = (event) =>
    [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean).join('+');

  // "ControlLeft" -> "Ctrl", "MetaRight" -> "Meta", "KeyX" -> null.
  function modifierFromCode(code) {
    const match = /^(Control|Alt|Shift|Meta|OS)(Left|Right)?$/.exec(code);
    return match ? { Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Meta', OS: 'Meta' }[match[1]] : null;
  }

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

  // Labels for each key in a prefix, e.g. ["⌃", "X", "P"].
  function labels(text, isMac) {
    const prefix = parse(text);
    return prefix ? [...prefix.modifiers.map((m) => modifierLabel(m, isMac)), ...prefix.keys.map(keyLabel)] : [];
  }

  // "Ctrl+KeyX+KeyP" -> "⌃ + X + P" on a Mac, "Ctrl + X + P" elsewhere.
  const format = (text, isMac) => labels(text, isMac).join(' + ');

  // Listens on target and calls onOpen(key) when a key with a link is tapped
  // while exactly the prefix's keys are held.
  function listen({ target = window, getPrefix, isBound, onOpen }) {
    const held = new Set(); // non-modifier keys held down, by code

    const use = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    target.addEventListener('keydown', (event) => {
      const prefix = parse(getPrefix());
      const { code } = event;
      if (!prefix || modifierFromCode(code)) return;
      const modifiersMatch = modifiersOf(event) === prefix.modifiers.join('+');

      // A key of the prefix itself: keep it from typing or repeating on the page.
      if (prefix.keys.includes(code)) {
        held.add(code);
        if (modifiersMatch) use(event);
        return;
      }

      const othersHeld = [...held].filter((heldCode) => heldCode !== code);
      const prefixHeld = modifiersMatch
        && prefix.keys.every((key) => held.has(key))
        && othersHeld.every((heldCode) => prefix.keys.includes(heldCode));
      held.add(code);
      const key = keyFromCode(code);
      // Keys without a link are left to the page.
      if (!prefixHeld || !key || !isBound(key)) return;
      use(event);
      if (!event.repeat) onOpen(key);
    }, true);

    target.addEventListener('keyup', (event) => {
      held.delete(event.code);
      // While ⌘ is held, macOS doesn't send keyup for other keys,
      // so treat them all as released when ⌘ is.
      if (modifierFromCode(event.code) === 'Meta') held.clear();
    }, true);

    // Keys released while the window didn't have focus never send keyup.
    target.addEventListener('blur', (event) => {
      if (event.target === target) held.clear();
    });
  }

  return { MODIFIERS, MAX_KEYS, parse, serialize, format, labels, keyLabel, modifierLabel, modifierFromCode, listen };
})();

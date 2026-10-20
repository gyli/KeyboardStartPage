// Shortcut helpers shared by the settings page and the launcher content script.
// A classic script (not a module), because content scripts can't be modules.
// Shortcuts are stored as text like "Ctrl+Shift+KeyK", using the physical key
// (event.code) so they keep working when the keyboard layout changes.

// Returns the shortcut for a keydown event, or null if it isn't a valid one:
// it needs Ctrl, Alt or ⌘ (Shift alone would clash with typing) and a non-modifier key.
function shortcutFromEvent(event) {
  if (!(event.ctrlKey || event.altKey || event.metaKey)) return null;
  if (/^(Control|Alt|Shift|Meta|OS)(Left|Right)?$/.test(event.code) || !event.code) return null;
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(event.code);
  return parts.join('+');
}

// "Alt+Shift+KeyK" -> "Alt + Shift + K" (with ⌘/⌥/⌃ symbols on a Mac).
function formatShortcut(shortcut) {
  const mac = navigator.platform.startsWith('Mac');
  const names = mac ? { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' } : { Meta: 'Win' };
  return shortcut
    .split('+')
    .map((part) => names[part] ?? part.replace(/^(Key|Digit)/, ''))
    .join(mac ? '' : ' + ');
}

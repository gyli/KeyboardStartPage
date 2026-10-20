// Opens links through the tabs API. Works from the new tab page and from the popup,
// where "the same tab" means the page the user was on.
export async function openLink(url, mode) {
  const current = await chrome.tabs.getCurrent(); // undefined in the popup
  switch (mode) {
    case 'same':
      return current ? chrome.tabs.update(current.id, { url }) : chrome.tabs.update({ url });
    case 'active':
    case 'inactive':
      return chrome.tabs.create({ url, active: mode === 'active' });
    case 'window':
      return chrome.windows.create({ url });
  }
}

// Same rules Chrome uses for links: Ctrl/⌘ or middle click opens a tab
// (in front with Shift), and Shift + click opens a window.
export function modeForClick(event) {
  if (event.button === 1 || event.ctrlKey || event.metaKey) return event.shiftKey ? 'active' : 'inactive';
  return event.shiftKey ? 'window' : 'same';
}

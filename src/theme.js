// Applies the theme and custom background to the current page.
// Colors themselves are defined in styles/base.css.
// The values are also cached in localStorage so src/boot.js can apply them
// before the first paint, without waiting for chrome.storage.
const THEME_CACHE = 'theme-cache'; // also read by src/boot.js

export function applyTheme({ theme, bgColor }) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;

  if (bgColor) root.style.setProperty('--page-bg', bgColor);
  else root.style.removeProperty('--page-bg');

  try {
    localStorage.setItem(THEME_CACHE, JSON.stringify({ theme, bgColor }));
  } catch {
    // Cache is only an optimization.
  }
}

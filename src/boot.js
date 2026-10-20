// Loaded as a blocking script in <head> to apply the cached theme before first paint.
// Keep in sync with applyTheme() in theme.js.
try {
  const { theme, bgColor } = JSON.parse(localStorage.getItem('theme-cache')) || {};
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  if (bgColor) root.style.setProperty('--page-bg', bgColor);
} catch {
  // No cache yet.
}

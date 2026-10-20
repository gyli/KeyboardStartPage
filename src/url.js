// Turns what the user typed into a URL, or returns null if it isn't one.
// "github.com" becomes "https://github.com/".
export function normalizeUrl(input) {
  let text = input.trim();
  if (!text) return null;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(text) && !/^(mailto|about):/i.test(text)) {
    text = `https://${text}`;
  }

  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol === 'javascript:') return null;
  if (isWeb(url) && !url.hostname.includes('.') && url.hostname !== 'localhost') return null;
  return url.href;
}

// Short site name for labels and messages, e.g. "youtube.com".
export function siteName(href) {
  try {
    const url = new URL(href);
    return url.hostname.replace(/^www\./, '') || href;
  } catch {
    return href;
  }
}

export function faviconUrl(href) {
  try {
    const url = new URL(href);
    if (!isWeb(url)) return null;
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(url.hostname)}`;
  } catch {
    return null;
  }
}

// Extension pages can follow links to http(s) pages, but Chrome blocks links to
// chrome://, file:// and similar pages.
export function isWebUrl(href) {
  try {
    return isWeb(new URL(href));
  } catch {
    return false;
  }
}

function isWeb(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

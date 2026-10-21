# Contributing

There is no build step, and the extension has no dependencies. Playwright is used only for tests.

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder.
2. After editing files, click the reload icon on the extension card and open a new tab.
3. Run `scripts/package.sh` to build the Web Store zip in `dist/`.

## Tests

Run `npm install` once, then `npm test`. Unit tests (`tests/unit`) use Node's built-in test runner. End-to-end tests (`tests/e2e`) load the extension into Chromium with Playwright. If Playwright asks for a browser, run `npx playwright install chromium`.

GitHub Actions runs all tests on every push to `master` and on pull requests.

## Releasing

1. Bump `version` in `manifest.json` and commit.
2. Tag and push: `git tag v1.2.0 && git push origin v1.2.0`. The tag must match the manifest version.
3. GitHub Actions runs the tests, builds the zip and attaches it to a GitHub release with that name.
4. Download the zip from the release and upload it to the Chrome Web Store.

## Files

| Path | What it is |
|---|---|
| `newtab.html`, `src/newtab.js` | The new tab page |
| `popup.html`, `src/popup.js` | The toolbar popup |
| `options.html`, `src/options.js` | The settings page |
| `src/keyboard.js`, `styles/keyboard.css` | The keyboard, shared by the new tab page and the popup |
| `src/editor.js` | The edit link dialog |
| `src/links-editor.js` | "Your links" in settings: edit, add and remove many links at once |
| `src/open.js` | Opens links in the chosen tab or window |
| `src/prefix-shortcut.js` | Prefix format and the held-keys listener, shared by web pages, the new tab page and settings |
| `src/page-shortcuts.js` | Prefix shortcuts on web pages |
| `src/storage.js` | Settings: defaults, loading, saving, migration, backup, wallpaper |
| `src/url.js` | URL cleanup and display helpers |
| `src/theme.js`, `src/boot.js` | Theme handling |
| `service-worker.js` | Turns prefix shortcuts on and off, opens their links, caches site icons |
| `styles/base.css` | Colors and shared controls for light and dark mode |

Settings are stored in `chrome.storage.sync` with the same key names as v0.4 (`li_<key>`, `ShiftKey`, `bgColor`, ...), so updating keeps existing users’ links.

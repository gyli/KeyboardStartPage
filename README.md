# Keyboard Start Page

A Chrome new tab page that shows a keyboard. Give each key a website, then press the key to open it.

![Keyboard Start Page](screenshot/screenshot-1.png)

## Install

Get it from the [Chrome Web Store](https://chromewebstore.google.com/detail/keyboard-start-page/lcgabkjfibeakijbhicjjilchhmjaiid). Requires Chrome 123 or later.

## Use

- **Add a link:** click an empty key and type the address.
- **Change or remove a link:** hover a key and click the pencil.
- **Open a link:** press the key, or click it.
- **Settings:** click the gear in the bottom right corner.

Chrome puts the cursor in the address bar on every new tab. Press <kbd>Tab</kbd> or click the page before pressing a key, or turn on **Focus the page on new tabs** in settings.

### Default shortcuts

Every shortcut can be changed in settings.

| Action | Opens the link |
|---|---|
| Press key, or click | In the same tab |
| <kbd>Shift</kbd> + key, Ctrl/⌘ + click, or middle click | In a new background tab |
| Ctrl/⌘ + <kbd>Shift</kbd> + click, or <kbd>Shift</kbd> + middle click | In a new tab |
| <kbd>Shift</kbd> + click | In a new window |

## Development

There is no build step and there are no dependencies.

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick this folder.
2. After editing files, click the reload icon on the extension card and open a new tab.
3. Run `scripts/package.sh` to build the Web Store zip in `dist/`.

| Path | What it is |
|---|---|
| `newtab.html`, `src/newtab.js` | The new tab page |
| `options.html`, `src/options.js` | The settings page |
| `src/storage.js` | Settings: defaults, loading, saving, migration, backup |
| `src/url.js` | URL cleanup and display helpers |
| `src/theme.js`, `src/boot.js` | Theme handling |
| `styles/base.css` | Colors and shared controls for light and dark mode |

Settings are stored in `chrome.storage.sync` with the same key names as v0.4 (`li_<key>`, `Click`, `bgColor`, ...), so updating keeps existing users' links.

## Thanks

The original idea comes from [/t/32295](https://www.v2ex.com/t/32295). Early code was based on [qex/keystart](https://github.com/qex/keystart).

## License

MIT. See [LICENSE](LICENSE).

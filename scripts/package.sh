#!/bin/sh
# Builds the zip to upload to the Chrome Web Store: dist/keyboard-start-page-<version>.zip
set -eu
cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
out="dist/keyboard-start-page-$version.zip"

mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json service-worker.js newtab.html popup.html options.html _locales icons/*.png icons/newtab.svg src styles -x '.*'
echo "$out"

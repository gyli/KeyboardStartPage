#!/bin/sh
# Builds the zip to upload to the Chrome Web Store: dist/keyboard-start-page-<version>.zip
set -eu
cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
out="dist/keyboard-start-page-$version.zip"

mkdir -p dist
rm -f "$out"
zip -qr "$out" manifest.json newtab.html options.html _locales icons/*.png src styles -x '.*'
echo "$out"

#!/bin/sh
# Builds the extension from extension/ into a folder: copies the files,
# compiles the settings schema and the translations. install.sh uses it,
# and so does the local test harness, so what is tested is what gets
# installed.
# Usage: sh tools/build.sh DEST
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
src=$here/extension
dest=${1:?usage: build.sh DEST}
domain=$(sed -n 's/.*"gettext-domain": *"\([^"]*\)".*/\1/p' "$src/metadata.json")

mkdir -p "$dest/schemas" "$dest/icons"
cp "$src"/*.js "$src/metadata.json" "$src/stylesheet.css" "$src/LICENSE" "$dest/"
cp "$src"/icons/* "$dest/icons/"
cp "$src"/schemas/*.gschema.xml "$dest/schemas/"
glib-compile-schemas --strict "$dest/schemas"
for po in "$src"/po/*.po; do
    lang=$(basename "$po" .po)
    mkdir -p "$dest/locale/$lang/LC_MESSAGES"
    python3 "$here/tools/po2mo.py" "$po" "$dest/locale/$lang/LC_MESSAGES/$domain.mo"
done

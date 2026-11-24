#!/bin/sh
# Removes what install.sh added and puts back the settings it saved.
set -eu

dest=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/dock-glass@atarico.github.io
backup=${XDG_STATE_HOME:-$HOME/.local/state}/mac-dock/backup.txt

# Putting enabled-extensions back turns the extension off in the running
# shell; then its folder can go.
if [ -f "$backup" ]; then
    while read -r path value; do
        if [ -n "$value" ]; then
            dconf write "$path" "$value"
        else
            dconf reset "$path"
        fi
    done < "$backup"
    rm "$backup"
fi
rm -rf "$dest"
dconf reset -f /org/gnome/shell/extensions/ubuntu-dock-plus/

# The Downloads launcher and its dock pin.
rm -f "${XDG_DATA_HOME:-$HOME/.local/share}/applications/mac-dock-downloads.desktop"
gsettings set org.gnome.shell favorite-apps "$(gsettings get org.gnome.shell favorite-apps |
    sed "s/, 'mac-dock-downloads.desktop'//; s/'mac-dock-downloads.desktop', //; s/\['mac-dock-downloads.desktop'\]/@as []/")"

echo "Removed. Restart GNOME Shell to drop it from memory: on X11 press Alt+F2, type r, press Enter."

#!/bin/sh
# Installs the extension in extension/ (Dock Glass with ubuntu-dock-plus's
# changes) for this user, with the values it was tuned for: 52 px
# icons and dock opacity 0.17; the rest are the extension's own defaults
# (genie 550 ms, magnification 1.6x). Saves every setting it or the top bar
# menu can change first, so uninstall.sh can put them back. Needs a GNOME
# Shell restart afterwards (X11: Alt+F2, r, Enter).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
uuid=dock-glass@atarico.github.io
dest=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$uuid
backup=${XDG_STATE_HOME:-$HOME/.local/state}/mac-dock/backup.txt
dock=org.gnome.shell.extensions.dash-to-dock

# Each key is saved the first time an install sees it, so later runs keep
# the real originals. An empty value means the key was never set, and
# uninstall.sh resets it.
mkdir -p "$(dirname "$backup")"
touch "$backup"
for key in extensions/dash-to-dock/dash-max-icon-size extensions/dash-to-dock/transparency-mode \
    extensions/dash-to-dock/background-opacity extensions/dash-to-dock/dock-fixed \
    extensions/dash-to-dock/autohide extensions/dash-to-dock/intellihide \
    extensions/dash-to-dock/click-action extensions/dash-to-dock/show-trash \
    disable-user-extensions enabled-extensions; do
    path=/org/gnome/shell/$key
    grep -q "^$path " "$backup" || echo "$path $(dconf read "$path")" >> "$backup"
done

rm -rf "$dest"
sh "$here/tools/build.sh" "$dest"

gsettings set $dock dash-max-icon-size 52
gsettings set $dock transparency-mode FIXED
gsettings set $dock background-opacity 0.17

# User extensions load only with this off; GNOME Shell picks up a new
# extension folder at its next start.
gsettings set org.gnome.shell disable-user-extensions false

# Appends an item to an org.gnome.shell string list unless it is there.
append() {
    list=$(gsettings get org.gnome.shell "$1")
    case $list in
        *"'$2'"*) ;;
        "@as []") gsettings set org.gnome.shell "$1" "['$2']" ;;
        *) gsettings set org.gnome.shell "$1" "$(echo "$list" | sed "s/]\$/, '$2']/")" ;;
    esac
}
append enabled-extensions "$uuid"

# A Downloads launcher pinned to the dock; a click fans out its newest files.
apps=${XDG_DATA_HOME:-$HOME/.local/share}/applications
mkdir -p "$apps"
sed "s|@DOWNLOADS@|$(xdg-user-dir DOWNLOAD)|" "$here/mac-dock-downloads.desktop" > "$apps/mac-dock-downloads.desktop"
append favorite-apps mac-dock-downloads.desktop

echo "Installed to $dest"
echo "Restart GNOME Shell: on X11 press Alt+F2, type r, press Enter (Wayland: log out and back in)."

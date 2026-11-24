// SPDX-License-Identifier: GPL-3.0-or-later
// Added by ubuntu-dock-plus. What the top bar menu (panel.js) and the
// preferences window (prefs.js) share: the dock's own keys, how each choice
// maps onto them, and the two resets. It imports only gi://Gio, so both the
// shell and the preferences process can load it.
import Gio from 'gi://Gio';

export const DOCK_SCHEMA = 'org.gnome.shell.extensions.dash-to-dock';

export const ICON_SIZE = {min: 32, max: 64, step: 2};
export const MAGNIFY_PEAK = {min: 1, max: 1.8, step: 0.05};
export const GENIE_DURATION = {min: 200, max: 1500, step: 50};
export const BOUNCE_HEIGHT = {min: 8, max: 40, step: 1};

export function dockSettings() {
    return new Gio.Settings({schema_id: DOCK_SCHEMA});
}

// Rounds v to the nearest step inside [min, max].
export function snap(v, {min, max, step}) {
    return Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
}

// No delay()/apply() here: delay() keeps a Gio.Settings object in delayed
// mode for good, so every later write through it would wait for an apply().
// The preferences window puts its own objects in delay mode on purpose.

// Hiding: 'overlap' hides the dock only while a window covers it, 'auto'
// hides it until the pointer reaches the screen edge, 'never' keeps it.
export function getHide(dock) {
    if (dock.get_boolean('dock-fixed'))
        return 'never';
    if (dock.get_boolean('intellihide'))
        return 'overlap';
    return dock.get_boolean('autohide') ? 'auto' : 'never';
}

export function setHide(dock, mode) {
    dock.set_boolean('dock-fixed', mode === 'never');
    if (mode !== 'never') {
        dock.set_boolean('autohide', true);
        dock.set_boolean('intellihide', mode === 'overlap');
    }
}

// A click on a running app's icon: 'minimize' minimizes its window when it
// is already in front, 'raise' only brings it to the front.
export function getClick(dock) {
    return dock.get_string('click-action') === 'minimize' ? 'minimize' : 'raise';
}

export function setClick(dock, action) {
    dock.set_string('click-action', action === 'minimize' ? 'minimize' : 'focus-or-previews');
}

// The opacity applies only in the dock's fixed transparency mode.
export function setOpacity(dock, opacity) {
    dock.set_string('transparency-mode', 'FIXED');
    dock.set_double('background-opacity', opacity);
}

// The values install.sh sets up: this extension's defaults, 52 px icons,
// opacity 0.17, hiding only under windows, minimize on click, the Trash.
export function resetToInstalled(settings, dock) {
    settings.settings_schema.list_keys().forEach(key => settings.reset(key));
    dock.set_int('dash-max-icon-size', 52);
    dock.set_boolean('show-trash', true);
    setOpacity(dock, 0.17);
    setHide(dock, 'overlap');
    setClick(dock, 'minimize');
}

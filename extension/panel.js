// SPDX-License-Identifier: GPL-3.0-or-later
// Added by ubuntu-dock-plus. The dock icon in the top bar and its menu:
// sliders for the icon size and the magnification, the hiding and minimize
// effect choices, and a way to the preferences window. Every control writes
// its setting at once and follows the setting when something else changes
// it (the preferences window, gsettings).
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ICON_SIZE, MAGNIFY_PEAK, dockSettings, getHide, setHide, snap} from './dockSettings.js';
import {shellMajor, verticalBox} from './shellCompat.js';

export const DockIndicator = GObject.registerClass(
class DockIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, _('Dock'));
        this._extension = extension;
        this._settings = extension.getSettings();
        this._dock = dockSettings();
        this._syncing = false;

        this.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(`${extension.path}/icons/udp-dock-symbolic.svg`),
            style_class: 'system-status-icon',
        }));

        this._size = this._addSlider(_('Icon size'), ICON_SIZE,
            () => this._dock.get_int('dash-max-icon-size'),
            v => this._dock.set_int('dash-max-icon-size', v),
            v => `${v} px`);
        this._magnify = new PopupMenu.PopupSwitchMenuItem(_('Magnify on hover'), false);
        this._magnify.connect('toggled', (_item, on) => this._settings.set_boolean('magnify', on));
        this.menu.addMenuItem(this._magnify);
        this._peak = this._addSlider(_('Magnification'), MAGNIFY_PEAK,
            () => this._settings.get_double('magnify-peak'),
            v => this._settings.set_double('magnify-peak', v),
            v => `${v.toFixed(2)}×`);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Hide the dock')));
        this._hide = this._addChoices([
            ['overlap', _('When a window covers it')],
            ['auto', _('Always')],
            ['never', _('Never')],
        ], () => getHide(this._dock), mode => setHide(this._dock, mode));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Minimize effect')));
        this._effect = this._addChoices([
            ['genie', _('Genie')],
            ['scale', _('Scale')],
        ], () => (this._settings.get_boolean('genie') ? 'genie' : 'scale'),
        effect => this._settings.set_boolean('genie', effect === 'genie'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._prefs = this.menu.addAction(_('Dock Settings…'), () => extension.openPreferences());

        this._settings.connectObject('changed', () => this._sync(), this);
        this._dock.connectObject('changed', () => this._sync(), this);
        this._sync();
    }

    // A labeled slider for a numeric setting in range {min, max, step}.
    _addSlider(label, range, get, set, format) {
        const item = new PopupMenu.PopupBaseMenuItem({activate: false, style_class: 'udp-slider-item'});
        const box = new St.BoxLayout({
            ...verticalBox(shellMajor(Config.PACKAGE_VERSION), Clutter.Orientation),
            x_expand: true,
        });
        const top = new St.BoxLayout();
        top.add_child(new St.Label({text: label, x_expand: true}));
        // Dimmed like a secondary label, in any theme.
        const value = new St.Label({opacity: 160});
        top.add_child(value);
        const slider = new Slider(0);
        slider.accessible_name = label;
        box.add_child(top);
        box.add_child(slider);
        item.add_child(box);
        slider.connect('notify::value', () => {
            if (this._syncing)
                return;
            const v = snap(range.min + slider.value * (range.max - range.min), range);
            if (v !== get())
                set(v);
            value.text = format(v);
        });
        this.menu.addMenuItem(item);
        return {
            item, slider,
            sync: () => {
                const v = get();
                slider.value = (v - range.min) / (range.max - range.min);
                value.text = format(v);
            },
        };
    }

    // Radio items, one of which shows a dot.
    _addChoices(choices, get, set) {
        const items = choices.map(([choice, label]) => {
            const item = this.menu.addAction(label, () => set(choice));
            item._udpChoice = choice;
            return item;
        });
        return {
            items,
            sync: () => {
                const current = get();
                items.forEach(item => item.setOrnament(item._udpChoice === current
                    ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE));
            },
        };
    }

    _sync() {
        this._syncing = true;
        try {
            this._size.sync();
            this._magnify.setToggleState(this._settings.get_boolean('magnify'));
            this._peak.sync();
            // setSensitive() does not reach the slider of an item that
            // cannot be activated, so dim and lock the slider itself.
            const magnify = this._settings.get_boolean('magnify');
            this._peak.slider.reactive = magnify;
            this._peak.item.opacity = magnify ? 255 : 110;
            this._hide.sync();
            this._effect.sync();
        } finally {
            this._syncing = false;
        }
    }
});

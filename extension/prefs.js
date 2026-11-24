// SPDX-License-Identifier: GPL-3.0-or-later
// Added by ubuntu-dock-plus. The preferences window, opened from the top bar
// menu: Appearance, Effects, Behavior and Stacks pages. Changes wait in the
// window until Apply or OK saves them; Cancel or closing the window drops
// them. Each page ends with Reset, Cancel, Apply and OK.
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    BOUNCE_HEIGHT, GENIE_DURATION, ICON_SIZE, MAGNIFY_PEAK, dockSettings, getClick, getHide,
    resetToInstalled, setClick, setHide, setOpacity, snap,
} from './dockSettings.js';

export default class DockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const dock = dockSettings();
        // The window keeps both alive as long as it is open. In delay mode
        // their writes wait for apply(); the rows read the waiting values.
        window._udpSettings = [settings, dock];
        settings.delay();
        dock.delay();
        const pending = () => settings.has_unapplied || dock.has_unapplied;
        window.set_default_size(620, 720);
        // Follows a setting until the window closes.
        const watch = (source, sync) => {
            const id = source.connect('changed', sync);
            window.connect('close-request', () => source.disconnect(id));
        };

        // A row with a slider for a numeric setting in range {min, max, step}.
        const sliderRow = (title, range, digits, get, set, source) => {
            const row = new Adw.ActionRow({title});
            const scale = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, range.min, range.max, range.step);
            scale.set({digits, draw_value: true, value_pos: Gtk.PositionType.RIGHT, hexpand: true,
                width_request: 260, valign: Gtk.Align.CENTER});
            let syncing = false;
            const sync = () => {
                syncing = true;
                scale.set_value(get());
                syncing = false;
            };
            scale.connect('value-changed', () => {
                if (syncing)
                    return;
                const v = snap(scale.get_value(), range);
                if (v !== get())
                    set(v);
            });
            watch(source, sync);
            sync();
            row.add_suffix(scale);
            return row;
        };

        const switchRow = (title, subtitle, source, key) => {
            const row = new Adw.SwitchRow({title, subtitle});
            source.bind(key, row, 'active', 0);
            return row;
        };

        // A drop-down row for a setting with a few choices, [value, label].
        const comboRow = (title, subtitle, choices, get, set, source) => {
            const row = new Adw.ComboRow({title, subtitle, model: Gtk.StringList.new(choices.map(([, label]) => label))});
            let syncing = false;
            const sync = () => {
                syncing = true;
                row.selected = Math.max(0, choices.findIndex(([value]) => value === get()));
                syncing = false;
            };
            row.connect('notify::selected', () => {
                if (!syncing)
                    set(choices[row.selected][0]);
            });
            watch(source, sync);
            sync();
            return row;
        };

        const group = (title, rows) => {
            const g = new Adw.PreferencesGroup({title});
            rows.forEach(row => g.add(row));
            return g;
        };

        // Reset on the left; Cancel, Apply and OK on the right. Apply and
        // OK only work while a change waits.
        const buttonGroup = () => {
            const g = new Adw.PreferencesGroup();
            const box = new Gtk.Box({spacing: 8});
            const reset = new Gtk.Button({label: _('Reset to Defaults'), hexpand: true, halign: Gtk.Align.START});
            reset.connect('clicked', () => resetToInstalled(settings, dock));
            const cancel = new Gtk.Button({label: _('Cancel')});
            cancel.connect('clicked', () => window.close());
            const apply = new Gtk.Button({label: _('Apply')});
            apply.connect('clicked', () => {
                settings.apply();
                dock.apply();
            });
            const ok = new Gtk.Button({label: _('OK'), css_classes: ['suggested-action']});
            ok.connect('clicked', () => {
                settings.apply();
                dock.apply();
                window.close();
            });
            const sync = () => {
                apply.sensitive = pending();
                ok.sensitive = pending();
            };
            [settings, dock].forEach(source => {
                const id = source.connect('notify::has-unapplied', sync);
                window.connect('close-request', () => source.disconnect(id));
            });
            sync();
            [reset, cancel, apply, ok].forEach(button => box.append(button));
            g.add(box);
            return g;
        };

        const page = (title, iconName, groups) => {
            const p = new Adw.PreferencesPage({title, icon_name: iconName});
            groups.forEach(g => p.add(g));
            p.add(buttonGroup());
            window.add(p);
        };

        // Appearance
        const peakRow = sliderRow(_('Magnification'), MAGNIFY_PEAK, 2,
            () => settings.get_double('magnify-peak'), v => settings.set_double('magnify-peak', v), settings);
        peakRow.subtitle = _('Large icons stay smaller, to fit inside the dock');
        settings.bind('magnify', peakRow, 'sensitive', 0);
        page(_('Appearance'), 'preferences-desktop-appearance-symbolic', [
            group(_('Icons'), [
                sliderRow(_('Icon size'), ICON_SIZE, 0,
                    () => dock.get_int('dash-max-icon-size'), v => dock.set_int('dash-max-icon-size', v), dock),
                switchRow(_('Magnify on hover'), _('Icons grow under the pointer'), settings, 'magnify'),
                peakRow,
            ]),
            group(_('Background'), [
                sliderRow(_('Opacity'), {min: 0, max: 1, step: 0.01}, 2,
                    () => dock.get_double('background-opacity'), v => setOpacity(dock, v), dock),
            ]),
            group(_('Indicators'), [
                switchRow(_('Dots under running apps'), null, settings, 'show-dots'),
                switchRow(_('Show Trash'), null, dock, 'show-trash'),
            ]),
        ]);

        // Effects
        const durationRow = sliderRow(_('Genie duration (ms)'), GENIE_DURATION, 0,
            () => settings.get_int('genie-duration'), v => settings.set_int('genie-duration', v), settings);
        settings.bind('genie', durationRow, 'sensitive', 0);
        page(_('Effects'), 'applications-graphics-symbolic', [
            group(_('Windows'), [
                comboRow(_('Minimize effect'), _('Also used when a window opens or is restored'),
                    [['genie', _('Genie')], ['scale', _('Scale')]],
                    () => (settings.get_boolean('genie') ? 'genie' : 'scale'),
                    v => settings.set_boolean('genie', v === 'genie'), settings),
                durationRow,
            ]),
            group(_('Bounce'), [
                switchRow(_('Bounce while an app launches'), null, settings, 'launch-bounce'),
                switchRow(_('Bounce when a running app is clicked'), null, settings, 'click-bounce'),
                switchRow(_('Bounce when an app asks for attention'), null, settings, 'attention-bounce'),
                sliderRow(_('Bounce height (px)'), BOUNCE_HEIGHT, 0,
                    () => settings.get_int('bounce-height'), v => settings.set_int('bounce-height', v), settings),
            ]),
        ]);

        // Behavior
        page(_('Behavior'), 'preferences-system-symbolic', [
            group(_('Dock'), [
                comboRow(_('Hide the dock'), null, [
                    ['overlap', _('When a window covers it')],
                    ['auto', _('Always')],
                    ['never', _('Never')],
                ], () => getHide(dock), v => setHide(dock, v), dock),
                comboRow(_('Click on a running app'), null, [
                    ['minimize', _('Minimize or bring to front')],
                    ['raise', _('Bring to front')],
                ], () => getClick(dock), v => setClick(dock, v), dock),
            ]),
        ]);

        // GPL-3.0 section 5(d): an interactive interface shows the legal
        // notices.
        const about = new Adw.PreferencesGroup({title: _('About')});
        about.add(new Gtk.Label({
            label: _('ubuntu-dock-plus %s, based on Dock Glass by atarico.\nFree software under the GNU General Public License, version 3 or later. It comes with ABSOLUTELY NO WARRANTY.')
                .replace('%s', this.metadata['version-name'] ?? ''),
            wrap: true,
            xalign: 0,
            css_classes: ['dim-label'],
        }));

        // Stacks
        page(_('Stacks'), 'folder-symbolic', [
            group(_('Stacks'), [
                comboRow(_('View'), _('Files and Downloads open as'), [
                    ['fan', _('Fan')],
                    ['grid', _('Grid')],
                ], () => settings.get_string('stack-view'), v => settings.set_string('stack-view', v), settings),
                comboRow(_('Downloads order'), null, [
                    ['added', _('Newest first')],
                    ['name', _('Name')],
                ], () => settings.get_string('stack-sort'), v => settings.set_string('stack-sort', v), settings),
            ]),
            about,
        ]);
    }
}

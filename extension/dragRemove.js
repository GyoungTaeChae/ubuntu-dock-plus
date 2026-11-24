// SPDX-License-Identifier: GPL-3.0-or-later
// Added by ubuntu-dock-plus. Unpinning like the macOS Dock: drag a pinned
// app's icon off the dock and hold it there; after a moment a "Remove" label
// shows above it, and letting go then unpins the app with a puff of smoke.
// Letting go sooner, or back over the dock, keeps it pinned.
//
// While such a drag runs, a transparent drop target covers the windows and
// the desktop, under the dock and the top bar, the way GNOME's Show Apps
// icon takes a drop to unpin. A drop it accepts ends the drag cleanly: GNOME
// destroys the dragged icon where it was dropped instead of sliding it back.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

// How long the icon must stay off the dock before letting go removes it.
const HOLD_MS = 800;
const PUFF_MS = 420;
const PUFF_PARTS = 8;
// The label sits this far above the pointer, over the dragged icon.
const LABEL_RISE_PX = 70;

export class DragRemove {
    // isDockButton(source): whether a drag source is one of the dock's app
    // icons. isOverDock(x, y): whether a stage point is over a dock.
    constructor({isDockButton, isOverDock}) {
        this._isDockButton = isDockButton;
        this._isOverDock = isOverDock;
        this._target = null;
    }

    enable() {
        Main.overview.connectObject(
            'item-drag-begin', (_overview, source) => this._begin(source),
            'item-drag-end', () => this._end(),
            'item-drag-cancelled', () => this._end(),
            this);
    }

    disable() {
        Main.overview.disconnectObject(this);
        this._end();
    }

    get armed() {
        return Boolean(this._target?.armed);
    }

    _begin(source) {
        this._end();
        const app = source?.app;
        if (!app || !this._isDockButton(source) || !global.settings.is_writable('favorite-apps') ||
            !AppFavorites.getAppFavorites().isFavorite(app.get_id()))
            return;

        const actor = new St.Widget({x: 0, y: 0, width: global.stage.width, height: global.stage.height});
        Main.layoutManager.uiGroup.insert_child_above(actor, global.window_group);
        const target = {actor, app, armed: false, timeoutId: 0, label: null, x: 0, y: 0};
        actor._delegate = {
            handleDragOver: () => (target.armed ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.CONTINUE),
            acceptDrop: (_source, dragActor, x, y) => this._drop(target, dragActor, x, y),
        };
        // Motion only arrives while the pointer moves; the hold is timed by
        // a timer, so holding still off the dock still arms it.
        target.monitor = {
            dragMotion: event => {
                this._move(target, event.x, event.y);
                return DND.DragMotionResult.CONTINUE;
            },
        };
        DND.addDragMonitor(target.monitor);
        this._target = target;
    }

    _move(target, x, y) {
        target.x = x;
        target.y = y;
        if (this._isOverDock(x, y)) {
            this._disarm(target);
            return;
        }
        target.label?.set_position(Math.round(x - target.label.width / 2), Math.round(y - LABEL_RISE_PX));
        if (target.armed || target.timeoutId)
            return;
        target.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOLD_MS, () => {
            target.timeoutId = 0;
            this._arm(target);
            return GLib.SOURCE_REMOVE;
        });
    }

    _arm(target) {
        target.armed = true;
        target.label = new St.Label({text: _('Remove'), style_class: 'udp-remove-label'});
        Main.layoutManager.uiGroup.add_child(target.label);
        target.label.set_position(Math.round(target.x - target.label.width / 2),
            Math.round(target.y - LABEL_RISE_PX));
        // Show the drop cursor without waiting for the next motion.
        global.display.set_cursor(Meta.Cursor.DND_MOVE);
    }

    _disarm(target) {
        if (target.timeoutId)
            GLib.source_remove(target.timeoutId);
        target.timeoutId = 0;
        target.armed = false;
        target.label?.destroy();
        target.label = null;
    }

    _drop(target, dragActor, x, y) {
        if (!target.armed)
            return false;
        const id = target.app.get_id();
        this._puff(target.app, dragActor, x, y);
        this._disarm(target);
        // Unpinning rebuilds the dock, which would destroy the drag source in
        // the middle of the drop; do it right after, like GNOME's Show Apps.
        global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
            AppFavorites.getAppFavorites().removeFavorite(id);
            return GLib.SOURCE_REMOVE;
        });
        return true;
    }

    // The icon shrinks away where it was dropped while a ring of small
    // clouds swells and fades around it. Each part goes on the stage before
    // it eases: GNOME skips the animation of an actor that is not mapped.
    _puff(app, dragActor, x, y) {
        const size = Math.round(dragActor?.width || 64);
        const icon = app.create_icon_texture(size);
        const parts = [icon];
        for (let i = 0; i < PUFF_PARTS; i++)
            parts.push(new St.Widget({style_class: 'udp-puff', width: 22, height: 22}));
        parts.forEach(part => {
            Main.layoutManager.uiGroup.add_child(part);
            part.pivot_point = new Graphene.Point({x: 0.5, y: 0.5});
        });
        icon.set_position(x - size / 2, y - size / 2);
        icon.ease({
            scale_x: 0,
            scale_y: 0,
            opacity: 0,
            duration: PUFF_MS / 2,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
        parts.slice(1).forEach((cloud, i) => {
            const angle = 2 * Math.PI * i / PUFF_PARTS;
            cloud.set_position(x - 11 + Math.cos(angle) * 8, y - 11 + Math.sin(angle) * 8);
            cloud.ease({
                translation_x: Math.cos(angle) * 34,
                translation_y: Math.sin(angle) * 34,
                scale_x: 1.8,
                scale_y: 1.8,
                opacity: 0,
                duration: PUFF_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                // The last part to finish takes all of them away.
                onStopped: i === 0 ? () => parts.forEach(part => part.destroy()) : undefined,
            });
        });
    }

    _end() {
        const target = this._target;
        if (!target)
            return;
        this._target = null;
        this._disarm(target);
        DND.removeDragMonitor(target.monitor);
        target.actor.destroy();
    }
}

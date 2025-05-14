const { app, action, core } = require("photoshop");
import { createLogger } from '../helpers/logger.js';
const logger = createLogger({ prefix: 'LinkKeyListener', initialLevel: 'DEBUG' });
///////////unfinished - want to eventually make this work with the key listener

class LinkKeyListener {
    constructor(options = {}) {
        Object.assign(this, options)
        this.HOTKEY = 'KeyL';        // the physical key    (⇧ etc. handled below)
        this.WITH_ALT = true;          // e.g. Alt+L

        this.selectHandler = this.selectHandler.bind(this);
        this.selectionPoll = null;
        this.linksCreatedWhileHeld = [];
    }
    linkActiveLayers = async () => {
        const { activeDocument: doc } = ps.app;
        const layers = doc.activeLayers;
        if (layers.length < 2) { return; }           // nothing to do

        await core.executeAsModal(async () => {
            const base = layers[0];
            for (let i = 1; i < layers.length; i++) {
                const newlyLinked = base.link(layers[i]);     // DOM API call
                linksCreatedThisHold.push(...newlyLinked);
            }
        }, { commandName: 'link layers (hold-key)' });
    };

    unlinkThoseLayers = async () => {
        if (!linksCreatedThisHold.length) { return; }
        await core.executeAsModal(async () => {
            linksCreatedThisHold.forEach(l => l.unlink());
            linksCreatedThisHold.length = 0;                // clear list
        }, { commandName: 'unlink layers (key-up)' });
    };

    destroy() {

    }
}

export { LinkKeyListener };

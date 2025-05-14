// src/js/actions/linkSelectedLayers.js
import { toggleHistory } from '../helpers/helpers.js';
const { app, action, core } = require("photoshop");

/**
 * Link/unlink all selected layers.
 *
 * @param {Layer[]} selectLayers   – layers whose names you want linked
 * @param {boolean} toggle – whether to link or unlink
 * @returns {Promise<{ unlinked: number, linked: number }>}
 */
const linkSelectedLayers = async (selectLayers, toggle) => {
    try {
        const result = await core.executeAsModal(async (executionContext) => {
            console.log(`${toggle ? 'Linking' : 'Unlinking'} Selected Layers: `, selectLayers.map(l => l.name));
            const anchorLayer = selectLayers[0];
            selectLayers.shift();
            await toggleHistory(executionContext.hostControl, "suspend", app.activeDocument.id, selectLayers.length === 0 ? "Auto Unlink Layers" : "Auto Link Layers");

            const results = await Promise.all(selectLayers.map(async layer => {
                console.log("linking", layer.name, "to", anchorLayer.name);
                try {
                    await toggle ? layer.link(anchorLayer) : layer.unlink(anchorLayer);
                    return { success: true, message: `layer ${layer.name} ${toggle ? 'linked' : 'unlinked'} successfully`, count: 1 };
                } catch (error) {
                    console.error(error);
                    return { success: false, message: error.message, count: 0 };
                }
            }));
            console.log(results);
            await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
            // return counts for feedback
            return { success: true, message: `layers ${toggle ? 'linked' : 'unlinked'} successfully`, count: selectLayers.length };
        }, { "commandName": "Update Linked Layers Based on Selected Layers" });

        return result;
    } catch (error) {
        console.error(error);
        return { success: false, message: error.message, count: 0 };
    }

}

export { linkSelectedLayers };

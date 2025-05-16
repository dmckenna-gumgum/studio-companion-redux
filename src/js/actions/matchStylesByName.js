import { core, app } from "photoshop";
import { findGroupsWithFailures, getLayersByName, toggleHistory } from "../helpers/helpers.js";
import { applyLayerStyleToMatchingLayers } from "./applyLayerStyleToMatchingLayers.js";
/**
 * Copy every layer-style (FX) from `sourceLayer`
 * to every other layer with the same `.name`.
 *
 * @param {Layer} sourceLayer – the layer whose styles you want to clone
 */
async function matchStylesByName(filter, sourceLayer = app.activeDocument.activeLayers[0]) {
    const result = await core.executeAsModal(async (executionContext) => {
        try {
            const { validGroups } = findGroupsWithFailures(app.activeDocument.layers, null, filter);
            console.log('source layer', sourceLayer, 'target artboards', validGroups);
            const targetLayers = getLayersByName([sourceLayer.name], validGroups);

            await toggleHistory(executionContext.hostControl, "suspend", app.activeDocument.id, "Match Styles By Name");
            const result = await applyLayerStyleToMatchingLayers(sourceLayer, targetLayers);
            await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
            return { success: true, message: `Matched styles for ${result.length} layers`, result: result };
        } catch (error) {
            console.error(error);
            return { success: false, message: error.message };
        }
    }, { commandName: "Match Styles By Name" });
    return result;
}

export { matchStylesByName };
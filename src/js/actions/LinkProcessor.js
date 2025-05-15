// src/js/actions/linkLayersByName.js
import { findValidGroups, toggleHistory, findGroupsWithFailures } from '../helpers/helpers.js';
const { app, action, core } = require("photoshop");
const { batchPlay } = action;

let _lastLayers = [];
/**
 * Recursively flatten a layer tree into a single array.
 * @param {Layer[]} layers
 * @param {Layer[]} [acc=[]]
 * @returns {Layer[]}
 */
const collectAllLayers = (layers, acc = []) => {
    layers.forEach(layer => {
        acc.push(layer);
        if (layer.layers && layer.layers.length) {
            collectAllLayers(layer.layers, acc);
        }
    });
    return acc;
}

/**
 * Given an array of names, return every Layer in the document
 * whose .name matches one of them.
 * @param {string[]} names
 * @returns {Layer[]}
 */
const getLayersByName = (names, artboard) => {
    const all = collectAllLayers(artboard);
    return all.filter(layer => names.includes(layer.name));
}


/**
 * Unlink every layer whose name is in `deselectNames`
 * but NOT also in `selectNames`.
 * @param {string[]} deselectNames
 * @param {string[]} selectNames
 */
const processUnlinkLayers = async (unlinkNames, invalidBoards) => {
    const layersToUnlink = invalidBoards.filter(layer => unlinkNames.includes(layer.name));
    return await Promise.all(layersToUnlink.map(async layer => {
        console.log("unlinking", layer.name);
        return await layer.unlink();
    }));
}

/**
 * Link every layer whose name is in `selectNames`.
 * @param {string[]} selectNames
 */
const processLinkLayers = async (selectNames, layers) => {
    const layersToLink = getLayersByName(selectNames, layers);
    const anchorLayer = layersToLink[0];
    layersToLink.shift()
    return await Promise.all(layersToLink.map(async layer => {
        console.log("linking", layer.name, "to", anchorLayer.name);
        // layer.selected = true;
        return await layer.link(anchorLayer);
    }));
}

const UnlinkAllLayers = async (artboards) => {
    console.log("Unlinking All Layers in:", artboards.map(a => a.name));
    return await Promise.all(artboards.map(async artboard => {
        console.log("unlinking", artboard.name);
        // layer.selected = false;
        return artboard.layers.map(async layer => {
            console.log("unlinking", layer.name);
            return await layer.unlink();
        })
    }));
}


/**
 * Link/unlink all layers by matching names.
 *-
 * 1. Unlink any layer named in `deselectLayers` that isn’t also in `selectLayers`  
 * 2. Once that finishes, link every layer named in `selectLayers`
 *
 * @param {Layer[]} selectLayers   – layers whose names you want linked
 * @param {Layer[]} deselectLayers – layers whose names you want unlinked
 * @returns {Promise<{ unlinked: number, linked: number }>}
 */
const LinkByArrayOfLayers = async (toLink, toUnlink, toUnchange, filters = null) => {
    const result = await core.executeAsModal(async (executionContext) => {
        try {
            console.log("Linking layers active");
            const { validGroups, invalidGroups } = filters === null ? app.activeDocument.layers : await findGroupsWithFailures(app.activeDocument.layers, null, filters);
            console.log("Viable artboards:", validGroups.map(g => g.name), "Invalid artboards:", invalidGroups.map(g => g.name));


            const namesToLink = toLink.map(l => l.name);
            const namesToUnlink = toUnlink.map(l => l.name);
            const namesToCheck = toUnchange.map(l => l.name);

            const linkResult = { unlinked: 0, linked: 0 };

            await toggleHistory(executionContext.hostControl, "suspend", app.activeDocument.id, namesToLink.length === 0 ? "Auto Unlink Layers" : "Auto Link Layers");

            const results = await Promise.all([
                //unlink all layers that are no longer selected. 
                processUnlinkLayers(namesToUnlink, app.activeDocument.layers),

                //only layers still linked are layers from prior selection events across valid and invalid artboards.
                //so unlink any that are in invalid groups
                processUnlinkLayers(namesToCheck, invalidGroups),

                //now the only layers still linked are existing selections across valid groups
                //so now we just need to add any new selections to the linked layers from valid groups
                processLinkLayers(namesToLink, validGroups)
            ]);
            await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
            // // return counts for feedback   
            // linkResult.unlinked = results[0].length;
            // linkResult.linked = results[2].length;
            return { success: true, message: "AutoLink completed successfully", results: results };
        } catch (error) {
            console.error("Error cycling layer linkage:", error);
            return { success: false, message: error.message };
        }
    }, { "commandName": "Update Linked Layers Based on Selected Layers" });

    return result;
}

export { LinkByArrayOfLayers, UnlinkAllLayers };

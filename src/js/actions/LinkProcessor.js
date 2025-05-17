// src/js/actions/linkLayersByName.js
import { findValidGroups, toggleHistory, findGroupsWithFailures, collectAllLayers, getLayersByName } from '../helpers/helpers.js';
const { app, action, core } = require("photoshop");
const { batchPlay } = action;

import store from '../../store/index.js';
import { linkLayers, unlinkLayers } from '../../store/actions/editorActions.js';

/**
 * Unlink every layer whose name is in `deselectNames`
 * but NOT also in `selectNames`.
 * @param {string[]} deselectNames
 * @param {string[]} selectNames
 */
const processUnlinkLayers = async (unlinkNames, invalidBoards) => {
    const layersToUnlink = getLayersByName(unlinkNames, invalidBoards); ///gets all layers across all invalid boards with names matching the ones in unlinkNames array. 
    // console.log('layers to unlink: ', layersToUnlink.map(l => [l.id, l.name, l.linked, l.parent.name]));
    const unlinkResults = await Promise.all(layersToUnlink.map(async layer => {
        // console.log("unlinking", layer.name);
        await layer.unlink();
        return { id: layer.id, name: layer.name, artboard: layer.parent.name };
    }));
    return { unlinked: unlinkResults };
}

// /**
//  * Link every layer whose name is in `selectNames`.
//  * @param {string[]} selectNames
//  */
const processLinkLayers = async (selectNames, validBoards) => {
    // console.log('checking for layers to link in: ', validBoards.map(g => g.name));
    const layersToLink = getLayersByName(selectNames, validBoards);
    try {
        const linkResults = await Promise.all(layersToLink.map(async layer => {
            await layer.unlink(); //this shouldn't be necessary but certain filter change sequences
            //results in a situation where two of the layer instances are linked to each other separate from the rest. 
            //I'll give anyone $100 if they can figure out why.
            await layer.link(layersToLink[0]);
            return { id: layer.id, name: layer.name, artboard: layer.parent.name };
        }));
        // await applyLinkStyle(layersToLink);
        return { linked: linkResults };
    } catch (error) {
        console.error("Error linking layers:", error);
        return { success: false, message: error.message };
    }
}


const UnlinkAllLayers = async (layers) => {
    const namesToUnlink = layers.map(l => l.name);
    const layerCheckForUnlink = getLayersByName(namesToUnlink, app.activeDocument.layers);
    try {
        const result = await core.executeAsModal(async (executionContext) => {
            await toggleHistory(executionContext.hostControl, "suspend", app.activeDocument.id, "Unlink All Layers");
            const unlinkResults = await Promise.all(layerCheckForUnlink.map(async layer => {
                await layer.unlink();
                return { id: layer.id, name: layer.name, artboard: layer.parent.name };
            }));
            await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
            return unlinkResults;
        }, { "commandName": "Unlink All Layers" });
        return { success: true, message: `Unlinked ${result.length} Layers`, results: result };
    } catch (error) {
        console.error(error);
        return { success: false, message: `Error unlinking ${layerCheckForUnlink.length} Layers: ${error.message}` };
    }
}


// New Redux-connected functions
export const linkSelectedLayersRedux = () => {
    const state = store.getState();
    const layers = state.editor.currentSelection.layers;

    if (layers.length > 0) {
        store.dispatch(linkLayers(layers));
    }
};

export const unlinkSelectedLayersRedux = () => {
    const state = store.getState();
    const layers = state.editor.currentSelection.layers;

    if (layers.length > 0) {
        store.dispatch(unlinkLayers(layers));
    }
};


/**
 * Link/unlink all layers by matching names.
 *
 * 1. Unlink any layer named in `deselectLayers` that isn't also in `selectLayers`  
 * 2. Once that finishes, link every layer named in `selectLayers`
 *
 * @param {Layer[]} selectLayers   – layers whose names you want linked
 * @param {Layer[]} deselectLayers – layers whose names you want unlinked
 * @returns {Promise<{ unlinked: number, linked: number }>}
 */
export const LinkByArrayOfLayers = async (toLink, toUnlink, toUnchange, filters = null) => {
    const result = await core.executeAsModal(async (executionContext) => {
        try {
            // console.log("Linking layers active");
            const { validGroups, invalidGroups } = filters === null ? app.activeDocument.layers : await findGroupsWithFailures(app.activeDocument.layers, null, filters);
            // console.log("Viable artboards:", validGroups.map(g => g.name), "Invalid artboards:", invalidGroups.map(g => g.name));
            console.log("(LinkProcessor) Valid Groups:", validGroups.map(group => group.name), "Invalid Groups:", invalidGroups.map(group => group.name));

            const namesToLink = toLink.map(l => l.name);
            const namesToUnlink = toUnlink.map(l => l.name);
            const namesToCheck = toUnchange.map(l => l.name);
            await toggleHistory(executionContext.hostControl, "suspend", app.activeDocument.id, namesToLink.length === 0 ? "Auto Unlink Layers" : "Auto Link Layers");
            // console.log("Linking Newly Selected Layers", namesToLink, "\nUnlinking Deselected Layers", namesToUnlink, "\nChecking If Remaining Selected Layers are in Valid Boards:", namesToCheck);
            //const results = await Promise.all([
            //unlink all layers that are no longer selected. 
            //processUnlinkLayers(namesToUnlink, app.activeDocument.layers),

            //only layers still linked are layers from prior selection events across valid and invalid artboards.
            //so unlink any that are in invalid groups
            try {
                const linkResults = await processLinkLayers([...namesToLink, ...namesToCheck], validGroups);
                const unlinkResults = await processUnlinkLayers([...namesToCheck, ...namesToUnlink], invalidGroups);

                //now the only layers still linked are new selections and existing selections across valid groups
                //so now we just need to add any new selections to the linked layers from valid groups
                //Im passing the existing selection in here as well just in case they aren't already checked.
                //]);
                await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
                const results = { unlinked: unlinkResults, linked: linkResults };
                return { success: true, message: "AutoLink completed successfully", results: results };
            } catch (error) {
                console.error("Error linking layers:", error);
                await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
                return { success: false, message: error.message };
            }
            await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
            // // return counts for feedback   
            // linkResult.unlinked = results[0].length;
            // linkResult.linked = results[2].length;
        } catch (error) {
            console.error("Error cycling layer linkage:", error);
            return { success: false, message: error.message };
        }
    }, { "commandName": "Update Linked Layers Based on Selected Layers" });

    return result;
}

export { UnlinkAllLayers };
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
        const linkResults = await Promise.all(layersToLink.slice(1).map(async layer => {
            await layer.unlink(); //this shouldn't be necessary but certain filter change sequences
            //results in a situation where two of the layer instances are linked to each other separate from the rest. 
            //I'll give anyone $100 if they can figure out why.
            await layer.link(layersToLink[0]);
            return { id: layer.id, name: layer.name, artboard: layer.parent.name };
        }));
        return { linked: linkResults };
    } catch (error) {
        console.error("Error linking layers:", error);
        return { success: false, message: error.message };
    }
}

//ALTERNATIVE SOLUTION THAT CHATGPT SUGGESTED BUT IS JUST A LESS PERFORMANT VERSION OF THE CURRENT APPROACH.
// /**
//  * *
//  * @param {string[]} selectNames        – names you want linked together
//  * @param {Layer[]}  validBoards        – groups / artboards to search in
//  * @returns {Promise<{linked: {id,name,artboard}[]}>}
//  */
// const processLinkLayers = async (selectNames, validBoards) => {
//     // Gather matching layers in the valid boards
//     const layersToLink = getLayersByName(selectNames, validBoards);
//     if (!layersToLink.length) return { linked: [] };      // nothing to do

//     const anchor = layersToLink[0];                      // first match = pivot
//     const linkResults = [];

//     /* ---------- PASS 1: unlink everyone (anchor last) ---------- */
//     for (const layer of layersToLink) {
//         if (layer !== anchor) await layer.unlink();        // break old chains
//     }
//     await anchor.unlink();                               // ensure anchor solo

//     /* ---------- PASS 2: link everyone to the anchor ----------- */
//     for (const layer of layersToLink) {
//         if (layer !== anchor) await layer.link(anchor);    // attach to anchor

//         linkResults.push({
//             id: layer.id,
//             name: layer.name,
//             artboard: layer.parent.name
//         });
//     }

//     return { linked: linkResults };
// };

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

export { LinkByArrayOfLayers, UnlinkAllLayers };

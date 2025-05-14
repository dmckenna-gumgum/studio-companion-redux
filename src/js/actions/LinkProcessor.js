// src/js/actions/linkLayersByName.js
import { findValidGroups, toggleHistory } from '../helpers/helpers.js';
const { app, action, core } = require("photoshop");
const { batchPlay } = action;


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
const getLayersByName = (names, layers) => {
    const all = collectAllLayers(layers);
    return all.filter(layer => names.includes(layer.name));
}

/**
 * Unlink every layer whose name is in `deselectNames`
 * but NOT also in `selectNames`.
 * @param {string[]} deselectNames
 * @param {string[]} selectNames
 */
const processUnlinkLayers = async (deselectNames, selectNames, layers) => {
    // only unlink names that aren’t also being linked
    const namesToUnlink = deselectNames.filter(n => !selectNames.includes(n));
    if (!namesToUnlink.length) return;

    const layersToUnlink = getLayersByName(namesToUnlink, layers);
    if (!layersToUnlink.length) return;
    const anchorLayer = layersToUnlink[0];
    layersToUnlink.shift()
    return await Promise.all(layersToUnlink.map(async layer => {
        console.log("unlinking", layer.name, "from", anchorLayer.name);
        // layer.selected = false;
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

/**
 * Link/unlink all layers by matching names.
 *
 * 1. Unlink any layer named in `deselectLayers` that isn’t also in `selectLayers`  
 * 2. Once that finishes, link every layer named in `selectLayers`
 *
 * @param {Layer[]} selectLayers   – layers whose names you want linked
 * @param {Layer[]} deselectLayers – layers whose names you want unlinked
 * @returns {Promise<{ unlinked: number, linked: number }>}
 */
const LinkByArrayOfLayers = async (selectLayers, deselectLayers, filters = null) => {
    const result = await core.executeAsModal(async (executionContext) => {

        const possibleLayers = filters === null ? app.activeDocument.layers : findValidGroups(app.activeDocument.layers, null, filters);
        console.log("Possible layers:", possibleLayers.map(l => l.name));
        const selectNames = selectLayers.map(l => l.name);
        const deselectNames = deselectLayers.map(l => l.name);
        console.log("Unlinking", deselectNames, "Then Linking", selectNames);

        await toggleHistory(executionContext.hostControl, "suspend", app.activeDocument.id, selectLayers.length === 0 ? "Auto Unlink Layers" : "Auto Link Layers");
        await processUnlinkLayers(deselectNames, selectNames, possibleLayers);
        await processLinkLayers(selectNames, possibleLayers);
        await toggleHistory(executionContext.hostControl, "resume", app.activeDocument.id);
        // return counts for feedback
        const unlinkedCount = deselectNames.filter(n => !selectNames.includes(n)).length;
        const linkedCount = selectNames.length;
        return { unlinked: unlinkedCount, linked: linkedCount };
    }, { "commandName": "Update Linked Layers Based on Selected Layers" });
}

export { LinkByArrayOfLayers };

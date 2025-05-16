import { core, action } from "photoshop";
const batchPlay = action.batchPlay;

/**
 * Copy every layer-style (FX) from `sourceLayer`
 * to every other layer with the same `.name`.
 *
 * @param {Layer} sourceLayer – the layer whose styles you want to clone
 */
async function applyLayerStyleToMatchingLayers(sourceLayer, targetLayers) {
    const result = await core.executeAsModal(async (executionContext) => {
        const layerEffects = await getLayerStyle(sourceLayer);
        if (!layerEffects) {
            console.warn("Source layer has no layer styles.");
            return;
        }
        console.log("Layer Effects:", layerEffects);
        if (!targetLayers.length) {
            console.info("No other layers share that name.");
            return;
        }
        try {
            const cmds = targetLayers.map(layer => buildSetCommand(layer, layerEffects));
            await batchPlay(cmds, { synchronousExecution: false });
            console.log(`Applied styles to ${targetLayers.length} layer(s).`);
        } catch (error) {
            console.error(error);
            return error;
        }
    }, { commandName: "Clone Layer Styles by Name" });
    return result;
}

const buildSetCommand = (layer, layerEffects) => ({
    _obj: "set",
    _target: [
        { _ref: "property", _property: "layerEffects" },
        { _ref: "layer", _id: layer.id }
    ],
    to: layerEffects
});

const getLayerStyle = async (layer) => {
    console.log('layer', layer);
    try {
        const fxCommand = {
            _obj: "get",
            _target: [
                { _property: "layerEffects" },
                { _ref: "layer", _id: layer.id }
            ]
        }
        console.log('layer effects command', fxCommand);
        const result = await batchPlay([fxCommand], { synchronousExecution: true })[0]['layerEffects'];
        console.log('layer effects', result);
        return result;
    } catch (error) {
        console.error(`Error getting layer style: ${error}`);
        return error;
    }
}

export { applyLayerStyleToMatchingLayers };
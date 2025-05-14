// src/js/actions/transformLayersIndividually.js
const { app, core, action } = require('photoshop');
const { batchPlay } = action;
import { showInputDialog, toggleHistory } from '../helpers/helpers.js';

///Get Layer Scale and Rotation Transformations.
async function getLayerTransforms(layerArray) {
    const layerIdArray = layerArray.map(layer => layer.id);
    const gets = layerIdArray.map(layer => ({
        _obj: "get",
        _target: [
            { _ref: "layer", _id: layer }
        ],
        _options: { dialogOptions: "dontDisplay" }
    }));
    const results = await batchPlay(gets, { synchronousExecution: true });
    return results.map(r => {
        const info = r.smartObjectMore;
        if (!info) return null; // not a Smart Object

        // unpack the 8 corner coords
        const [x1, y1, x2, y2, x3, y3, x4, y4] = info.transform;
        const { width: origW, height: origH } = info.size;

        // helper to compute distance
        const dist = (xA, yA, xB, yB) => Math.hypot(xB - xA, yB - yA);

        // current pixel dimensions
        const wPx = dist(x1, y1, x2, y2);
        const hPx = dist(x1, y1, x4, y4);

        // scale percentages
        const widthPct = (wPx * 100) / origW;
        const heightPct = (hPx * 100) / origH;

        // rotation: angle of top edge vector
        const dx = x2 - x1;
        const dy = y2 - y1;
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

        return {
            layerId: r.layerID,
            widthPct: widthPct,
            heightPct: heightPct,
            rotationDeg: angleDeg
        };
    });
}

///Set Layer Scale and Rotation Transformations.
async function setLayerTransforms(layerTransformPairs, scale, rotation) {
    const sets = layerTransformPairs.flatMap(pair => [
        {
            _obj: "select",
            _target: [{ _ref: "layer", _id: pair.layerId }],
            _options: { dialogOptions: "dontDisplay" },
        },
        {
            _obj: "transform",
            _target: [{ _ref: "layer", _id: pair.layerId }],
            freeTransformCenterState: {
                _enum: "quadCenterState",
                _value: "QCSAverage"
            },
            width: { _unit: "percentUnit", _value: pair.widthPct * scale },
            height: { _unit: "percentUnit", _value: pair.heightPct * scale },
            angle: { _unit: "angleUnit", _value: pair.rotationDeg + rotation },
            interfaceIconFrameDimmed: {
                _enum: "interpolationType",
                _value: "bicubicAutomatic"
            },
            _options: { dialogOptions: "dontDisplay" },
        }
    ]);
    const results = await batchPlay(sets, { synchronousExecution: true });
    ///merge the results of the two commands-per-layer into one array entry per object with all the extra shit removed.
    return results.filter((_, i) => i % 2 === 0)              // take only even‐indexed items
        .map((item, i) => {
            const next = results[2 * i + 1] || {};        // fall back to empty if no pair
            return Object.fromEntries(
                ['layerID', 'height', 'width', 'angle']
                    .filter(k => k in item || k in next)  // only keep keys present in one
                    .map(k => [
                        k,
                        k in item ? item[k] : next[k]       // pick from whichever has it
                    ])
            );
        });
}

/**
 * Applies an additive scale or rotation transformation individually to each selected layer.
 * @param {('scale' | 'rotate')} transformType The type of transformation to apply.
 * @returns {Promise<{success: boolean, message: string, count: number}>} Result object.
 */
async function transformLayersIndividually(validTypes, transformType) {
    console.log(`(Action Script) transformLayersIndividually started.Type: ${transformType}`);
    let executionResult = { success: false, message: "Action initialization failed", count: 0 };
    try {
        // --- Prompt user for value using custom dialog ---
        const promptLabel = transformType === 'scale' ? "Amount (%):" : "Angle (°):";
        const promptTitle = transformType === 'scale' ? "Scale Layers Additively" : "Rotate Layers Additively";
        const defaultValue = transformType === 'scale' ? "50" : "15";

        const dialogResult = await showInputDialog(promptLabel, promptTitle, defaultValue);

        if (dialogResult.dismissed) {
            return { success: true, message: "Transformation cancelled by user.", count: 0 };
        }
        // Parse and validate the returned value
        const valueString = dialogResult.value;
        const value = parseFloat(valueString);

        // Basic validation (should also happen in dialog ideally)
        if (typeof value !== 'number' || isNaN(value)) {
            console.error("(Action Script) Invalid value received from dialog:", valueString);
            await core.showAlert(`Invalid input: '${valueString}'.Please enter a number.`);
            return { success: false, message: "Invalid numeric value.", count: 0 };
        }

        const activeDoc = app.activeDocument;
        const selectedLayers = activeDoc.activeLayers;
        if (selectedLayers.length === 0) {
            await core.showAlert("Please select the layer(s) you want to transform.");
            return { success: false, message: "No layers selected to transform.", count: 0 };
        }

        console.log(`(Action Script) Preparing to transform ${selectedLayers.length} layer(s): [${selectedLayers.map(layer => layer.name).join(', ')}]`);
        // --- Execute Transformation Logic within Modal Context ---
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            await toggleHistory(hostControl, "suspend", activeDoc.id, `Transform Layers Individually(${transformType})`);
            try {
                ///Calculate scale and rotation values based on user input.
                let scale = transformType === 'scale' ? value / 100 : 1;
                let rotation = transformType === 'scale' ? 0 : value;

                const layersToTransform = await getLayerTransforms(selectedLayers);
                // console.log("(Modal Action) Layer transforms:", layersToTransform);
                const transformResults = await setLayerTransforms(layersToTransform, scale, rotation);
                // console.log("(Modal Action) Result of setSelectedLayersScales:", transformResults);   
                selectedLayers.forEach(layer => {
                    layer.selected = true;
                });
                // --- Resume History ---
                await toggleHistory(hostControl, "resume", activeDoc.id);
                const finalMessage = `Applied ${transformType} (${value}${transformType === 'scale' ? '%' : '°'}) to ${transformResults.length} layer(s).`;
                return { success: true, message: finalMessage, payload: transformResults, count: transformResults.length };
            } catch (error) {
                console.error("(Modal Action) Error in transformLayersIndividually:", error);
                await toggleHistory(hostControl, "resume", activeDoc.id);
                return { success: false, message: `Error: ${error.message || error}`, count: 0 };
            }
        }, { commandName: `Transform Layers Individually: ${transformType}` });

        console.log("(Action Script) transformLayersIndividually finished. Modal Result:", result);
        executionResult = result; // Use the result from the modal
    } catch (error) {
        console.error("(Action Script) Error in transformLayersIndividually:", error);
        await core.showAlert(`An unexpected error occurred during transformation: ${error.message || error}`);
        executionResult = { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
    console.log("(Action Script) Final execution result:", executionResult);
    return executionResult;
}

export { transformLayersIndividually };
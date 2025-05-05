// src/js/actions/transformLayersIndividually.js
const { app, core, action } = require('photoshop');
const batchPlay = action.batchPlay;
import { showInputDialog } from '../helpers/helpers.js'; // Import the new dialog helper

/**
 * Applies an additive scale or rotation transformation individually to each selected layer.
 * @param {('scale' | 'rotate')} transformType The type of transformation to apply.
 * @returns {Promise<{success: boolean, message: string, count: number}>} Result object.
 */
async function transformLayersIndividually(validTypes, transformType) {
    console.log(`(Action Script) transformLayersIndividually started. Type: ${transformType}`);
    let executionResult = { success: false, message: "Action initialization failed", count: 0 };

    if (transformType !== 'scale' && transformType !== 'rotate') {
        console.error("(Action Script) Invalid transformType:", transformType);
        // No alert here, should be called correctly internally
        return { success: false, message: "Invalid transformation type.", count: 0 };
    }

    try {
        // --- Prompt user for value using custom dialog ---
        const promptLabel = transformType === 'scale' ? "Scale Percentage (%):" : "Rotation Angle (°):";
        const promptTitle = transformType === 'scale' ? "Scale Layers Additively" : "Rotate Layers Additively";
        const defaultValue = transformType === 'scale' ? "50" : "15";

        const dialogResult = await showInputDialog(promptLabel, promptTitle, defaultValue);

        if (dialogResult.dismissed) {
            console.log("(Action Script) User dismissed the dialog.");
            return { success: false, message: "Transformation cancelled by user.", count: 0 };
        }

        // Parse and validate the returned value
        const valueString = dialogResult.value;
        const value = parseFloat(valueString);

        // Basic validation (should also happen in dialog ideally)
        if (typeof value !== 'number' || isNaN(value)) {
            console.error("(Action Script) Invalid value received from dialog:", valueString);
            await core.showAlert(`Invalid input: '${valueString}'. Please enter a number.`);
            return { success: false, message: "Invalid numeric value.", count: 0 };
        }
        console.log(`(Action Script) Value from dialog: ${value}`);

        // --- Proceed with existing logic using the prompted value --- 
        const activeDoc = app.activeDocument;
        if (!activeDoc) {
            await core.showAlert("Please open a document first.");
            return { success: false, message: "No active document.", count: 0 };
        }

        const selectedLayers = activeDoc.activeLayers;
        if (selectedLayers.length === 0) {
            await core.showAlert("Please select the layer(s) you want to transform.");
            return { success: false, message: "No layers selected to transform.", count: 0 };
        }

        const selectedLayerIds = selectedLayers.map(layer => layer.id);
        const layerNames = selectedLayers.map(layer => layer.name); // For logging
        console.log(`(Action Script) Preparing to transform ${selectedLayerIds.length} layer(s): [${layerNames.join(', ')}]`);

        // --- Execute Transformation Logic within Modal Context ---
        const result = await core.executeAsModal(async (executionContext) => {
            console.log(`(Modal Action) Executing transformLayersIndividually within modal for ${selectedLayerIds.length} layers.`);
            const hostControl = executionContext.hostControl;
            const suspensionID = await hostControl.suspendHistory({
                documentID: activeDoc.id,
                name: `Transform Layers Individually (${transformType})`
            });

            let transformedCount = 0;
            const transformCommands = [];
            const getPropertyCommands = [];

            // --- Stage 1: Prepare commands to get current properties --- 
            for (const layerId of selectedLayerIds) {
                // Command to get properties required for transform (angle, width/height %)
                // We need textKeyOriginType to know if width/height are reliable for scale.
                // For non-text layers, bounds might be better, but let's start with width/height.
                getPropertyCommands.push({
                    _obj: "get",
                    _target: [{ _ref: "layer", _id: layerId }],
                    _options: { dialogOptions: "dontDisplay" }
                });
            }

            // --- Stage 2: Execute 'get' commands --- 
            let layerProperties = [];
            if (getPropertyCommands.length > 0) {
                try {
                    console.log(`(Modal Action) Getting properties for ${getPropertyCommands.length} layers.`);
                    layerProperties = await batchPlay(getPropertyCommands, { 
                        synchronousExecution: true, 
                        modalBehavior: "execute" 
                    });
                    console.log("(Modal Action) Received layer properties.");
                } catch (getError) {
                    console.error("(Modal Action) Error getting layer properties:", getError);
                    await core.showAlert(`Failed to retrieve properties for transformation: ${getError.message}`);
                    await hostControl.resumeHistory(suspensionID); // Clean up history
                    return { success: false, message: "Failed to get layer properties.", count: 0 };
                }
            }

            // --- Stage 3: Calculate and build transform commands --- 
            for (let i = 0; i < selectedLayerIds.length; i++) {
                const layerId = selectedLayerIds[i];
                const properties = layerProperties[i];

                if (!properties) {
                    console.warn(`(Modal Action) Skipping layer ID ${layerId}: Could not retrieve properties.`);
                    continue;
                }

                try {
                    // Extract current transform values - Default to neutral values if missing
                    let currentAngle = properties.transform?.angle?._value ?? 0;
                    // Assuming width/height are percentages for scale. Need to handle non-percentage units if necessary.
                    // Let's default to 100% if scale properties are missing or not in percent.
                    let currentWidthPercent = (properties.transform?.width?._unit === "percentUnit") ? properties.transform.width._value : 100;
                    let currentHeightPercent = (properties.transform?.height?._unit === "percentUnit") ? properties.transform.height._value : 100;
                    // For uniform scaling, we might just use width. Let's assume they are linked for now.
                    let currentScalePercent = currentWidthPercent; 

                    console.log(`(Modal Action) Layer ID ${layerId}: Current Angle=${currentAngle}, Current Scale=${currentScalePercent}%`);

                    let newAngle = currentAngle;
                    let newScalePercent = currentScalePercent;

                    // Calculate new values based on transformType and prompted value
                    if (transformType === 'scale') {
                        newScalePercent = currentScalePercent * (value / 100.0); // Use prompted value
                        console.log(`(Modal Action) Layer ID ${layerId}: New Scale = ${newScalePercent}%`);
                    } else if (transformType === 'rotate') {
                        newAngle = currentAngle + value; // Use prompted value
                        console.log(`(Modal Action) Layer ID ${layerId}: New Angle = ${newAngle} degrees`);
                    }

                    // Construct the batchPlay 'transform' command for this layer
                    const transformCommandForLayer = {
                        _obj: "transform",
                        _target: [{ _ref: "layer", _id: layerId }],
                        freeTransformCenterBased: true, // Transform around center
                        width: { _unit: "percentUnit", _value: newScalePercent }, // '#Prc'
                        height: { _unit: "percentUnit", _value: newScalePercent }, // '#Prc' - Assume uniform scaling
                        angle: { _unit: "angleUnit", _value: newAngle }, // '#Ang'
                        interfaceIconFrameDimmed: { _enum: "interpolationType", _value: "bicubicAutomatic" } // Default interpolation
                    };

                    transformCommands.push(transformCommandForLayer);
                    transformedCount++; // Count successful command preparations

                } catch (layerError) {
                    console.error(`(Modal Action) Error processing layer ID ${layerId}:`, layerError);
                    // Optionally skip this layer and continue, or stop entirely
                    // For now, we log and skip to the next layer
                }
            }

             // --- Stage 4: Execute BatchPlay Transform Commands ---
             if (transformCommands.length > 0) {
                 console.log(`(Modal Action) Executing ${transformCommands.length} transform commands via batchPlay.`);
                 try {
                     const batchPlayResult = await batchPlay(transformCommands, {
                         synchronousExecution: true,
                         modalBehavior: "execute"
                     });
                     console.log("(Modal Action) batchPlay transform result:", batchPlayResult);
                     // Could add checks here based on batchPlayResult if needed
                 } catch (batchPlayError) {
                     console.error("(Modal Action) Error executing batchPlay transforms:", batchPlayError);
                     await core.showAlert(`An error occurred during the transformation: ${batchPlayError.message}`);
                     // Resume history before throwing/returning error
                     await hostControl.resumeHistory(suspensionID);
                     return { success: false, message: `BatchPlay Error: ${batchPlayError.message}`, count: 0 };
                 }

            } else if (selectedLayerIds.length > 0) {
                 console.log("(Modal Action) No transformation commands were generated, possibly due to errors retrieving properties for all selected layers.");
                 // Return success but indicate nothing was done, or failure?
                 // Let's return success but with count 0 and a specific message.
                  await hostControl.resumeHistory(suspensionID);
                  return { success: true, message: "No layers could be transformed (check properties).", count: 0 };
            } else {
                 console.log("(Modal Action) No layers were selected initially."); // Should have been caught earlier
            }


            // --- Resume History ---
            await hostControl.resumeHistory(suspensionID);
            console.log("(Modal Action) History resumed.");

            const finalMessage = `Applied ${transformType} (${value}${transformType === 'scale' ? '%' : '°'}) to ${transformedCount} layer(s).`; // Include prompted value in message
            console.log(`(Modal Action) ${finalMessage}`);
            return { success: true, message: finalMessage, count: transformedCount }; 

        }, { commandName: `Transform Layers Individually: ${transformType}` });

        console.log("(Action Script) transformLayersIndividually finished. Modal Result:", result);
        executionResult = result; // Use the result from the modal

    } catch (error) {
        console.error("(Action Script) Error in transformLayersIndividually:", error);
        await core.showAlert(`An unexpected error occurred during transformation: ${error.message || error}`);
        executionResult = { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }

    // --- Restore Original Selection (Optional but good practice) ---
    try {
         if (app.activeDocument && selectedLayerIds && selectedLayerIds.length > 0) {
             const layerRefs = selectedLayerIds.map(id => ({ _ref: "layer", _id: id }));
             // Deselect all first, then select the original ones
             await batchPlay([
                 { _obj: "selectNoLayers", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }] },
                 { _obj: "select", _target: layerRefs, makeVisible: false }
             ], { synchronousExecution: true, modalBehavior: "execute" });
             console.log("(Action Script) Original layer selection potentially restored.");
         }
    } catch (restoreError) {
         console.warn("(Action Script) Could not restore original selection:", restoreError);
    }


    console.log("(Action Script) Final execution result:", executionResult);
    return executionResult;
}

export { transformLayersIndividually };

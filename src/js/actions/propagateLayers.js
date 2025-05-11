const { app, core, constants } = require("photoshop");
const { LayerKind, ElementPlacement } = constants;
import {getLayerContainer, findValidGroups, toggleHistory, checkForExistingLayers, getLayerIndex, duplicateAndMoveToBottom, placeAtCorrectDepth } from '../helpers/helpers.js';

const actionName = 'Propagate Layer';


// =============================================================================
//  PROPAGATE LAYERS ACTION
// =============================================================================
// Similar to propagateLayersAction, but only propagates selected layer(s)
// to targets where no layer with a matching name already exists.
// =============================================================================


async function propagateLayers(filter, missingOnly = false) {
    console.log("(Action Script) propagateLayers started.");
    let executionResult = { success: false, message: "", count: 0 }; // count = number of layers duplicated * number of targets
    let skippedTargets = 0;
    let successfulPropagations = 0;

    try {
        const result = await core.executeAsModal(async (modalExecutionContext) => {
            console.log("(Modal Action) Executing propagateLayers within modal.");
            const hostControl = modalExecutionContext.hostControl;
            const activeDoc = app.activeDocument;

            if (!activeDoc) {
                await core.showAlert("Please open a document first.");
                return { success: false, message: "No active document.", count: 0 };
            }

            // Get selected layers
            const originalSelection = activeDoc.activeLayers;
            if (originalSelection.length === 0) {
                await core.showAlert("Please select the layer(s) you want to propagate.");
                return { success: false, message: "No layers selected to propagate.", count: 0 };
            }
            
            // Get names of selected layers
            const sourceLayerNames = originalSelection.map(layer => layer.name);
            console.log(`(Modal Action) Propagating ${originalSelection.length} selected layer(s): [${sourceLayerNames.join(', ')}]`);
            
            // Get the container of the selected layer(s) and then get its layers collection
            const sourceContainer = getLayerContainer(originalSelection);
            const sourceLayers = sourceContainer.layers;
            // Verify that container is a Group (might not be needed, i mean, what else would it be??)
            if (sourceContainer.kind !== LayerKind.GROUP) {
                await core.showAlert("Selected layers must be inside an Artboard or Group to propagate.");
                return { success: false, message: "Selected layers are not in a valid container (Artboard/Group).", count: 0 };
            }
          
            console.log(`(Modal Action) Matching Boards Using: [${filter.toString()}]`);
            const targetContainers = findValidGroups(activeDoc.layers, sourceContainer, filter);
            console.log(`(Modal Action) Found ${targetContainers.length} target Group(s).`);

            if (targetContainers.length === 0) {
                await core.showAlert(`No other Groups found to propagate to.`);
                return { success: true, message: "No target Groups found.", count: 0 }; // Not failure, just nothing to do
            }

            // --- Perform Duplication and Move --- 
            await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
            for (const targetContainer of targetContainers) {
                console.log(`(Modal Action) Processing target: ${targetContainer.name} (ID: ${targetContainer.id})`);

                const [shouldPropagateToTarget, skippedIncrement] = missingOnly ? checkForExistingLayers(targetContainer, sourceLayerNames, skippedTargets) : [true, 0];
                skippedTargets = skippedIncrement;

                console.log(`(Modal Action) Should propagate to target: ${shouldPropagateToTarget}`);
                if (shouldPropagateToTarget) {
                    for (const sourceLayer of originalSelection) {
                        try {
                            // --- Duplicate Source Layer--- 
                            const [duplicatedLayer, successIncrement] = await duplicateAndMoveToBottom(sourceLayer, targetContainer, successfulPropagations);
                            successfulPropagations = successIncrement;
                            console.log(`(Modal Action) Duplicated '${sourceLayer.name}' to '${targetContainer.name}'`);
    
                            // --- Translate to Match Relative Position - THIS DOESN"T CURRENTLY WORK RIGHT, AND ALSO DOESN'T APPEAR NECESSARY UNLESS ARTBOARDS ARE DIFFERENT SIZES---
                            ///UPDATE: WE DO NEED THIS IF THE PROPAGATED ELEMENT IS NOT INSIDE THE BOUNDS OF THE ARTBOARD IT IS SOURCED FROM
                            //const rp = getRelativePosition(sourceLayer, sourceContainer);
                            //await matchRelativePosition(duplicatedLayer, rp, targetContainer);
    
                            // --- Reorder to Match Source Depth ---                       
                            try {
                                const sourceIndex = getLayerIndex(sourceLayer, sourceLayers);
                                console.log(`(Modal Action) Source index: ${sourceIndex}`);
                                if(sourceIndex === -1) {
                                    console.warn(`(Modal Action) Could not find source layer index for reordering.`);
                                } else {
                                    ///now convert source index to its position relative to the bottommost element rather than the top.
                                    let distanceFromBottom = (sourceContainer.layers.length - 1) - sourceIndex;
                                    console.log(`(Modal Action) Distance from bottom: ${distanceFromBottom}`);
                                    await placeAtCorrectDepth(duplicatedLayer, targetContainer, distanceFromBottom);
                                }
                            } catch (reorderError) {
                                console.error(`(Modal Action) Error reordering layer '${duplicatedLayer.name}': ${reorderError.message}`);
                                // Potentially non-critical, continue loop
                            }
                        } catch (dupOrTranslateError) {
                             console.error(`(Modal Action) Error processing layer '${sourceLayer.name}' for target '${targetContainer.name}': ${dupOrTranslateError.message}`);
                             // Decide whether to stop or continue
                             // await core.showAlert(`Failed processing '${sourceLayer.name}'. Check console.`);
                             // break; // Maybe break inner loop for this target?
                        }
                    }
                }
            } // end for target loop

            console.log(`(Modal Action) Finished processing all targets. Total successful duplications (layer * target instances): ${successfulPropagations}. Skipped ${skippedTargets} targets due to existing names.`);
            let message = `Propagated layers where missing. Instances created: ${successfulPropagations}.`;
            if (skippedTargets > 0) {
                message += ` Skipped ${skippedTargets} targets due to existing layer names.`;
            }
            executionResult = { success: true, message: message, count: successfulPropagations };

            // --- Restore Original Selection ---
            try {
                activeDoc.activeLayers = originalSelection;
                console.log("(Modal Action) Original layer selection restored.");
            } catch (restoreError) {
                console.warn("(Modal Action) Could not restore original selection:", restoreError);
                // Non-critical, proceed
            }

            // console.log("(Modal Action) History resumed.");
            await toggleHistory(hostControl, "resume", activeDoc.id);

            console.log("(Modal Action) propagateMissing finished within modal.");
            return executionResult;

        }, { commandName: "Propagate Missing Layers" }); // Updated command name

        console.log("(Action Script) propagateLayers finished. Result:", result);
        return result;

    } catch (error) {
        console.error("(Action Script) Error in propagateLayers:", error);
        await core.showAlert("An unexpected error occurred during propagation. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}


export { propagateLayers };

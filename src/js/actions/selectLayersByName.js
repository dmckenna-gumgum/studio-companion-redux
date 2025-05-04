// client/js/actions/selectLayersByName.js
const { app, core, action } = require('photoshop');
const batchPlay = action.batchPlay;

async function selectLayersByName() { 
    console.log("(Action) Attempting to select layers matching current selection (using executeAsModal)...");
    try {
        // --- Get Target Names from Current Selection (Done outside modal) ---
        const currentlySelectedLayers = app.activeDocument.activeLayers;
        if (!currentlySelectedLayers || currentlySelectedLayers.length === 0) {
            const message = "No layers are currently selected. Please select one or more layers first.";
            console.log("(Action) No layers initially selected.");
            await core.showAlert(message);
            return { success: false, message: message };
        }

        const targetNames = new Set(currentlySelectedLayers.map(layer => layer.name));
        console.log("(Action) Target layer names:", Array.from(targetNames));

        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            const allLayers = app.activeDocument.layers; 
            const matchingLayerIds = [];

            // Recursive function to find matching layer IDs (defined inside modal)
            function findMatchingLayerIds(layerSet) {
                for (let i = 0; i < layerSet.length; i++) {
                    const layer = layerSet[i];
                    if (targetNames.has(layer.name)) {
                        matchingLayerIds.push(layer.id);
                    }
                    // Recurse into groups
                    if (layer.layers) {
                        findMatchingLayerIds(layer.layers);
                    }
                }
            }

            console.log("(Modal Action) Starting recursive search for matching layer IDs...");
            findMatchingLayerIds(allLayers);
            console.log(`(Modal Action) Found ${matchingLayerIds.length} matching layer IDs:`, matchingLayerIds);

            // History state for undo
            await executionContext.hostControl.suspendHistory({ 
                "documentID": app.activeDocument.id, 
                "name": "Select Layers By Name"
            });

            // Prepare batchPlay command
            const commands = [
                // 1. Deselect all layers
                { 
                    _obj: "selectNoLayers", 
                    _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }]
                }
            ];

            // 2. Add command to select matching layers if any were found
            if (matchingLayerIds.length > 0) {
                const layerRefs = matchingLayerIds.map(id => ({ _ref: "layer", _id: id }));
                commands.push({
                    _obj: "select",
                    _target: layerRefs,
                    selectionModifier: { _enum: "selectionModifierType", _value: "addToSelection" }, // Use addToSelectionContinuous for contiguous?
                    makeVisible: false // Keep visibility as is
                });
            }

            let batchPlayResult;
            if (commands.length > 1 || matchingLayerIds.length === 0) { // Only run if there's something to do (select or just deselect)
                 console.log("(Modal Action) Executing batchPlay to select layers:", JSON.stringify(commands));
                 batchPlayResult = await batchPlay(commands, {
                    synchronousExecution: true, 
                    modalBehavior: "execute"
                 });
                 console.log("(Modal Action) batchPlay result:", batchPlayResult);
            } else {
                 console.log("(Modal Action) No matching layers found, nothing to select via batchPlay.");
            }

            await executionContext.hostControl.resumeHistory();

            // Return result from the modal function
            const finalSelectedCount = matchingLayerIds.length; // Count based on IDs found
              
            if (finalSelectedCount > 0) {
                return { success: true, count: finalSelectedCount };
            } else {
                // If initially selected layers existed but none matched after searching (e.g., renamed)
                return { success: false, count: 0, message: "No layers found matching the name(s) of the initially selected layers." }; 
            }

        }, { "commandName": "Select Layers By Name Action" });

        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Selected ${result.count} layers matching the name(s) of the initial selection.`;
            console.log(`(Action) ${message}`);
            return { success: true, count: result.count, message: message };
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during selection."; 
            console.log(`(Action) ${message}`);
            await core.showAlert(message); 
            return { success: false, count: 0, message: message };
        }

    } catch (e) {
        console.error("(Action) Error selecting matching layers:", e);
        const message = `Error selecting matching layers: ${e.message || e}`;
        // Avoid showing alert if the error was just 'No layers selected initially'
        if (!message.startsWith("No layers are currently selected")) {
             await core.showAlert("An error occurred while selecting matching layers.");
        }
        return { success: false, message: message, error: e.message || e };
    }
}

// Export the function as a named export for ES modules
export { selectLayersByName };

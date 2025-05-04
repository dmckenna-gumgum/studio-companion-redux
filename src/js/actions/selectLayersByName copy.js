// client/js/actions/selectLayersByName.js
const { app, core, action } = require('photoshop');

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
            let newlySelectedLayers = [];
            const allLayers = app.activeDocument.layers; 

            // Recursive function must be defined *inside* the modal scope
            function findAndSelectMatchingLayers(layerSet) {
                for (let i = 0; i < layerSet.length; i++) {
                    const layer = layerSet[i];
                    
                    if (targetNames.has(layer.name)) {
                        layer.selected = true;
                        newlySelectedLayers.push(layer); 
                        console.log(`(Modal Action) Selecting layer: ${layer.name} (ID: ${layer.id})`);
                    } else {
                        layer.selected = false;
                    }

                    if (layer.layers) {
                        findAndSelectMatchingLayers(layer.layers);
                    }
                }
            }

            // History state for undo
            await executionContext.hostControl.suspendHistory({ 
                "documentID": app.activeDocument.id, 
                "name": "Select Layers By Name"
            });

            console.log("(Modal Action) Deselecting all top-level layers initially.");
            allLayers.forEach(layer => layer.selected = false); 
            
            console.log("(Modal Action) Starting recursive search and selection...");
            findAndSelectMatchingLayers(allLayers);

            await executionContext.hostControl.resumeHistory();

            // Return result from the modal function
            const finalSelectedCount = newlySelectedLayers.length;
              
            if (finalSelectedCount > 0) {
                return { success: true, count: finalSelectedCount };
            } else {
                return { success: false, count: 0 }; // Should be rare
            }

        }, { "commandName": "Select Layers By Name Action" });

        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Selected ${result.count} layers matching the name(s) of the initial selection.`;
            console.log(`(Action) ${message}`);
            return { success: true, count: result.count, message: message };
        } else {
            const message = "No matching layers found (this shouldn't usually happen if layers were initially selected).";
            console.log(`(Action) ${message}`);
            // Alert is shown outside modal if necessary
            await core.showAlert(message); 
            return { success: false, count: 0, message: message };
        }

    } catch (e) {
        console.error("(Action) Error selecting matching layers:", e);
        const message = `Error selecting matching layers: ${e.message || e}`;
        await core.showAlert("An error occurred while selecting matching layers.");
        return { success: false, message: message, error: e.message };
    }
}

module.exports = selectLayersByName;

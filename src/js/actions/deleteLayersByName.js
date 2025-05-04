const { app, core, executionContext } = require("photoshop");

async function deleteLayersByName() {
    console.log("(Action Script) deleteLayersByName started.");
    let executionResult = { success: false, message: "", count: 0 };

    try {
        const result = await core.executeAsModal(async (modalExecutionContext) => {
            console.log("(Modal Action) Executing deleteLayersByName within modal.");
            const hostControl = modalExecutionContext.hostControl;
            const activeDoc = app.activeDocument;

            if (!activeDoc) {
                console.log("(Modal Action) No active document.");
                await core.showAlert("Please open a document first.");
                return { success: false, message: "No active document.", count: 0 };
            }

            const initiallySelectedLayers = activeDoc.activeLayers;
            if (initiallySelectedLayers.length === 0) {
                console.log("(Modal Action) No layers selected initially.");
                await core.showAlert("Please select at least one layer whose matching instances you want to delete.");
                return { success: false, message: "No layers are currently selected.", count: 0 };
            }

            const targetNames = new Set(initiallySelectedLayers.map(layer => layer.name));
            console.log("(Modal Action) Target layer names for deletion:", Array.from(targetNames));

            let layersToDelete = [];

            // Recursive function to find all matching layers (excluding background)
            function findMatchingLayersToDelete(layerSet) {
                for (let i = layerSet.length - 1; i >= 0; i--) { // Iterate backwards because we'll be deleting
                    const layer = layerSet[i];
                    // Skip the background layer explicitly if necessary, though delete might fail anyway
                    if (layer.isBackgroundLayer) continue; 

                    if (targetNames.has(layer.name)) {
                        layersToDelete.push(layer);
                    }
                    // Recurse into groups even if the group itself matches (to delete contents first if needed)
                    if (layer.layers && layer.layers.length > 0) { 
                        findMatchingLayersToDelete(layer.layers);
                    }
                }
            }

            // Suspend history state
            await hostControl.suspendHistory({
                "documentID": activeDoc.id,
                "name": "Delete Layers By Name"
            });
            console.log("(Modal Action) History suspended.");

            findMatchingLayersToDelete(activeDoc.layers); // Start search from top-level layers
            console.log(`(Modal Action) Found ${layersToDelete.length} layers matching names to delete:`, layersToDelete.map(l => l.name));

            let deletedCount = 0;
            if (layersToDelete.length === 0) {
                console.log("(Modal Action) No matching layers found to delete.");
                await core.showAlert("Found no layers matching the selected names. Nothing to delete.");
                executionResult = { success: true, message: "No matching layers found to delete.", count: 0 };
            } else {
                console.log(`(Modal Action) Deleting ${layersToDelete.length} layers.`);
                // Important: Delete layers in the order they were found (potentially reverse of collection order if needed)
                // or rely on the fact that layer references remain valid even if others are deleted (generally true in UXP)
                for (const layer of layersToDelete) {
                    try {
                        await layer.delete(); // Attempt to delete
                        deletedCount++;
                    } catch (deleteError) {
                         // Handle specific errors, e.g., trying to delete the last layer if PS prevents it.
                         if (deleteError.message.includes("background layer")) {
                             console.warn(`(Modal Action) Cannot delete background layer '${layer.name}'. Skipping.`);
                         } else if (deleteError.message.includes("last layer")) {
                             console.warn(`(Modal Action) Cannot delete the last remaining layer '${layer.name}'. Skipping.`);
                             await core.showAlert(`Cannot delete the last layer ('${layer.name}') in the document.`);
                             // Potentially stop further deletions if this happens?
                         } else {
                             console.error(`(Modal Action) Could not delete layer '${layer.name}': ${deleteError.message}`);
                         }
                    }
                }
                 executionResult = { success: true, message: `Deleted ${deletedCount} layer(s) matching names.`, count: deletedCount };
            }

            // Resume history state
            await hostControl.resumeHistory({"documentID": activeDoc.id});
            console.log("(Modal Action) History resumed.");
            return executionResult;

        }, { "commandName": "Delete Layers By Name" });

        // --- Process Result from Modal ---
        return result; // Return the object {success, message, count}

    } catch (err) {
        console.error("(Action Script) Error in deleteLayersByName:", err);
        const message = err.message || err.toString() || "Unknown error deleting layers.";
         if (!message.includes("No active document") && !message.includes("No layers are currently selected")) {
             await core.showAlert(`Error deleting layers: ${message}`);
         }
        return { success: false, message: `Error: ${message}`, count: 0 };
    }
}

export { deleteLayersByName };

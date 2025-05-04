const { app, core, executionContext } = require("photoshop");

async function unlinkLayersByName() {
    console.log("(Action Script) unlinkLayersByNameAction started.");
    let executionResult = { success: false, message: "", count: 0 };

    try {
        const result = await core.executeAsModal(async (modalExecutionContext) => {
            console.log("(Modal Action) Executing unlinkLayersByName within modal.");
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
                await core.showAlert("Please select at least one layer whose matching instances you want to unlink.");
                return { success: false, message: "No layers are currently selected.", count: 0 };
            }

            const targetNames = new Set(initiallySelectedLayers.map(layer => layer.name));
            console.log("(Modal Action) Target layer names for unlinking:", Array.from(targetNames));

            let matchingLayers = [];

            // Recursive function to find all matching layers
            function findMatchingLayers(layerSet) {
                for (let i = layerSet.length - 1; i >= 0; i--) { 
                    const layer = layerSet[i];
                    if (targetNames.has(layer.name)) {
                        matchingLayers.push(layer);
                    }
                    if (layer.layers) { // Recurse into groups
                        findMatchingLayers(layer.layers);
                    }
                }
            }

            // Suspend history state
            await hostControl.suspendHistory({
                "documentID": activeDoc.id,
                "name": "Unlink Layers By Name"
            });
            console.log("(Modal Action) History suspended.");

            findMatchingLayers(activeDoc.layers); // Start search from top-level layers
            console.log(`(Modal Action) Found ${matchingLayers.length} layers matching names:`, matchingLayers.map(l => l.name));

            let unlinkedCount = 0;
            if (matchingLayers.length === 0) {
                console.log("(Modal Action) No matching layers found to unlink.");
                 await core.showAlert("Found no layers matching the selected names. Nothing to unlink.");
                // Don't treat as failure, just nothing done
                 executionResult = { success: true, message: "No matching layers found to unlink.", count: 0 };
            } else {
                console.log(`(Modal Action) Unlinking ${matchingLayers.length} layers.`);
                for (const layer of matchingLayers) {
                    try {
                        if (layer.linkedLayers && layer.linkedLayers.length > 0) { // Check if actually linked
                           layer.unlink();
                           unlinkedCount++; 
                        } else {
                             console.log(`(Modal Action) Layer '${layer.name}' was not linked.`);
                        }
                    } catch (unlinkError) {
                        console.warn(`(Modal Action) Could not unlink layer '${layer.name}': ${unlinkError.message}`);
                    }
                }
                 executionResult = { success: true, message: `Unlinked ${unlinkedCount} layer(s) matching names.`, count: unlinkedCount };
            }

            // Resume history state
            await hostControl.resumeHistory({"documentID": activeDoc.id});
            console.log("(Modal Action) History resumed.");
            return executionResult;

        }, { "commandName": "Unlink Layers By Name Action" });

        // --- Process Result from Modal ---
        return result; // Return the object {success, message, count}

    } catch (err) {
        console.error("(Action Script) Error in unlinkLayersByNameAction:", err);
        const message = err.message || err.toString() || "Unknown error unlinking layers.";
         if (!message.includes("No active document") && !message.includes("No layers are currently selected")) {
             await core.showAlert(`Error unlinking layers: ${message}`);
         }
        return { success: false, message: `Error: ${message}`, count: 0 };
    }
}

export { unlinkLayersByName };

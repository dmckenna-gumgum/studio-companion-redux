const { app, core, executionContext } = require("photoshop");

async function linkLayersByName() {
    console.log("(Action Script) linkLayersByNameAction started.");
    let executionResult = { success: false, message: "", count: 0 };

    try {
        const result = await core.executeAsModal(async (modalExecutionContext) => {
            console.log("(Modal Action) Executing linkLayersByName within modal.");
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
                await core.showAlert("Please select at least one layer first.");
                return { success: false, message: "No layers are currently selected.", count: 0 };
            }

            const targetNames = new Set(initiallySelectedLayers.map(layer => layer.name));
            console.log("(Modal Action) Target layer names:", Array.from(targetNames));

            let matchingLayers = [];

            // Recursive function to find all matching layers
            function findMatchingLayers(layerSet) {
                for (let i = layerSet.length - 1; i >= 0; i--) { // Iterate backwards for potential deletions/moves
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
                "name": "Link Layers By Name"
            });
            console.log("(Modal Action) History suspended.");

            findMatchingLayers(activeDoc.layers); // Start search from top-level layers
            console.log(`(Modal Action) Found ${matchingLayers.length} layers matching names:`, matchingLayers.map(l => l.name));

            let linkedCount = 0;
            if (matchingLayers.length < 2) {
                console.log("(Modal Action) Not enough matching layers to link.");
                await core.showAlert("Found fewer than 2 layers matching the selected names. Nothing to link.");
                // Don't treat as failure, just nothing done
                executionResult = { success: true, message: "Need at least 2 matching layers to link.", count: 0 };
            } else {
                const anchorLayer = matchingLayers[0]; // Link everything to the first one found
                console.log(`(Modal Action) Linking ${matchingLayers.length -1} layers to anchor: ${anchorLayer.name}`);
                for (let i = 1; i < matchingLayers.length; i++) {
                    try {
                        matchingLayers[i].link(anchorLayer);
                        linkedCount++;
                    } catch (linkError) {
                        console.warn(`(Modal Action) Could not link layer '${matchingLayers[i].name}': ${linkError.message}`);
                        // Decide if this should halt the process or just skip
                    }
                }
                executionResult = { success: true, message: `Linked ${linkedCount + 1} layers together.`, count: linkedCount + 1 }; // +1 for the anchor
            }

            // Resume history state
            await hostControl.resumeHistory({"documentID": activeDoc.id});
            console.log("(Modal Action) History resumed.");
            return executionResult;

        }, { "commandName": "Link Layers By Name Action" });

        // --- Process Result from Modal ---
        return result; // Return the object {success, message, count}

    } catch (err) {
        console.error("(Action Script) Error in linkLayersByName:", err);
        const message = err.message || err.toString() || "Unknown error linking layers.";
        // Avoid showing alert if modal already did (e.g., no doc)
        if (!message.includes("No active document") && !message.includes("No layers are currently selected")) {
            await core.showAlert(`Error linking layers: ${message}`);
        }
        return { success: false, message: `Error: ${message}`, count: 0 };
    }
}

export { linkLayersByName };

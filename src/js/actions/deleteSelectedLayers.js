const { app, core, executionContext } = require("photoshop");

async function deleteSelectedLayers() {
    console.log("(Action Script) deleteSelectedLayers started.");
    let executionResult = { success: false, message: "", count: 0 };

    try {
        const result = await core.executeAsModal(async (modalExecutionContext) => {
            console.log("(Modal Action) Executing deleteSelectedLayers within modal.");
            const hostControl = modalExecutionContext.hostControl;
            const activeDoc = app.activeDocument;

            // Suspend history state
            await hostControl.suspendHistory({
                "documentID": activeDoc.id, 
                "name": "Delete Selected Layers"
            });
            console.log("(Modal Action) History suspended.");
            let deletions = 0;
            for(const layer of app.activeDocument.activeLayers) {
                try{
                    layer.delete();
                    deletions++;
                } catch (err) {
                    console.error("(Action Script) Error deleting layer:", err);
                } 
            }           
            // Resume history state
            await hostControl.resumeHistory({"documentID": activeDoc.id, "name": "Delete Selected Layers"});
            console.log("(Modal Action) History resumed.");
            executionResult = { success: true, message: `Deleted ${deletions} layer(s) selected.`, count: deletions };            
            return executionResult;

        }, { "commandName": "Delete Selected Layers" });

        return result;
    } catch (err) {
        console.error("(Action Script) Error in deleteSelectedLayers:", err);
        const message = err.message || err.toString() || "Unknown error deleting layers.";
         if (!message.includes("No active document") && !message.includes("No layers are currently selected")) {
             await core.showAlert(`Error deleting layers: ${message}`);
         }
        return { success: false, message: `Error: ${message}`, count: 0 };
    }
}

export { deleteSelectedLayers };

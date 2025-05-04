// client/js/actions/getSelectedLayerName.js
const { app, core } = require('photoshop'); // Require photoshop core and app

async function getSelectedLayerName() {
    console.log("(Action) getSelectedLayerName called directly from panel context.");
    let layerName = null;
    let message = "";
    let success = false;

    try {
        // Direct access to app - no executeAsModal needed for reading properties
        const selectedLayers = app.activeDocument.activeLayers;
        if (selectedLayers && selectedLayers.length > 0) {
            if (selectedLayers.length === 1) {
                layerName = selectedLayers[0].name;
                success = true;
                console.log(`(Action) Selected layer name: ${layerName}`);
            } else {
                message = "Please select only one layer.";
                success = false;
                console.log("(Action) Multiple layers selected.");
                // Use core.showAlert if needed, available in panel context
                await core.showAlert(message);
            }
        } else {
            message = "No layer selected.";
            success = false;
            console.log("(Action) No layer selected.");
            await core.showAlert(message);
        }
        return { success: success, layerName: layerName, message: message };
    } catch (e) {
        console.error("(Action) Error in getSelectedLayerName:", e);
        message = `Error getting layer name: ${e.message || e}`;
        try { await core.showAlert(message); } catch(alertErr) {}
        return { success: false, message: message };
    }
}

module.exports = getSelectedLayerName; // Export the function

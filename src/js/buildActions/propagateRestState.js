// client/js/actions/selectLayersByName.js
const { app, core, action } = require('photoshop');
const { batchPlay } = action;
import {findValidGroups, toggleHistory, duplicateBoardToBoard, convertAllLayersToSmartObjects } from '../helpers/helpers.js';
const actionName = 'Propagate Layers to Velocity State Boards';
const debug = false;
const rasterizeText = false;
const rasterizeLayerStyles = false;
            
const actionRoutes = [    
    {
        name: 'Mobile Expanded',
        sourceName: 'morph-2-expanded-panel:mb',
        sourceBoard: null,
        destinationNames: ['morph-1-expanded-panel:mb', 'morph-3-expanded-panel:mb'],
        destinationBoards: null,
    },
    {
        name: 'Mobile Collapsed',
        sourceName: 'morph-2-collapsed-panel:mb',
        sourceBoard: null,
        destinationNames: ['morph-1-collapsed-panel:mb', 'morph-3-collapsed-panel:mb'],
        destinationBoards: null
    },
    {
        name: 'Desktop Expanded',
        sourceName: 'morph-2-expanded-panel:dt',
        sourceBoard: null,
        destinationNames: ['morph-1-expanded-panel:dt', 'morph-3-expanded-panel:dt'],
        destinationBoards: null
    },
    {
        name: 'Desktop Collapsed',
        sourceName: 'morph-2-collapsed-panel:dt',
        sourceBoard: null,
        destinationNames: ['morph-1-collapsed-panel:dt', 'morph-3-collapsed-panel:dt'],
        destinationBoards: null
    }
];

async function normalizeAndPropagateRestStates(propagateOnly = false) { 
    debug && console.log("(Action Script) normalizeAndPropagateRestStates started.");
    let executionResult = { success: false, message: "", count: 0 };  
    try {      
        debug && console.log("(Action) Attempting to convert all layers to smart objects and then propagate them to the velocity state boards (using executeAsModal)...");
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            debug && console.log("(Modal Action) Starting to convert layers to smart objects...");
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            let successfulPropagations = 0;
            for (const actionRoute of actionRoutes) {
                actionRoute.sourceBoard = findValidGroups(activeDoc.layers, null, [actionRoute.sourceName])[0];
                actionRoute.destinationBoards = findValidGroups(activeDoc.layers, null, actionRoute.destinationNames);
            }

            debug && console.log("(Modal Action) Found boards:", actionRoutes);
            if(actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
                try {
                    for (let i = 0; i < actionRoutes.length; i++) {
                        const sourceBoard = actionRoutes[i].sourceBoard;
                        const targetBoards = actionRoutes[i].destinationBoards;
                        debug && console.log(`(Modal Action) Processing board: ${sourceBoard.name} Found ${targetBoards.length} targets for propagation`);                    
                        let sourceLayers;
                        let layerDuplicates = [];
                        if (!propagateOnly) {
                            try {
                                //rasterize and convert all layers to smart objects
                                const result = await convertAllLayersToSmartObjects(sourceBoard, rasterizeText, rasterizeLayerStyles);
                                console.log(`(Modal Action) Finished converting layers to smart objects on ${sourceBoard.name}`);                                
                                //then duplicate to velocity state boards
                                layerDuplicates = await duplicateBoardToBoard(sourceBoard, targetBoards);    
                                console.log(`(Modal Action) Finished duplicating ${sourceBoard.name} layers to velocity state boards.`);    
                            } catch (error) {
                                debug && console.error(`(Modal Action) Error converting layers to smart objects on ${sourceBoard.name}: ${error.message}`);
                                // Potentially non-critical, continue loop
                            }
                        } else {
                            layerDuplicates = await duplicateBoardToBoard(sourceBoard, targetBoards);
                            console.log(`(Modal Action) Finished duplicating ${sourceBoard.name} layers to velocity state boards.`); 
                        }
                        successfulPropagations += layerDuplicates.length;

                        for(const targetBoard of targetBoards) {
                            targetBoard.visible = true;
                        }

                        debug && console.log(`(Modal Action) Completed propagation of ${sourceLayers.length} layers to ${targetBoards.length} targets. ${layerDuplicates.length} new instances created.`);
                    } 
                    let message = `Propagated layers to velocity state boards. Instances created: ${successfulPropagations}.`;
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    debug && console.log("(Modal Action) normalizeAndPropagateRestStates finished successfully.");
                    executionResult = { success: true, message: message, count: successfulPropagations };
                    return executionResult;       
                } catch (error) {
                    debug && console.error("(Modal Action) Error in normalizeAndPropagateRestStates:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }
            }

        }, { "commandName": actionName });

        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Propagated ${result.count} layers to velocity state boards.`;
            debug && console.log(`(Action) ${message}`);
            return { success: true, count: result.count, message: message };
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during selection."; 
            debug && console.log(`(Action) ${message}`);
            await core.showAlert(message); 
            return { success: false, count: 0, message: message };
        }

    } catch (error) {
        debug && console.error("(Action Script) Error in normalizeAndPropagateRestStates:", error);
        await core.showAlert("An unexpected error occurred during normalizing and propagating rest states to velocity state boards. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { normalizeAndPropagateRestStates };

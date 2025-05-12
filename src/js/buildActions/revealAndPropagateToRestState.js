// client/js/actions/selectLayersByName.js
const { app, core, constants, action } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;
import { buildArtBoardSearchRegex } from '../helpers/utils.js';
import {findValidGroups, toggleHistory, duplicateAndMoveToBottom, convertAllLayersToSmartObjects, log } from '../helpers/helpers.js';
const actionName = 'Propagate Rest States to Velocity State Boards';

const rasterizeText = true;
const rasterizeLayerStyles = false;
            
const actionRoutes = [    
    {
        name: 'Mobile Expanded',
        sourceName: 'morph-2-expanded-panel:mb',
        device: 'desktop',
        sourceBoard: null,
        destinationNames: ['morph-2-expanded-panel:dt'],
        destinationBoards: null,
    },
    {
        name: 'Mobile Collapsed',
        sourceName: 'morph-2-collapsed-panel:mb',
        device: 'desktop',
        sourceBoard: null,
        destinationNames: ['morph-2-collapsed-panel:dt'],
        destinationBoards: null
    },
    
    {
        name: 'Desktop Expanded',
        sourceName: 'morph-2-expanded-panel:dt',
        device: 'mobile',
        sourceBoard: null,
        destinationNames: ['morph-2-expanded-panel:mb'],
        destinationBoards: null
    },
    {
        name: 'Desktop Collapsed',
        sourceName: 'morph-2-collapsed-panel:dt',
        device: 'mobile',
        sourceBoard: null,
        destinationNames: ['morph-2-collapsed-panel:mb'],
        destinationBoards: null
    }
];


async function centerInViewport(layers) {
    const layerIds = layers.map(layer => layer.id);
    console.log("(Modal Action) Centering in viewport:", layerIds);
    const commands = [
        {
            "_obj": "select",
            "_target": [
                {
                    "_name": layers[0].name,
                    "_ref": "layer"
                }
            ],
            "layerID": [...layerIds],
            "makeVisible": false,
            "selectionModifier": {
                "_enum": "selectionModifierType",
                "_value": "addToSelectionContinuous"
            }
        },
        {
            "_obj": "select",
            "_target": [
                {
                    "_ref": '$Mn ',
                    "_enum": '$FtOn',
                    "_value": 'fitOnScreen',
                },
            ]
        }
    ];
    await batchPlay(commands, {});
}

async function revealAndPropagateToRestState(action) { 
    log("(Action Script) revealAndPropagateToRestState started.");
    let executionResult = { success: false, message: "", count: 0 };  
    try {      
        log("(Action) Attempting to reveal and focus rest state artboards for a given device (using executeAsModal)...");
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            log("(Modal Action) Starting to convert layers to smart objects...");
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            const deviceBoardSubset = action.device === 'both' ? actionRoutes : actionRoutes.filter(route => route.device === action.device);
            for (const actionRoute of deviceBoardSubset) {
                actionRoute.sourceBoard = findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex([actionRoute.sourceName]))[0];
                actionRoute.destinationBoards = findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex([actionRoute.destinationNames]));
            }
            console.log("(Modal Action) Device Board Subset:", deviceBoardSubset);

            if(deviceBoardSubset.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
                try {
                    let successfulPropagations = 0;
                    for (let i = 0; i < deviceBoardSubset.length; i++) {
                        const actionRoute = deviceBoardSubset[i];
                        const sourceBoard = actionRoute.sourceBoard;
                        for(const sourceLayer of sourceBoard.layers) {
                            for(let j = 0; j < actionRoute.destinationBoards.length; j++) {
                                const targetContainer = actionRoute.destinationBoards[j];
                                const {duplicatedLayer, counter} = await duplicateAndMoveToBottom(sourceLayer, targetContainer, 0) 
                                targetContainer.visible = true;
                                targetContainer.selected = true;
                                successfulPropagations += counter;

                            }
                        }
                        log(`(Modal Action) Processing board: ${sourceBoard.name}`); 
                    } 
                    try {
                        const allDestinationBoardId = deviceBoardSubset.flatMap(o => o.destinationBoards);
                        console.log("(Modal Action) Focusing These Destination Boards:", allDestinationBoardId);
                        await centerInViewport(allDestinationBoardId);
                    } catch (error) {
                        console.error("(Modal Action) Error centering cloned boards:", error);
                    }
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    log("(Modal Action) revealAndPropagateToRestState finished successfully.");
                    executionResult = { success: true, message: "Revealed and focused rest state boards.", count: deviceBoardSubset.length };
                    return executionResult;       
                } catch (error) {
                    console.error("(Modal Action) Error in revealAndPropagateToRestState:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }
            }

        }, { "commandName": actionName });

        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Revealed and focused ${result.count} rest state boards.`;
            log(`(Action) ${message}`);
            return { success: true, count: result.count, message: message };
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during selection."; 
            log(`(Action) ${message}`);
            await core.showAlert(message); 
            return { success: false, count: 0, message: message };
        }

    } catch (error) {
        console.error("(Action Script) Error in revealAndFocusRestState:", error);
        await core.showAlert("An unexpected error occurred during revealing and focusing rest state boards. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { revealAndPropagateToRestState };

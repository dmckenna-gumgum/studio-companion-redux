// client/js/actions/selectLayersByName.js
const { app, core, constants, action } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory, duplicateBoardToBoard, convertAllLayersToSmartObjects, log } from '../helpers/helpers.js';
const actionName = 'Propagate Rest States to Velocity State Boards';

const rasterizeText = true;
const rasterizeLayerStyles = false;
            
const actionRoutes = [    
    {
        name: 'Mobile Expanded',
        device: 'mobile',
        sourceName: 'morph-2-expanded-panel:mb',
        sourceBoard: null,
        destinationNames: ['morph-1-expanded-panel:mb', 'morph-3-expanded-panel:mb'],
        destinationBoards: null,
    },
    {
        name: 'Mobile Collapsed',
        device: 'mobile',
        sourceName: 'morph-2-collapsed-panel:mb',
        sourceBoard: null,
        destinationNames: ['morph-1-collapsed-panel:mb', 'morph-3-collapsed-panel:mb'],
        destinationBoards: null
    },
    
    {
        name: 'Desktop Expanded',
        device: 'desktop',
        sourceName: 'morph-2-expanded-panel:dt',
        sourceBoard: null,
        destinationNames: ['morph-1-expanded-panel:dt', 'morph-3-expanded-panel:dt'],
        destinationBoards: null
    },
    {
        name: 'Desktop Collapsed',
        device: 'desktop',
        sourceName: 'morph-2-collapsed-panel:dt',
        sourceBoard: null,
        destinationNames: ['morph-1-collapsed-panel:dt', 'morph-3-collapsed-panel:dt'],
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
                    "_value": 'fitLayersOnScreen',
                },
            ]
        },
        {
            _obj: "select",
            _target: [
               {
                  _ref: "$Mn",
                  _enum: "$MnIt",
                  _value: "zoomOut",
               },
            ]
         },
         {
            _obj: "select",
            _target: [
               {
                  _ref: "$Mn",
                  _enum: "$MnIt",
                  _value: "zoomOut",
               },
            ]
         }
    ];
    await batchPlay(commands, {});
}


async function cloneAndPositionArtboard(route) {
    console.log("(Modal Action) Cloning and positioning artboard:", route.sourceBoard.name, route.sourceBoard.id);
    try {
        //if step 0, use the destination name, otherwise we're going to use
        console.log("(Modal Action) Destination Board Name:", route.destinationNames);    
        console.log("(Modal Action) Source Board Name:", route.sourceBoard.name);
        const clonedBoards = [];
        for(let i = 0; i < route.destinationNames.length; i++) {
            try { 
                //via duplicate
                const destinationName = route.destinationNames[i];
                const multiplier = (i & 1) ? -1 : 1;
                let xOffsetPct = {_unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -2020 : -960 };
                let yOffsetPct = {_unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 * multiplier : 617 * multiplier : route.device === 'desktop' ? -817 * multiplier : -617 * multiplier};
                console.log("(Modal Action) Translate To: ", xOffsetPct, yOffsetPct);
                const newBoard = await route.sourceBoard.duplicate(route.sourceBoard, ElementPlacement.PLACEBEFORE, destinationName);   
                newBoard.translate(xOffsetPct, yOffsetPct); 
                // log("(Modal Action) New Board Move Result:", newBoard);
                //await centerInViewport(existingBoards);
                clonedBoards.push(newBoard);
            } catch (error) {
                console.error("(Modal Action) Error moving new board:", error);
            }
        }
        return clonedBoards;
    } catch (error) {
        console.error("(Modal Action) Error cloning and positioning artboard:", error); 
        return [];
    }
}

async function normalizeAndPropagateRestStates(action, propagateOnly = false) { 
    log("(Action Script) normalizeAndPropagateRestStates started.");
    let executionResult = { success: false, message: "", count: 0 };  
    try {      
        log("(Action) Attempting to convert all layers to smart objects and then propagate them to the velocity state boards (using executeAsModal)...");
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            log("(Modal Action) Starting to convert layers to smart objects...");
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            let successfulPropagations = 0;
            const deviceBoardSubset = action.device === 'both' ? actionRoutes : actionRoutes.filter(route => route.device === action.device);


            for (const actionRoute of deviceBoardSubset) {
                actionRoute.sourceBoard = findValidGroups(activeDoc.layers, null, [actionRoute.sourceName])[0];
                actionRoute.destinationBoards = findValidGroups(activeDoc.layers, null, actionRoute.destinationNames);
            }

            if(deviceBoardSubset.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
                try {
                    for (let i = 0; i < deviceBoardSubset.length; i++) {
                        const route = deviceBoardSubset[i];
                        const sourceBoard = route.sourceBoard;
                        const targetBoards = []//actionRoutes[i].destinationBoards;
                        log(`(Modal Action) Processing board: ${sourceBoard.name} Found ${targetBoards.length} targets for propagation`);     
                        let layerDuplicates = [];
                        if (!propagateOnly) {
                            try {
                                //rasterize and convert all layers to smart objects
                                const result = await convertAllLayersToSmartObjects(sourceBoard, rasterizeText, rasterizeLayerStyles);
                                log(`(Modal Action) Finished converting layers to smart objects on ${sourceBoard.name}`);                                
                                //then duplicate to velocity state boards
                                
                                //layerDuplicates = await duplicateBoardToBoard(sourceBoard, targetBoards);    
                                layerDuplicates.push(...await cloneAndPositionArtboard(route));

                                //log(`(Modal Action) Finished duplicating ${sourceBoard.name} layers to velocity state boards.`);    
                            } catch (error) {
                                console.error(`(Modal Action) Error converting or duplicating layers on ${sourceBoard.name}: ${error.message}`);
                                // Potentially non-critical, continue loop
                            }
                        } else {
                            //layerDuplicates = await duplicateBoardToBoard(sourceBoard, targetBoards);
                            layerDuplicates.push(...await cloneAndPositionArtboard(route));
                            log(`(Modal Action) Finished duplicating ${sourceBoard.name} layers to velocity state boards.`); 
                        }
                        successfulPropagations += layerDuplicates.length;
                        route.destinationBoards.push(...layerDuplicates);
                        // for(const targetBoard of targetBoards) {
                        //     targetBoard.visible = true;
                        // }

                        console.log(`(Modal Action) Completed propagation of ${sourceBoard.layers.length} layers to ${targetBoards.length} targets. ${layerDuplicates.length} new instances created.`);
                    } 
                    try {
                        const allDestinationBoards = deviceBoardSubset.flatMap(o => o.destinationBoards);
                        await centerInViewport(allDestinationBoards);
                    } catch (error) {
                        console.error("(Modal Action) Error centering cloned boards:", error);
                    }
                    let message = `Propagated layers to velocity state boards. Instances created: ${successfulPropagations}.`;
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    log("(Modal Action) normalizeAndPropagateRestStates finished successfully.");
                    executionResult = { success: true, message: message, count: successfulPropagations };
                    return executionResult;       
                } catch (error) {
                    console.error("(Modal Action) Error in normalizeAndPropagateRestStates:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }
            }

        }, { "commandName": actionName });

        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Propagated ${result.count} layers to velocity state boards.`;
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
        console.error("(Action Script) Error in normalizeAndPropagateRestStates:", error);
        await core.showAlert("An unexpected error occurred during normalizing and propagating rest states to velocity state boards. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { normalizeAndPropagateRestStates };

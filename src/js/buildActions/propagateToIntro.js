// client/js/actions/selectLayersByName.js
const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory, log, rasterizeLayer, convertToSmartObject, duplicateBoardToBoard, convertAllLayersToSmartObjects } from '../helpers/helpers.js';

const debug = true;
const rasterizeText = false;    
const rasterizeLayerStyles = false;

async function cloneArtboard(board, name, x, y) {
    ///ALTERNATE WAY TO CLONE ARTBOARDS VIA BATCHPLAY. CURRENTLY USING NATIVE API COMMANDS SINCE THEY SEEM FASTER
    console.log("(Modal Action) Translate To: ", x, y);

    try {
        let commands = [
            {
                "_obj": "select",
                "_target": [
                    {
                        "_name": board.name,
                        "_ref": "layer"
                    }
                ],
                "layerID": [
                    board.id
                ],
                "makeVisible": false
            },
            {
                "ID": [
                    15029,
                    15030,
                    15031
                ],
                "_obj": "duplicate",
                "_target": [
                    {
                        "_enum": "ordinal",
                        "_ref": "layer",
                        "_value": "targetEnum"
                    }
                ],
                "version": 5
            },
            {
                "_obj": "move",
                "_target": [
                    {
                        "_enum": "ordinal",
                        "_ref": "layer",
                        "_value": "targetEnum"
                    }
                ],
                "to": {
                    "_obj": "offset",
                    "horizontal": {
                        "_unit": x._unit,
                        "_value": x._value
                    },
                    "vertical": {
                        "_unit": y._unit,
                        "_value": y._value
                    }
                }
            },
           
        ];
        const result = await batchPlay(commands, {});
        
        const newBoard = findValidGroups(app.activeDocument.layers, null, [name])[0];
        return newBoard;
    } catch (error) {
        console.error("(Modal Action) Error cloning artboard:", error);
    }
}

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
    ];
    await batchPlay(commands, {});
}


async function cloneAndPositionArtboard(route) {
    log("(Modal Action) Cloning and positioning artboard:", route.sourceBoard.name, route.sourceBoard.id);
    try {
        //if step 0, use the destination name, otherwise we're going to use
        const clonedBoardName = route.destinationName;
        log("(Modal Action) Cloned Board Name:", clonedBoardName);
        //if step > 0, rename the source board to the destination name
        const existingBoards = [];
        existingBoards.push(...await renamePreviousBoards(route));
        log("(Modal Action) Source Board Name:", route.sourceBoard.name);

        try { 
            ///via batchplay
            // let xOffsetPct = {_unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -860 : route.device === 'desktop' ? -5200 : -10 };
            // let yOffsetPct = {_unit: "pixelsUnit", _value: route.step === 0 ? 817 : -817};
            // const newBoard = await cloneArtboard(route.sourceBoard, clonedBoardName, xOffsetPct, yOffsetPct);
           
            //via duplicate
            let xOffsetPct = {_unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -5200 : -2112 };
            let yOffsetPct = {_unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 : 617 : route.device === 'desktop' ? -817 : -617};
            console.log("(Modal Action) Translate To: ", xOffsetPct, yOffsetPct);
            const newBoard = await route.sourceBoard.duplicate(route.sourceBoard, ElementPlacement.PLACEBEFORE, clonedBoardName);
            newBoard.translate(xOffsetPct, yOffsetPct); 
            existingBoards.push(newBoard);
            // await centerInViewport(newBoard);
            console.log("(Modal Action) All Boards Now:", existingBoards);
            // log("(Modal Action) New Board Move Result:", newBoard);
            await centerInViewport(existingBoards);
            return newBoard;
        } catch (error) {
            console.error("(Modal Action) Error moving new board:", error);
        }
    } catch (error) {
        console.error("(Modal Action) Error cloning and positioning artboard:", error); 
    }
}
 
async function renamePreviousBoards(route) {
    const boards = [];
    for (let i = route.step; i > 0; i--) {
        const existingName = `intro-${i}-panel:${route.abbr}`;
        const newName = `intro-${i+1}-panel:${route.abbr}`;
        console.log("(Modal Action) Renaming board:", existingName, "to", newName);
        try {
            const prevBoard = findValidGroups(app.activeDocument.layers, null, [existingName]);
            prevBoard[0].name = newName;
            boards.push(...prevBoard);
        } catch (error) {
            console.error("(Modal Action) Error renaming board:", error)
        }
    }
    return boards;
}

async function propagateToIntro(action) { 
    const actionName = `Create and Propagate To ${action.device} Intro Board Step ${action.step}`;
    const dAb = action.device === 'desktop' ? 'dt' : 'mb';
    const sourceBoardName = action.step === 0 ? `morph-2-expanded-panel:${dAb}` : `intro-1-panel:${dAb}`;
    const actionRoutes = [    
        {
            ...action,
            sourceBoardName: sourceBoardName,
            sourceBoard: null,
            destinationName: `intro-1-panel:${dAb}`,    
            destinationBoards: null,
            abbr: dAb,
        }
    ];
    console.log('(Action Script) propagateToIntro Action:', actionName);
    // let executionResult = { success: false, message: "", count: 0 };  
    try {      
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            console.log("(Modal Action) Starting to convert layers to smart objects...");
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            let successfulPropagations = 0;
            console.log("(Modal Action) Action Route:", actionRoutes);
            await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
            if(actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                try {
                    for (let i = 0; i < actionRoutes.length; i++) {
                        const actionRoute = actionRoutes[i];       
                        console.log(`(Modal Action) Finding Source Board Named: ${actionRoute.sourceBoardName}`)                 
                        const sourceBoard = actionRoute.sourceBoard = findValidGroups(activeDoc.layers, null, [actionRoute.sourceBoardName])[0];
                        
                        ///make new artboards
                        console.log(`(Modal Action) Creating a New Target Board: ${actionRoute.destinationName}`); 
                        const targetBoard = await cloneAndPositionArtboard(actionRoute);
                        console.log(`(Modal Action) Completed duplication of ${sourceBoard.name} to ${targetBoard.name}.`);
                    } 
                    let message = `Propagated layers to intro boards. Instances created: ${successfulPropagations}.`;
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    console.log("(Modal Action) propagateToIntro finished successfully.");
                    return { success: true, message: message, count: successfulPropagations, payload: actionRoutes };
                } catch (error) {
                    console.error("(Modal Action) Error in propagateToIntro:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }
            }

        }, { "commandName": actionName });


        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Propagated ${result.count} layers to intro board`;
            log(`(Action) ${message}`);
            return result;
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during selection."; 
            log(`(Action) ${message}`);
            await core.showAlert(message); 
            return result;
        }

    } catch (error) {
        console.error("(Action Script) Error in propagateToIntro:", error);
        await core.showAlert("An unexpected error occurred during normalizing and propagating rest states to velocity state boards. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { propagateToIntro };

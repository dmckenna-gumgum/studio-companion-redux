// client/js/actions/selectLayersByName.js
const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory, rasterizeLayer, convertToSmartObject, duplicateBoardToBoard, convertAllLayersToSmartObjects } from '../helpers/helpers.js';

const debug = false;
const rasterizeText = false;    
const rasterizeLayerStyles = false;


async function cloneAndPositionArtboard(route) {
    console.log("(Modal Action) Cloning and positioning artboard:", route.sourceBoard.name, route.sourceBoard.id);
    const newBoard = await route.sourceBoard.duplicate(app.activeDocument, ElementPlacement.PLACEATBEGINNING, `intro-${route.step+1}-panel:${route.abbr}`);
    let xOffsetPct = {_unit: "percentUnit", _value: -80};
    let yOffsetPct = {_unit: "percentUnit", _value: 18};
    newBoard.translate(xOffsetPct, yOffsetPct);
    console.log("(Modal Action) New Board Move Result:", newBoard);
    return newBoard;
}

async function createNewArtboards(boardNames, sourceBoard) {
    const newBoards = [];
    console.log("(Modal Action) Getting Position of Board:", sourceBoard.name);
    try {
        const sourcePosition = await getLayerPosition(sourceBoard.id);
        console.log("(Modal Action) Source Position:", sourcePosition);
    } catch (error) {
        console.error("(Modal Action) Error getting source position:", error);
    }
    // console.log("(Modal Action) Source Position:", sourcePosition);
    // for (const boardName of boardNames) {
    //     const newBoard = await createArtboard(boardName);
    //     newBoards.push(newBoard);
    // }
    // return newBoards;
}

///////NEXT TO DO: MAKE THIS RETURN THE SUBSTEP NUMBER, THEN PASS AN INCREMENTED NUMBER VIA SUBSET UI THAT 
///////CONDITIONALLY SETS THE SOURCENAME TO ANOTHER INTRO BOARD, ADD THE LOGIC TO RENAME BOARDS AS YOU INCREMENT BACKWARDS
////
async function propagateToIntro(device = 'desktop') { 
    const actionName = `Create and Propagate To ${device} Intro Board`;
    const dAb = device === 'desktop' ? 'dt' : 'mb';
    let step = 0;
    const actionRoutes = [    
        {
            name: `New ${device} Intro Panel`,
            sourceName: `morph-2-expanded-panel:${dAb}`,
            sourceBoard: null,
            destinationNames: [`intro-${step}-panel:${dAb}`],
            destinationBoards: null,
            abbr: dAb,
            step: step
        }
    ];
    console.log(`(Action Script) propagateToIntro started for ${device} Intro.`);
    let executionResult = { success: false, message: "", count: 0 };  
    try {      
        console.log("(Action) Create an Intro Artboard and Propagate expanded-panel-2 intro it (using executeAsModal)...");
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            debug && console.log("(Modal Action) Starting to convert layers to smart objects...");
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            let successfulPropagations = 0;

            console.log("(Modal Action) Found boards:", actionRoutes);
            if(actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
                try {
                    for (let i = 0; i < actionRoutes.length; i++) {
                        const actionRoute = actionRoutes[i];                        
                        const sourceBoard = actionRoute.sourceBoard = findValidGroups(activeDoc.layers, null, [actionRoute.sourceName])[0];

                        ///make new artboards
                        console.log(`(Modal Action) Creating a New Target Board: ${actionRoute.destinationNames}`); 
                        try {
                            const targetBoard = await cloneAndPositionArtboard(actionRoute);
                        } catch (error) {
                            console.error("(Modal Action) Error cloning and positioning artboard:", error);
                        }
                        //actionRoute.destinationBoards = [targetBoard];
                        console.log(`(Modal Action) Completed duplication of ${sourceBoard.name} to ${targetBoards.length} targets.`);
                    } 
                    let message = `Propagated layers to velocity state boards. Instances created: ${successfulPropagations}.`;
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    console.log("(Modal Action) propagateToIntro finished successfully.");
                    executionResult = { success: true, message: message, count: successfulPropagations, payload: actionRoute };
                    return executionResult;       
                } catch (error) {
                    console.error("(Modal Action) Error in propagateToIntro:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }
            }

        }, { "commandName": actionName });


        // --- Process Result from Modal --- 
        if (result.success) {
            const message = `Propagated ${result.count} layers to velocity state boards.`;
            console.log(`(Action) ${message}`);
            return { success: true, count: result.count, message: message };
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during selection."; 
            console.log(`(Action) ${message}`);
            await core.showAlert(message); 
            return { success: false, count: 0, message: message };
        }

    } catch (error) {
        console.error("(Action Script) Error in propagateToIntro:", error);
        await core.showAlert("An unexpected error occurred during normalizing and propagating rest states to velocity state boards. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { propagateToIntro };

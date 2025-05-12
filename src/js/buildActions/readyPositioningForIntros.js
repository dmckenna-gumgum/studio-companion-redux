// client/js/actions/selectLayersByName.js
const { app, core, constants, action } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory, duplicateBoardToBoard, convertAllLayersToSmartObjects } from '../helpers/helpers.js';
import { createLogger } from '../helpers/logger.js';
import { replaceStep, buildArtBoardSearchRegex } from '../helpers/utils.js';

const logger = createLogger({ prefix: 'readyPositioningForIntros', initialLevel: 'DEBUG' });
            


const verticalSpace = 150;
const horizontalSpace = {
    mobile: 960,
    desktop: 2020
}
const startingOffsetAmount = 300;

const actionName = 'Ready Positioning for Intros';

async function readyPositioningForIntros(action, creativeState) { 
    try {      
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            action.sequences = ['expanded', 'collapsed'];
            // logger.debug("Moving Artboards:");   
            // logger.debug("State:", creativeState);
            // logger.debug("Action:", action);
            const newState = {...creativeState}            
            const deviceTypes = Object.values(newState).filter(deviceType => action.device.includes(deviceType.device));
            // logger.debug("Device Types:", deviceTypes);
            // logger.debug("Action Sequences:", action.sequences);
            const sequencesToEdit = deviceTypes.flatMap(deviceType => 
                Object.values(deviceType.sequences).filter(sequence => 
                    action.sequences.includes(sequence.name)
                )
            );
            ///this is bad and i'll fix it later///
            const sequenceTotalFrames = 3;
            logger.debug("Sequences to Edit:", sequencesToEdit);
            const actionRoutes = [];
            ////i'm building these actionRoutes to nomalize the data structure when sending commands to photoshop action functions
            for (const ind in sequencesToEdit) {
                const sequence = sequencesToEdit[ind];
                console.log("Sequence:", sequence);    
                const sourceNames = [];
                const sourceBoards = [];     
                for(let i = 0; i < sequenceTotalFrames; i++) {
                    const sourceName = replaceStep(sequence.artboardNamePattern, i+1);
                    sourceNames.push(sourceName);
                    sourceBoards.push(...findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex([sourceName])));
                    // logger.debug("Source Names:", sourceNames);
                    // logger.debug("Source Boards:", sourceBoards);
                    
                }   
                    
                actionRoutes.push({
                    name: sequence.name,
                    device: sequence.device,
                    sourceNames: sourceNames,
                    sourceBoards: sourceBoards,
                    sequenceState: sequence
                });
                /*
                    this assumes the boards are already in the state, the above finds them in the document manually.
                    const sourceNames = sequence.artboards.map((artboard) => artboard.name);
                    const sourceBoards =sequence.artboards.map((artboard) => artboard.board); //findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex(sourceNames));
                    logger.debug("Source Names:", sourceNames);
                    logger.debug("Source Boards:", sourceBoards);
                    actionRoutes.push({
                        name: sequence.name,
                        device: sequence.device,
                        sourceNames: sourceNames,
                        sourceBoards: sourceBoards,
                        sequenceState: sequence
                    });
                */
            } 
            console.log("Action Routes:", actionRoutes);
            if(actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                try {
                    let successfulMoves = 0;
                    await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
                    // let successfulMoves = 0;
                    // for(const route of actionRoutes) {
                    //     for(const sourceBoard of route.sourceBoards) {          
                    //         let xOffsetPct = {_unit: "pixelsUnit", _value: -200 };
                    //         let yOffsetPct = {_unit: "pixelsUnit", _value: -200 };
                    //         ///move goes here///
                    //         try {
                    //             logger.debug(`(Modal Action) Translate ${sourceBoard.id}:${sourceBoard.name} To: ${xOffsetPct._value} ${yOffsetPct._value}`);
                    //             await sourceBoard.translate(xOffsetPct, yOffsetPct);
                    //             logger.debug(`(Modal Action) Done Moving ${sourceBoard.id}:${sourceBoard.name}`);
                    //             successfulMoves++;
                    //         } catch (error) {
                    //             console.error(`Error moving artboard ${sourceBoard.id}:${sourceBoard.name}: ${error.message}`);
                    //         }
                    //     }
                    // }             
                    const movePromises = actionRoutes.flatMap(route => {
                        // Process all boards in the route.sourceBoards array
                        return route.sourceBoards.map(async (board, index) => {
                            try {
                                // You might want different offsets for different boards in the sequence
                                // For now using the same offset for all
                                let xOffsetPct = {_unit: "percentUnit", _value: -200 };
                                let yOffsetPct = {_unit: "percentUnit", _value: -200 };
                                
                                logger.debug(`(Modal Action) Translate ${board.id}:${board.name} To: ${xOffsetPct._value} ${yOffsetPct._value}`);
                                // Use numbers directly as translate expects numbers
                                await board.translate(xOffsetPct, yOffsetPct);
                                logger.debug(`(Modal Action) Done Moving ${board.id}:${board.name}`);
                                return true; // Move succeeded
                            } catch (error) {
                                console.error(`Error moving artboard ${board.id}:${board.name}: ${error.message}`);
                                await toggleHistory(hostControl, "resume", activeDoc.id);
                                return false; // Move failed
                            }
                        });
                    });
                    
                    // Wait for all moves to complete
                    const moveResults = await Promise.all(movePromises);
                    successfulMoves = moveResults.filter(result => result).length;             
                    logger.debug("Return State:", creativeState);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    let message = `Moved ${successfulMoves} Artboards to their final positions.`;
                    return { success: false, message: message, payload: creativeState, count: successfulMoves };   

                } catch (error) {
                    console.error("(Modal Action) Error in normalizeAndPropagateRestStates:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }             
            }
           /*
            const deviceRouteSubset = action.device === 'both' ? actionRoutes : actionRoutes.filter(route => route.device === action.device);
            for (const actionRoute of deviceBoardSubset) {
                actionRoute.sourceBoards = findValidGroups(activeDoc.layers, null, actionRoute.sourceNames);
            }
            try {
                const movedBoards = [];
                for(let i = 0; i<=deviceRouteSubset.length-1; i++) {
                    const actionRoute = deviceRouteSubset[i];
                    const {sourceBoards} = actionRoute;
                    for(const sourceBoard of sourceBoards) {                        
                        let xOffsetPct = {_unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -2020 : -960 };
                        let yOffsetPct = {_unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 * multiplier : 617 * multiplier : route.device === 'desktop' ? -817 * multiplier : -617 * multiplier};
                        logger.debug("(Modal Action) Translate To: ", xOffsetPct, yOffsetPct);
                        ///move goes here///
                        movedBoards.push(sourceBoard);
                    }
                }
                
                await toggleHistory(hostControl, "resume", activeDoc.id);
                logger.debug("(Modal Action) readyPositioningForIntros finished successfully.");
                return { success: true, message: `Moved ${movedBoards.length} artboards to their final positions.`, count: movedBoards.length };;       
            } catch (error) {
                console.error("(Modal Action) Error in readyPositioningForIntros:", error);
                await toggleHistory(hostControl, "resume", activeDoc.id);
                return { success: false, message: `Error: ${error.message || error}`, count: 0 };
            }
            */
            
 
        }, { "commandName": actionName });

        // --- Process Result from Modal --- 
        if (result.success) {
            logger.debug(`(Action) ${result.message}`);
            return result;
        } else {
            logger.debug(`(Action) ${result.message}`);
            //await core.showAlert(result.message); 
            return result
        }

    } catch (error) {
        console.error("(Action Script) Error in readyPositioningForIntros:", error);
        //await core.showAlert("An unexpected error occurred during readying artboard positions for intros. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { readyPositioningForIntros };

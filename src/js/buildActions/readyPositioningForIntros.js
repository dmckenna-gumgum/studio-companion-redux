// client/js/actions/selectLayersByName.js
const { app, core, action } = require('photoshop');
const { constants: Constants } = require("photoshop");
const { batchPlay } = action;
const { ElementPlacement } = Constants;

import {findValidGroups, toggleHistory, moveBoardAndGuide } from '../helpers/helpers.js';
import { createLogger } from '../helpers/logger.js';
import { buildArtBoardSearchRegex, cartesianProduct } from '../helpers/utils.js';

const logger = createLogger({ prefix: 'readyPositioningForIntros', initialLevel: 'DEBUG' });
const actionName = 'Ready Positioning for Intros';
const doc = app.activeDocument;

async function readyPositioningForIntros(action, stateToPass, options) { 
    try {      
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            const action = {
                sequences: ['expanded', 'collapsed'],
                deviceTypes: ['dt'],
                frames: [1,2,3]
            };

            const dx = 0;
            const dy = -500;
            
            try {
                await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);    
                const sequencesToEdit = cartesianProduct(action.sequences, action.deviceTypes, action.frames);
                const selectPromises = sequencesToEdit.map(async (sequence) => {
                    const sourceName = `morph-${sequence[2]}-${sequence[0]}-panel:${sequence[1]}`;
                    try {
                      const [sourceBoard] = await findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex([sourceName]));
                      if (!sourceBoard) return null;                  
                      sourceBoard.selected = true;
                      return sourceBoard;
                    } catch (error) {
                      console.error(`Error selecting artboard: ${sourceName}: ${error.message}`);
                      return null;
                    }
                });   
                const possibleBoards = await Promise.all(selectPromises);
                const validBoards = possibleBoards.filter(board => board);
                console.log('SOURCE BOARDS', validBoards); 
                const framesAndGuides = await Promise.all(
                    validBoards.map(async ab => {
                        await moveBoardAndGuide(ab, dx, dy);
                    })
                );
                console.log('MOVED BOARDS AND GUIDES', framesAndGuides); 

                let successfulMoves = validBoards.length; 
                await toggleHistory(hostControl, "resume", activeDoc.id);
                let message = `Moved ${successfulMoves} Artboards to their final positions.`;
                return { success: true, message: message, payload: null, count: successfulMoves };   

            } catch (error) {
                console.error("(Modal Action) Error in readyPositioningForIntros:", error);
                await toggleHistory(hostControl, "resume", activeDoc.id);
                return { success: false, message: `Error: ${error.message || error}`, count: 0 };
            }                 
 
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

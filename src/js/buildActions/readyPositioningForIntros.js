// client/js/actions/selectLayersByName.js
const { app, core, constants, action } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory, duplicateBoardToBoard, convertAllLayersToSmartObjects, log } from '../helpers/helpers.js';
const actionName = 'Ready Artboard Positions For Intro Sequencing';
            
const actionRoutes = [    
    {
        name: 'Mobile Expanded',
        device: 'mobile',
        type: 'expanded',
        sourceNames: ['morph-1-expanded-panel:mb', 'morph-2-expanded-panel:mb', 'morph-3-expanded-panel:mb'],
        sourceBoards: [],
        destinationNames: [],
        destinationBoards: [],
    },
    {
        name: 'Mobile Collapsed',
        device: 'mobile',
        type: 'collapsed',
        sourceNames: ['morph-1-collapsed-panel:mb', 'morph-2-collapsed-panel:mb', 'morph-3-collapsed-panel:mb'],
        sourceBoards: [],
        destinationNames: [],
        destinationBoards: [],
    },
    {
        name: 'Desktop Expanded',
        device: 'desktop',
        type: 'expanded',
        sourceNames: ['morph-1-expanded-panel:dt', 'morph-2-expanded-panel:dt', 'morph-3-expanded-panel:dt'],
        sourceBoards: [],
        destinationNames: [],
        destinationBoards: [],
    },
    {
        name: 'Desktop Collapsed',
        device: 'desktop',
        type: 'collapsed',
        sourceNames: ['morph-1-collapsed-panel:dt', 'morph-2-collapsed-panel:dt', 'morph-3-collapsed-panel:dt'],
        sourceBoards: [],
        destinationNames: [],
        destinationBoards: [],
    },
];

const verticalSpace = 150;
const horizontalSpace = {
    mobile: 960,
    desktop: 2020
}
const startingOffsetAmount = 300;

async function readyPositioningForIntros(action) { 
    log("(Action Script) readyPositioningForIntros started.");
    try {      
        log("(Action) Attempting to Move All Existing Artboards to Position Them In A Way Where Subsequent Intro Boards Do Not Collide With Existing Artboards (using executeAsModal)...");
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            log("(Modal Action) Starting to move artboards...");
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
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
                        console.log("(Modal Action) Translate To: ", xOffsetPct, yOffsetPct);
                        ///move goes here///
                        movedBoards.push(sourceBoard);
                    }
                }
                
                await toggleHistory(hostControl, "resume", activeDoc.id);
                log("(Modal Action) readyPositioningForIntros finished successfully.");
                return { success: true, message: `Moved ${movedBoards.length} artboards to their final positions.`, count: movedBoards.length };;       
            } catch (error) {
                console.error("(Modal Action) Error in readyPositioningForIntros:", error);
                await toggleHistory(hostControl, "resume", activeDoc.id);
                return { success: false, message: `Error: ${error.message || error}`, count: 0 };
            }
            
 
        }, { "commandName": actionName });

        // --- Process Result from Modal --- 
        if (result.success) {
            log(`(Action) ${result.message}`);
            return result;
        } else {
            log(`(Action) ${result.message}`);
            await core.showAlert(result.message); 
            return result
        }

    } catch (error) {
        console.error("(Action Script) Error in readyPositioningForIntros:", error);
        await core.showAlert("An unexpected error occurred during readying artboard positions for intros. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { readyPositioningForIntros };

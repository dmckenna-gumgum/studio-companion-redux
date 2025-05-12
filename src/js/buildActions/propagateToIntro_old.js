// client/js/actions/selectLayersByName.js
const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory, log, rasterizeLayer, convertToSmartObject, duplicateBoardToBoard, convertAllLayersToSmartObjects } from '../helpers/helpers.js';
import { buildArtBoardSearchRegex, findInArray } from '../helpers/utils.js';

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
    // log("(Modal Action) Cloning and positioning artboard:", route.sourceBoard.name, route.sourceBoard.id);
    try {
        //if step 0, use the destination name, otherwise we're going to use
        const clonedBoardName = route.destinationName;
        // log("(Modal Action) Cloned Board Name:", clonedBoardName);
        //if step > 0, rename the source board to the destination name
        const existingBoards = [];
        existingBoards.push(...await renamePreviousBoards(route));
        // log("(Modal Action) Source Board Name:", route.sourceBoard.name);

        try {           
            //via duplicate
            const newBoard = await route.sourceBoard.duplicate(route.sourceBoard, ElementPlacement.PLACEBEFORE, clonedBoardName);
            // console.log("(Modal Action) New Board Name:", newBoard.name);
            let xOffsetPct = {_unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -5200 : -2112 };
            let yOffsetPct = {_unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 : 617 : route.device === 'desktop' ? -817 : -617};
            // console.log("(Modal Action) Translate To: ", xOffsetPct, yOffsetPct);
            newBoard.translate(xOffsetPct, yOffsetPct); 
            existingBoards.push(newBoard);
            route.sequence.artboards.push(newBoard);
            // await centerInViewport(newBoard);
            // console.log("(Modal Action) All Boards Now:", existingBoards);
            // log("(Modal Action) New Board Move Result:", newBoard);
            await centerInViewport(existingBoards);
            return {route: route, board: newBoard};
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
        // console.log("(Modal Action) Renaming board:", existingName, "to", newName);
        try {
            const prevBoard = findValidGroups(app.activeDocument.layers, null, buildArtBoardSearchRegex([existingName]));
            prevBoard[0].name = newName;
            boards.push(...prevBoard);
        } catch (error) {
            // console.error("(Modal Action) Error renaming board:", error)
        }
    }
    return boards;
}

///this is an utter mess. Desperately need to simplify things because it's so convoluted right now.

  
function insertToSequences(state, options) {

    ////this insertion logic is clunky and could probably be refactored to use Maps instead
    const sequenceBoard = {...options}
    const sequencesArray = state.find((section) => section.device === options.device).sequences;
    const sequenceObj = sequencesArray.find((sequence) => sequence.name === options.name);
    sequenceObj.artboards.push(sequenceBoard);  
    return state;
}

async function propagateToIntro(action, creativeSections) { 
    const activeDoc = app.activeDocument;   
    console.log('creativeSections', creativeSections);
    console.log('action', action);
    const actionRoutes = [];
    let actionName;
    creativeSections.forEach((section) => {
        console.log('making actions for this section', section);
        action.sequences.forEach((sequenceType, index) => {
            let sequence;
            let sequenceIndex; 
            if(findInArray(section.sequences, { name: sequenceType }).length === 0) {
                console.log('no sequence found for', sequenceType);
                sequence ={name: sequenceType, artboards: [], device: section.device}
                sequenceIndex = section.sequences.length;
            } else {
                sequence = findInArray(section.sequences, { name: sequenceType })
                sequenceIndex = section.sequences.findIndex((seq) => seq.name === sequenceType);
                console.log('sequence found for', sequence, sequenceType, sequenceIndex);
            }        


            const step = sequence && sequence.artboards !== undefined ? sequence.artboards.length : 0;
            actionName = `Create and Propagate ${section.device} ${sequenceType} Board Step ${step}`;
            console.log('actionName', actionName)
            const dAb = section.device === 'desktop' ? 'dt' : 'mb';
            const sourceBoardName = step === 0 ? `morph-2-expanded-panel:${dAb}` : `intro-1-panel:${dAb}`;
    
            actionRoutes.push(   
                {
                    ...action,
                    device: section.device,
                    step: step,
                    sourceBoardName: sourceBoardName,
                    sourceBoard: findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex([sourceBoardName]))[0],
                    destinationName: `intro-1-panel:${dAb}`,    
                    destinationBoards: null,
                    abbr: dAb,
                    sequence: sequence,
                    section: section,
                    sectionIndex: index,
                    sequenceIndex: sequenceIndex
                }
            );
        });
    })
    try {      
        // --- Execute Selection Logic within Modal Context --- 
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            let successfulPropagations = 0;
            await toggleHistory(hostControl, "suspend", activeDoc.id, actionName);
            if(actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                try {
                    const sequenceState = [];

                    for (let i = 0; i < actionRoutes.length; i++) {
                        const actionRoute = actionRoutes[i];       
                        // console.log(`(Modal Action) Finding Source Board Named: ${actionRoute.sourceBoardName}`)                 
                        const sourceBoard = actionRoute.sourceBoard;
                        
                        ///make new artboards
                        // console.log(`(Modal Action) Creating a New Target Board: ${actionRoute.destinationName}`); 
                        const {route, board} = await cloneAndPositionArtboard(actionRoute);
                        console.log('route after aadding artboard: ', route);
                        console.log('new board is: ', board);
                        sequenceState.push(route.sequence);
                        
                        creativeSections[route.sectionIndex].sequences[route.sequenceIndex] = route.sequence;
                        // console.log(`(Modal Action) Completed duplication of ${sourceBoard.name} to ${targetBoard.name}.`);
                    } 
                    console.log('sequenceState: ', sequenceState);
                    let message = `Propagated layers to intro boards. Instances created: ${sequenceState.length}.`;
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    // console.log("(Modal Action) propagateToIntro finished successfully.");
                    return { success: true, message: message, count: sequenceState.length, payload: creativeSections };
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

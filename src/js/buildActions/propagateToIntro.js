// client/js/actions/selectLayersByName.js
const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import {findValidGroups, toggleHistory } from '../helpers/helpers.js';
import { buildArtBoardSearchRegex, pickProps, replaceStep } from '../helpers/utils.js';
import { createLogger } from '../helpers/logger.js';

const logger = createLogger({ prefix: 'propagateToIntro', initialLevel: 'DEBUG' });

async function centerInViewport(layers) {
    const layerIds = layers.map(layer => layer.id);
    console.log("(Modal Action) Centering in viewport:", layerIds);
    const commands = [
        {
            _obj: "select",
            _target: [
                {
                    _name: layers[0].name,
                    _ref: "layer"
                }
            ],
            layerID: [...layerIds],
            makeVisible: false,
            selectionModifier: {
                _enum: "selectionModifierType",
                _value: "addToSelectionContinuous"
            }
        },
        {
            _obj: "select",
            _target: [
                {
                    _ref: '$Mn ',
                    _enum: '$FtOn',
                    _value: 'fitLayersOnScreen',
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
    try {
        const clonedBoards = [];   
        route.sequenceState.artboards = route.sequenceState.artboards.length > 0 ? await renamePreviousBoards(route) : route.sequenceState.artboards;
        ///NEW CLONE WILL ALWAYS BE STEP 1 IN THE SEQUENCE;
        const clonedBoardName = route.destinationName;
        const newBoard = await route.sourceBoard.duplicate(route.sourceBoard, ElementPlacement.PLACEBEFORE, clonedBoardName);
        // console.log("(Modal Action) New Board Name:", newBoard.name);
        let xOffsetPct = {_unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -4200 : -2060 };
        let yOffsetPct = {_unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 : 617 : route.device === 'desktop' ? -817 : -617};
        logger.debug(`(Modal Action) Translating ${route.device} board on ${route.step} To: ${xOffsetPct._value} ${yOffsetPct._value}`);
        newBoard.translate(xOffsetPct, yOffsetPct); 
        clonedBoards.push(newBoard);
        route.sequenceState.artboards.push({
            name: clonedBoardName,
            id: newBoard.id,
            step: 0,
            board: newBoard
        });
        try {
            await centerInViewport(clonedBoards);
        } catch (error) {
            console.error("(Modal Action) Error centering new board:", error);
        }
        return {boards: clonedBoards, state: route.sequenceState};    
    } catch (error) {
        console.error("(Modal Action) Error cloning and positioning artboard:", error); 
        return [];
    }
}
 

async function renamePreviousBoards(route) {
    const boards = [];
    for(let i = 0; i<route.sequenceState.artboards.length; i++) {
        const artboard = route.sequenceState.artboards[i];
        const newStep = i+2;
        const newName = `intro-${newStep}-panel:${route.sequenceState.abbreviation}`;
        logger.debug(`Renaming board: ${artboard.name} to ${newName}`);
        artboard.board.name = artboard.name = newName;
        artboard.step = artboard.step + 1;
        boards.push(artboard);
    }
    return boards;
}

async function propagateToIntro(action, creativeState) { 
    try {      
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;   
            // logger.debug("Creating Intro Board:");   
            // logger.debug("State:", creativeState);
            // logger.debug("Action:", action);
            const newState = {...creativeState}            
            const deviceTypes = Object.values(newState);
            // logger.debug("Device Types:", deviceTypes);
            // logger.debug("Action Sequences:", action.sequences);
            const sequencesToEdit = deviceTypes.map((device) => device.sequences).map(seq => pickProps(seq, action.sequences));            
            logger.debug("Sequences to Edit:", sequencesToEdit);
            
            const actionRoutes = [];

            ////i'm building these actionRoutes to nomalize the data structure when sending commands to photoshop action functions            
            sequencesToEdit.forEach((sequenceTypes) => {
                for (const sequenceType in sequenceTypes) {
                    
                    const sequence = sequenceTypes[sequenceType];   
                    ///the source will either be morph-2 for the first intro board, or intro-1 for any other situation;
                    const sourceName = sequence.artboards.length === 0 ? `morph-2-expanded-panel:${sequence.abbreviation}` : replaceStep(sequence.artboardNamePattern, 1);
                    ////complex lookup not needed if it's pulling from the previous intro board
                    const sourceBoard = sequence.artboards.length === 0 ? findValidGroups(activeDoc.layers, null, buildArtBoardSearchRegex([sourceName]))[0] : sequence.artboards.find((artboard) => artboard.board.name === sourceName).board;
                    const actualStep = sequence.artboards.length;
                    const visualStep = actualStep + 1;
                    const destinationBoardName = replaceStep(sequence.artboardNamePattern, 1);///clunky and does not allow for more boards yet. should revisit if that changes on the studio side.                      
                    logger.debug("Source Name:", sourceName, "Source Board:", sourceBoard, "Destination Name:", destinationBoardName);
                    actionRoutes.push({
                        name: sequence.name,
                        device: sequence.device,
                        sourceName: sourceName,
                        sourceBoard: sourceBoard,
                        destinationName: destinationBoardName,
                        destinationBoards: [],
                        step: actualStep,
                        visualStep: visualStep,
                        sequenceState: sequence
                    });
                }
            });         

            if(actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                try {
                    await toggleHistory(hostControl, "suspend", activeDoc.id, action.name);
                    let successfulPropagations = 0;
                    for(const route of actionRoutes) {
                        try {   
                            // console.log(`(Modal Action) Creating a New Target Board: ${actionRoute.destinationName}`); 1
                            const {state, boards} = await cloneAndPositionArtboard(route);
                            state.artboards = state.artboards.sort((a, b) => a.step - b.step);
                            logger.debug("Boards:", state.artboards);
                            creativeState[state.device].sequences[state.name] = state;
                            successfulPropagations += boards.length;                                
                            // console.log(`(Modal Action) Completed duplication of ${sourceBoard.name} to ${targetBoard.name}.`);
                        } catch (error) {
                            console.error(`Error converting or duplicating layers on ${sourceBoard.name}: ${error.message}`);
                            // Potentially non-critical, continue loop
                        }
                    }                          
                    logger.debug("Return State:", creativeState);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    let message = `Created ${successfulPropagations} New Intro Boards.`;
                    return { success: true, message: message, payload: creativeState, count: successfulPropagations };   

                } catch (error) {
                    console.error("(Modal Action) Error in normalizeAndPropagateRestStates:", error);
                    await toggleHistory(hostControl, "resume", activeDoc.id);
                    return { success: false, message: `Error: ${error.message || error}`, count: 0 };
                }             
            }
        }, { "commandName": action.name });
        // --- Process Result from Modal --- 
        if (result.success) {
            logger.debug(result);
            return result;
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during selection."; 
            await core.showAlert(message); 
            return result;
        }
    } catch (error) {
        console.error("(Action Script) Error in normalizeAndPropagateRestStates:", error);
        await core.showAlert("An unexpected error occurred during normalizing and propagating rest states to velocity state boards. Check the console for details.");
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { propagateToIntro };

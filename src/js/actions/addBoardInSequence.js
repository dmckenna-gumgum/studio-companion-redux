// client/js/actions/selectLayersByName.js
const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import { findValidGroups, toggleHistory } from '../helpers/helpers.js';
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
        let xOffsetPct = { _unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -4200 : -2060 };
        let yOffsetPct = { _unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 : 617 : route.device === 'desktop' ? -817 : -617 };
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
        return { boards: clonedBoards, state: route.sequenceState };
    } catch (error) {
        console.error("(Modal Action) Error cloning and positioning artboard:", error);
        return [];
    }
}


async function renamePreviousBoards(route) {
    const boards = [];
    for (let i = 0; i < route.sequenceState.artboards.length; i++) {
        const artboard = route.sequenceState.artboards[i];
        const newStep = i + 2;
        const newName = `intro-${newStep}-panel:${route.sequenceState.abbreviation}`;
        logger.debug(`Renaming board: ${artboard.name} to ${newName}`);
        artboard.board.name = artboard.name = newName;
        artboard.step = artboard.step + 1;
        boards.push(artboard);
    }
    return boards;
}

function pluck(obj, keys) {
    return keys.reduce((values, key) => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            values.push(obj[key]);
        }
        return values;
    }, []);
}

async function addBoardInSequence(filter, artboard) {
    try {
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;

            const { before, number, after } = parsePanelName(artboard.name);
            const device = before === 'intro' ? 'desktop' : before;
            const state = after === 'panel' ? 'intro' : after;

            if (actionRoutes.length === 0) {
                await core.showAlert("No valid boards found.");
                return { success: false, message: "No valid boards found.", count: 0 };
            } else {
                try {
                    await toggleHistory(hostControl, "suspend", activeDoc.id, action.name);
                    let successfulPropagations = 0;
                    for (const route of actionRoutes) {
                        try {
                            // console.log(`(Modal Action) Creating a New Target Board: ${actionRoute.destinationName}`); 1
                            const { state, boards } = await cloneAndPositionArtboard(route);
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
export { addBoardInSequence };

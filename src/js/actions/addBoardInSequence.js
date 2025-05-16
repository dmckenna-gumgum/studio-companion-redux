// client/js/actions/addBoardInSequence.js
const { app, core, action, constants } = require('photoshop');
const { batchPlay } = action;
const { ElementPlacement } = constants;

import { findValidGroups, toggleHistory, getArtboardFrame, moveBoardAndGuide } from '../helpers/helpers.js';
import { buildArtBoardSearchRegex, pickProps, replaceStep, parsePanelName } from '../helpers/utils.js';
import { createLogger } from '../helpers/logger.js';

const logger = createLogger({ prefix: 'addBoardInSequence', initialLevel: 'DEBUG' });

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


async function cloneAndPositionArtboard(filters, artboard, direction) {
    try {
        const clonedBoards = [];
        route.sequenceState.artboards = route.sequenceState.artboards.length > 0 ? await renamePreviousBoards(route) : route.sequenceState.artboards;
        ///NEW CLONE WILL ALWAYS BE STEP 1 IN THE SEQUENCE;
        const clonedBoardName = route.destinationName;
        const newBoard = await sourceBoard.duplicate(artboard, ElementPlacement.PLACEBEFORE, clonedBoardName);
        let xOffsetPct = { _unit: "pixelsUnit", _value: route.step > 0 ? route.device === 'desktop' ? -2020 : -960 : route.device === 'desktop' ? -4200 : -2060 };
        let yOffsetPct = { _unit: "pixelsUnit", _value: route.step === 0 ? route.device === 'desktop' ? 817 : 617 : route.device === 'desktop' ? -817 : -617 };
        logger.debug(`(Modal Action) Translating ${route.device} board on ${route.step} To: ${xOffsetPct._value} ${yOffsetPct._value}`);
        newBoard.translate(xOffsetPct, yOffsetPct);
        clonedBoards.push(newBoard);
        const newArtboard = {
            name: clonedBoardName,
            id: newBoard.id,
            step: 0,
            board: newBoard
        };
        ///push into array
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

/**
 * Adds a new artboard in sequence, either before (previous) or after (next) the current sequence
 * @param {string|RegExp} filter - Filter to find matching artboards
 * @param {Object} artboard - The selected artboard to base the sequence on
 * @param {string} direction - Either "next" or "previous" to determine where to add the board
 * @returns {Promise<Object>} - Result object with success status and message
 */
async function addBoardInSequence(filter, direction) {
    const artboard = app.activeDocument.activeLayers[0]
    console.log('add board in sequence', direction);
    try {
        const result = await core.executeAsModal(async (executionContext) => {
            const hostControl = executionContext.hostControl;
            const activeDoc = app.activeDocument;

            // Parse the currently selected board name to determine sequence type, step number, and device
            const { before, number, after, device: deviceWithColon } = parsePanelName(artboard.name);

            // Extract device type (desktop/mobile) and sequence type (intro/expanded/collapsed)    
            const sourceBoard = artboard;
            const deviceType = deviceWithColon.substring(1); // Remove the colon
            const device = deviceType === 'dt' ? 'desktop' : 'mobile';
            const deviceAbbr = deviceType; // dt or mb

            console.log("(Modal Action) Board info: Type=${sequenceType}, Step=${number}, State=${state}, Device=${device}");
            console.log("(Modal Action) Board info: ", sourceBoard.name, deviceType, device, deviceAbbr, before, after);

            // Determine sequence type
            const sequenceType = before; // intro, expanded, collapsed etc.
            const state = after.replace('-panel', ''); // Remove "-panel" if present

            logger.debug(`(Modal Action) Board info: Type=${sequenceType}, Step=${number}, State=${state}, Device=${device}`);



            // Find all artboards in the document that match this sequence
            const artboards = app.activeDocument.layers.filter(layer => {
                try {
                    // Check if it's a valid artboard with the same sequence pattern
                    const match = layer.kind === constants.LayerKind.ARTBOARD &&
                        layer.name.startsWith(before) &&
                        layer.name.includes(after) &&
                        layer.name.endsWith(deviceWithColon);
                    return match;
                } catch (error) {
                    return false;
                }
            }).sort((a, b) => {
                // Sort by step number
                try {
                    const aMatch = parsePanelName(a.name);
                    const bMatch = parsePanelName(b.name);
                    return aMatch.number - bMatch.number;
                } catch (error) {
                    return 0;
                }
            });

            if (artboards.length === 0) {
                await core.showAlert("No matching artboards found in the sequence.");
                return { success: false, message: "No matching artboards found in the sequence.", count: 0 };
            }

            await toggleHistory(hostControl, "suspend", activeDoc.id, `Add Board ${direction === 'previous' ? 'Before' : 'After'} Sequence`);

            try {
                let sourceBoard, newBoardName, newStepNumber;
                let artboardsToRename = [];
                let successfulPropagations = 0;

                if (direction === 'previous') {
                    // Clone the first artboard in the sequence
                    sourceBoard = artboards[0];
                    newStepNumber = 1;

                    // Need to rename all existing boards to increment their step numbers
                    artboardsToRename = [...artboards]; // Create a copy to avoid modifying while iterating
                } else { // 'next'
                    // Clone the last artboard in the sequence
                    sourceBoard = artboards[artboards.length - 1];
                    newStepNumber = artboards.length + 1;

                    // No need to rename existing boards
                    artboardsToRename = [];
                }

                // Create the name for the new board
                newBoardName = `${before}-${newStepNumber}-${after}${deviceWithColon}`;
                logger.debug(`Creating new board: ${newBoardName} based on ${sourceBoard.name}`);

                // Clone the source board
                const newBoard = await sourceBoard.duplicate(sourceBoard.parent, ElementPlacement.PLACEBEFORE, newBoardName);
                successfulPropagations++;

                // Position the new board
                const sourceFrame = await getArtboardFrame(sourceBoard);

                if (direction === 'previous') {
                    // Position before first board in sequence
                    // First, rename all existing boards to increment their step
                    for (const existingBoard of artboardsToRename) {
                        try {
                            const { before: eBefore, number: eNumber, after: eAfter, device: eDevice } = parsePanelName(existingBoard.name);
                            const newName = `${eBefore}-${eNumber + 1}-${eAfter}${eDevice}`;
                            logger.debug(`Renaming board: ${existingBoard.name} to ${newName}`);
                            existingBoard.name = newName;
                        } catch (error) {
                            logger.error(`Error renaming board ${existingBoard.name}: ${error.message}`);
                        }
                    }

                    // Move the new board into position where the first board was
                    const offsetX = sourceFrame.left - (await getArtboardFrame(newBoard)).left;
                    const offsetY = sourceFrame.top - (await getArtboardFrame(newBoard)).top;
                    await moveBoardAndGuide(newBoard, offsetX, offsetY);

                    // Now move all other boards down to make space
                    const boardHeight = sourceFrame.bottom - sourceFrame.top;
                    const spacing = 50; // Space between boards

                    for (let i = 0; i < artboardsToRename.length; i++) {
                        // Move each board down by the height of one board + spacing
                        await moveBoardAndGuide(artboardsToRename[i], 0, boardHeight + spacing);
                    }

                } else { // 'next'
                    // Position after last board in sequence
                    const lastBoard = artboards[artboards.length - 1];
                    const lastFrame = await getArtboardFrame(lastBoard);

                    // Calculate the position where the new board should be placed
                    const boardHeight = lastFrame.bottom - lastFrame.top;
                    const spacing = 50; // Space between boards

                    const offsetX = lastFrame.left - (await getArtboardFrame(newBoard)).left;
                    const offsetY = lastFrame.bottom - (await getArtboardFrame(newBoard)).top + spacing;
                    await moveBoardAndGuide(newBoard, offsetX, offsetY);
                }

                // Center the view on the new board
                await centerInViewport([newBoard]);

                await toggleHistory(hostControl, "resume", activeDoc.id);
                const message = `Successfully added a new ${sequenceType} board ${direction === 'previous' ? 'before' : 'after'} the sequence.`;
                return { success: true, message: message, count: successfulPropagations };

            } catch (error) {
                logger.error(`Error in addBoardInSequence: ${error.message}`);
                await toggleHistory(hostControl, "resume", activeDoc.id);
                return { success: false, message: `Error: ${error.message || error}`, count: 0 };
            }
        }, { "commandName": `Add Board in Sequence (${direction})` });

        // Process result from modal
        if (result.success) {
            logger.debug(result);
            return result;
        } else {
            // Use the message from the modal if available, otherwise default
            const message = result.message || "An unexpected issue occurred during operation.";
            await core.showAlert(message);
            return result;
        }
    } catch (error) {
        logger.error("Error in addBoardInSequence:", error);
        await core.showAlert(`An unexpected error occurred: ${error.message || error}`);
        return { success: false, message: `Error: ${error.message || error}`, count: 0 };
    }
}

// Export the function as a named export for ES modules
export { addBoardInSequence };

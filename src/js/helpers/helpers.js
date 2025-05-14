import { createLogger } from './logger.js';

const { app, core, action, constants: Constants } = require('photoshop');
const { LayerKind, ElementPlacement } = Constants;
const { batchPlay } = action;
const fs = require('uxp').storage.localFileSystem; // Import filesystem
const logger = createLogger({ prefix: 'Builder', initialLevel: 'DEBUG' });

const debug = false;

function log(message) {
    if (debug) {
        console.log(message);
    }
}

/**
 * Gets the parent container based on the first selected layer - warning: this will not work if selected layers span multiple groups or if they are not in a top-level group.
 */
function getLayerContainer(selection) {
    const parentContainer = selection[0]?.parent;
    logger.debug(`(getLayerContainer) First layer parent: ${parentContainer.name}`);
    if (parentContainer === null) {
        return { success: false, message: "Selected layers are not inside a container.", count: 0 };
    } else {
        const allSameParent = selection.length <= 1 ? true : selection.every(item => item.parent.id === parentContainer.id);
        logger.debug(`(getLayerContainer) All same parent: ${allSameParent}`);
        if (!allSameParent) {
            return { success: false, message: "Selection spans multiple containers.", count: 0 };
        }
        return parentContainer;
    }
}

/**
 * Recursively finds all groups in the given layer set that are not the source container and whose names contain any of the given name filters.
 */
function findValidGroups(potentialGroups, sourceContainer, nameFilters = []) {

    return potentialGroups.reduce((acc, group) => {
        if (group.kind !== LayerKind.GROUP) return acc;

        const isNotSource = sourceContainer === null || group.id !== sourceContainer.id;
        let matchesFilter = false;
        if (Array.isArray(nameFilters)) {
            console.log("(findAllGroups) Testing array:", nameFilters, 'against', group.name);
            ////legacy search using array of strings.
            ////this will eventually need AND/OR logic to handle multiple filters
            matchesFilter = (
                nameFilters.length === 0 ||
                nameFilters.some((filter) => {
                    //console.log(`(findAllGroups) Comparing: ${group.name} against ${filter}`);
                    return group.name?.includes(filter) || group.name === filter;
                })
            );
            //log(`(findAllGroups) Group: ${group.name}, isNotSource: ${isNotSource}, matchesFilter: ${matchesFilter}`);
        } else {
            ////Updated version testing a regex expression. Will eventually transition everything to this but i don't want
            ////to break a bunch of shit in the meantime. 
            console.log("(findAllGroups) Testing regex:", nameFilters, 'against', group.name);
            matchesFilter = nameFilters.test(group.name);
        }

        if (isNotSource && matchesFilter) {
            acc.push(group);
        }

        if (group.layers && isNotSource) {
            const nestedGroups = findValidGroups(group.layers, sourceContainer, nameFilters);
            acc.push(...nestedGroups);
        }
        // log(`(findAllGroups) Found ${acc.length} valid groups.`);
        return acc;
    }, []);
}

/**
 * Suspends or resumes history based on the given state.
 */
async function toggleHistory(hostControl, state, documentID, actionName) {
    if (state === "suspend") {
        await hostControl.suspendHistory({ "documentID": documentID, "name": actionName });
        logger.log("(Modal Action) History suspended.");
    } else if (state === "resume") {
        await hostControl.resumeHistory({ "documentID": documentID });
        logger.log("(Modal Action) History resumed.");
    }
}

/**
 * Checks if a given target container already contains any of the source layer names.
 * If so, increments the skipped targets counter.
 */
function checkForExistingLayers(targetContainer, sourceLayerNames, skippedTargets) {
    const targetLayerNames = targetContainer.layers ? targetContainer.layers.map(l => l.name) : []; // Handle case where target might somehow have no layers array
    logger.debug(`(Modal Action) Target "${targetContainer.name}" existing layers: [${targetLayerNames.join(', ')}]`);
    const hasExistingLayer = !sourceLayerNames.some(sourceName => targetLayerNames.includes(sourceName));
    !hasExistingLayer && skippedTargets++;
    return [hasExistingLayer, skippedTargets];
}

/**
 * Gets the index of a layer in the source layer stack.
 */
function getLayerIndex(layer, sourceLayers) {
    let sourceIndex = sourceLayers.findIndex(item => item.id === layer.id);
    return sourceIndex;
}

/**
 * Duplicates a layer and moves it to the bottom of the target container layer stack.
 */
async function duplicateAndMoveToBottom(sourceLayer, targetContainer, successfulPropagations) {
    const duplicatedLayer = await sourceLayer.duplicate(targetContainer, ElementPlacement.PLACEINSIDE);
    //immediately move to the bottom of each stack
    const targetLayers = targetContainer.layers; // Get layers AFTER duplication                            
    const startLayerDepth = targetLayers.length - 1;
    await duplicatedLayer.move(targetLayers[startLayerDepth], ElementPlacement.PLACEAFTER);
    successfulPropagations++;
    duplicatedLayer.name = sourceLayer.name;
    return [duplicatedLayer, successfulPropagations];
}

/**
 * Gets the relative position of a layer to its container.
 */
function getRelativePosition(sourceLayer, sourceContainer) {
    const sourceLayerBounds = sourceLayer.bounds;
    const sourceContainerBounds = sourceContainer.bounds; // sourceContainer is defined earlier
    const relativeX = sourceLayerBounds.left - sourceContainerBounds.left;
    const relativeY = sourceLayerBounds.top - sourceContainerBounds.top;
    logger.debug(`(Modal Action) Source '${sourceLayer.name}' relative pos: (${relativeX}, ${relativeY})`);
    return { relativeX, relativeY };
}

/**
 * Matches the relative position of a duplicated layer to its source container.
 */
async function matchRelativePosition(duplicatedLayer, relativePositions, targetContainer) {
    const targetContainerBounds = targetContainer.bounds;
    const duplicatedLayerBounds = duplicatedLayer.bounds; // Get bounds *after* duplication

    const desiredAbsoluteX = targetContainerBounds.left + relativePositions.relativeX;
    const desiredAbsoluteY = targetContainerBounds.top + relativePositions.relativeY;

    const deltaX = desiredAbsoluteX - duplicatedLayerBounds.left;
    const deltaY = desiredAbsoluteY - duplicatedLayerBounds.top;

    if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) { // Only translate if needed (avoid tiny adjustments)
        logger.debug(`(Modal Action) Translating duplicated layer by (${deltaX}, ${deltaY})`);
        await duplicatedLayer.translate(deltaX, deltaY);
    } else {
        logger.debug(`(Modal Action) Duplicated layer already at correct relative position.`);
    }
    return duplicatedLayer;
}

/**
 * Places a layer at the correct depth in the target container based on the source layer distance from the bottom of the stack. (this is a bit wonky and needs improvement)
 * @param {Layer} layer The layer to place.
 * @param {LayerSet} targetContainer The target artboard or group to place the layer in.
 * @param {number} distanceFromBottom The source layer's distance from the bottom of the layer stack.    
 * @returns {Promise<void>}
 */
async function placeAtCorrectDepth(layer, targetContainer, distanceFromBottom) {
    const targetLayers = targetContainer.layers; // Get layers AFTER duplication
    const targetPlacementFromBottom = Math.max(0, targetLayers.length - distanceFromBottom - 1);
    // Ensure target index is realistically attainable within the target container's current layers
    //if current layer the duplicate is on is deeper than the source, and the source layer is higher than the current max layer depth for the target container, move it up
    if (targetPlacementFromBottom === 0) {
        ///if the source index is 0, just put this element at the top of the layer stack.
        log(`(Modal Action) Moving duplicated layer to top (index 0)`);
        await layer.move(targetLayers[0], ElementPlacement.PLACEBEFORE);
    } else {
        //otherwise find the element currently one layer above the source, and place duplicate copy at that depth
        const referenceLayerIndex = targetPlacementFromBottom - 1;
        if (referenceLayerIndex >= 0) {
            const referenceLayer = targetLayers[referenceLayerIndex];
            // Important check: Don't try to move relative to self!
            if (referenceLayer && referenceLayer.id !== layer.id) {
                log(`(Modal Action) Moving duplicated layer BELOW '${referenceLayer.name}' (aiming for index ${targetPlacementFromBottom})`);
                await layer.move(referenceLayer, ElementPlacement.PLACEAFTER);
            } else {
                log(`(Modal Action) Reference layer at ${referenceLayerIndex} is self or invalid. Skipping reorder for safety.`);
                // Fallback: could attempt move to end, but might mess up order further.
            }
        } else {
            log(`(Modal Action) Reference layer is not at a targetable depth so i just put it at the start`);
            await layer.move(targetLayers[0], ElementPlacement.PLACEBEFORE);
        }
    }
}

/**
 * Shows a modal dialog with a title, label, text input, and OK/Cancel buttons.
 * @param {string} label Text for the input field label.
 * @param {string} title Text for the dialog title.
 * @param {string} [defaultValue=''] Optional default value for the input field.
 * @param {string} [okText='OK'] Optional text for the OK button.
 * @param {string} [cancelText='Cancel'] Optional text for the Cancel button.
 * @returns {Promise<{dismissed: boolean, value: string | null}>} Promise resolving with the input value or null if dismissed.
 */
async function showInputDialog(label, title, defaultValue = '', okText = 'OK', cancelText = 'Cancel') {
    return new Promise(async (resolve) => { // Make the promise callback async
        try {
            // --- Get path to HTML file --- 
            const pluginFolder = await fs.getPluginFolder();
            const htmlFile = await pluginFolder.getEntry('html/inputDialog.html');
            if (!htmlFile) {
                logger.debug("Dialog HTML file not found: html/inputDialog.html");
                resolve({ dismissed: true, value: null });
                return;
            }

            // --- Read HTML content ---
            const htmlContent = await htmlFile.read();

            // --- Create dialog from HTML string ---
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = htmlContent;
            const dialog = tempContainer.querySelector('#inputDialogContainer'); // Get the <dialog> element

            if (!dialog) {
                log("Could not find #inputDialogContainer in HTML content.");
                resolve({ dismissed: true, value: null });
                return;
            }

            // --- Find elements and set content/values ---
            const titleElement = dialog.querySelector('#dialogTitle');
            const labelElement = dialog.querySelector('#dialogLabel');
            const inputField = dialog.querySelector('#dialogInput');
            const okButton = dialog.querySelector('#dialogOkBtn');
            const cancelButton = dialog.querySelector('#dialogCancelBtn');

            if (!titleElement || !labelElement || !inputField || !okButton || !cancelButton) {
                log("One or more required dialog elements not found by ID in HTML.");
                resolve({ dismissed: true, value: null });
                return;
            }

            titleElement.textContent = title;
            labelElement.textContent = label;
            inputField.value = defaultValue;
            okButton.textContent = okText;
            cancelButton.textContent = cancelText;

            // --- Attach event listeners --- 
            cancelButton.onclick = () => {
                resolve({ dismissed: true, value: null });
                dialog.close();
            };

            okButton.onclick = () => {
                resolve({ dismissed: false, value: inputField.value });
                dialog.close();
            };

            inputField.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    okButton.click();
                }
            });

            // Select text on focus
            inputField.addEventListener('focus', () => inputField.select());

            // --- Append to body and show ---
            document.body.querySelector('sp-theme').appendChild(dialog);

            dialog.addEventListener('close', () => {
                dialog.remove(); // Cleanup from DOM
            });

            const r = await dialog.uxpShowModal({
                title: "Bulk Transformation",
                resize: "none", // "both", "horizontal", "vertical"
            });
            //dialog.showModal();
            setTimeout(() => inputField.focus(), 50); // Delay focus slightly

        } catch (err) {
            log("Error showing input dialog:", err);
            resolve({ dismissed: true, value: null }); // Resolve as dismissed on error
        }
    });
}

function convertToSmartObject(layer) {
    if (layer.kind === LayerKind.NORMAL || layer.kind === LayerKind.TEXT) {
        const commands = [];
        const layerRef = { _ref: "layer", _id: layer.id };
        commands.push(
            {
                _obj: "selectNoLayers",
                _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }]
            },
            {
                _obj: "select",
                _target: [layerRef],
                makeVisible: false
            },
            {
                _obj: "newPlacedLayer",
                _target: [layerRef],
                _options: { dialogOptions: "dontDisplay" }
            }
        );
        log(`(convertToSmartObject) Prepared Conversion Command for ${layer.name}:`, commands);
        return commands;
    } else {
        return [];
    }
}


function rasterizeLayer(layer, rasterizeText = true, rasterizeLayerStyles = false) {
    const layerRef = { _ref: "layer", _id: layer.id };


    const commands = [
        {
            _obj: "selectNoLayers",
            _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }]
        },
        {
            _obj: "select",
            _target: [layerRef],
            makeVisible: false
        }
    ];
    if (rasterizeText) {
        commands.push({
            _obj: "rasterizeLayer",
            _target: [layerRef],
        });
    }
    if (rasterizeLayerStyles) {
        commands.push({
            _obj: "rasterizeLayer",
            _target: [layerRef],
            what: {
                _enum: "rasterizeItem",
                _value: "layerStyle"
            }
        });
    }

    console.log(`(rasterizeLayer) Prepared Rasterization Command for ${layer.name}:`, commands);
    return commands;
    //const rasterizeResult = await batchPlay(rasterizeCommands, {});
    //return rasterizeResult;
}

async function duplicateBoardToBoard(sourceBoard, targetBoards) {
    const layerDuplicates = [];
    const sourceLayers = sourceBoard.layers;
    if (targetBoards.length === 0) {
        console.error("(duplicateBoardToBoard) No target boards found.");
        return layerDuplicates;
    } else {
        for (const targetBoard of targetBoards) {
            try {
                ///propagate smart objects to velocity state boards
                const placeCommands = [];
                for (const layer of sourceLayers) {
                    const [duplicatedLayer, successIncrement] = await duplicateAndMoveToBottom(layer, targetBoard, 0);
                    layerDuplicates.push(duplicatedLayer);
                    // console.log(`(duplicateBoardToBoard) Duplicated '${layer.name}' to '${targetBoard.name}'`);
                }
                // console.log(`(duplicateBoardToBoard) Completed propagation of ${sourceLayers.length} layers to ${targetBoard.name}.`);
            } catch (propagateError) {
                console.error(`(duplicateBoardToBoard) Error propagating layers to '${targetBoard.name}': ${propagateError.message}`);
                // Potentially non-critical, continue loop
            }
        }
        log(`(duplicateBoardToBoard) Completed propagation of ${sourceBoard.name} to ${targetBoards.length} target boards. ${layerDuplicates.length} layers duplicated.`);
        return layerDuplicates;
    }
}

async function convertAllLayersToSmartObjects(artboard, rasterizeText, rasterizeLayerStyles) {
    // console.log("(convertAllLayersToSmartObjects) Converting layers to smart objects:", artboard.layers);
    const commands = [];
    //loop through all layers in the artboard and prepare the batch command to execute
    for (const layer of artboard.layers) {
        if (layer.kind === LayerKind.NORMAL || layer.kind === LayerKind.TEXT) {
            //if it's a text layer, and rasterizeText is true, add commands to rasterize it first
            try {
                if (rasterizeLayerStyles || rasterizeText) commands.push(...rasterizeLayer(layer, rasterizeText, rasterizeLayerStyles));
            } catch (error) {
                log("(convertAllLayersToSmartObjects) Error rasterizing layer:", layer.name, error);
            }
            //then add commands to convert to a smart object
            try {
                commands.push(...convertToSmartObject(layer));
            } catch (error) {
                log("(convertAllLayersToSmartObjects) Error converting layer to smart object:", layer.name, error);
            }
        }
    }
    //finally, execute the commands
    const results = await batchPlay(commands, {});
    log(`(convertAllLayersToSmartObjects) Completed conversion of layers inside ${artboard.name} to smart objects.`);
    return results;
}

async function getArtboardFrame(artboardLayer) {
    const [{ artboard: { artboardRect } }] = await batchPlay(
        [{
            _obj: "get",
            _target: [
                { _ref: "property", _property: "artboard" },
                { _ref: "layer", _id: artboardLayer.id }
            ]
        }],
        { synchronousExecution: true }
    );
    return artboardRect;  // { left, top, right, bottom }
}

async function getGuidesForFrame(frame) {
    return app.activeDocument.guides.filter(guide => {
        // ensure numeric
        const pos = Math.round(parseFloat(guide.coordinate));
        if (guide.direction === Constants.Direction.VERTICAL) {
            return pos >= frame.left && pos <= frame.right;
        }
        // HORIZONTAL
        return pos >= frame.top && pos <= frame.bottom;
    });
}

async function moveBoardAndGuide(artboard, x, y, specificGuides = null) {
    try {
        console.log("(moveBoardAndGuide) Using External Guide Target:", specificGuides);
        const frame = await getArtboardFrame(artboard);
        const guides = specificGuides === null ? await getGuidesForFrame(frame) : specificGuides;
        console.log("(moveBoardAndGuide) Guides: ", guides);
        await artboard.translate(x, y);
        console.log("(moveBoardAndGuide) Moving board and guides:", artboard.name, x, y, 'using guides:', guides);
        for (const g of guides) {
            // parse + round to avoid fractional drift
            const current = parseFloat(g.coordinate);
            g.coordinate = parseFloat(current) + (g.direction === Constants.Direction.VERTICAL ? specificGuides === null ? x : 0 : y);
            g.coordinate = parseFloat(g.coordinate);
        }
        return artboard;
    } catch (error) {
        console.error("(moveBoardAndGuide) Error moving board and guides:", error);
        return artboard;
    }
}

async function cloneGuidesForFrame(frame) {
    const guides = await getGuidesForFrame(frame);
    const clonedGuides = guides.map(guide => {
        const newGuide = guide.duplicate();
        newGuide.coordinate = parseFloat(guide.coordinate);
        return newGuide;
    });
    return clonedGuides;
}

export {
    getLayerContainer,
    findValidGroups,
    toggleHistory,
    checkForExistingLayers,
    getLayerIndex,
    duplicateAndMoveToBottom,
    getRelativePosition,
    matchRelativePosition,
    placeAtCorrectDepth,
    showInputDialog,
    convertToSmartObject,
    rasterizeLayer,
    duplicateBoardToBoard,
    convertAllLayersToSmartObjects,
    getArtboardFrame,
    getGuidesForFrame,
    moveBoardAndGuide,
    cloneGuidesForFrame
};

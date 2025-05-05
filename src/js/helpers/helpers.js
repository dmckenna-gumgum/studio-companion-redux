const { LayerKind, ElementPlacement } = require("photoshop").constants;

/**
 * Gets the parent container based on the first selected layer - warning: this will not work if selected layers span multiple groups or if they are not in a top-level group.
 */
function getLayerContainer(selection) {
    const parentContainer = selection[0]?.parent;
    console.log(`(getLayerContainer) First layer parent: ${parentContainer.name}`);
    if (parentContainer === null) {
        return { success: false, message: "Selected layers are not inside a container.", count: 0 };
    } else {
        const allSameParent = selection.length <= 1 ? true : selection.every(item => item.parent.id === parentContainer.id);   
        console.log(`(getLayerContainer) All same parent: ${allSameParent}`); 
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
        ////this will eventually need AND/OR logic to handle multiple filters
        const matchesFilter = (
            nameFilters.length === 0 ||
            nameFilters.some((filter) => {
                console.log(`(findAllGroups) Comparing: ${group.name} against ${filter}`);
                return group.name?.includes(filter) || group.name === filter;
            })
        );
        console.log(`(findAllGroups) Group: ${group.name}, isNotSource: ${isNotSource}, matchesFilter: ${matchesFilter}`);

        if (isNotSource && matchesFilter) {
            acc.push(group);
        }

        if (group.layers && isNotSource) {
            const nestedGroups = findValidGroups(group.layers, sourceContainer, nameFilters);
            acc.push(...nestedGroups);
        }

        return acc;
    }, []);
}

/**
 * Suspends or resumes history based on the given state.
 */
async function toggleHistory(hostControl, state, documentID, actionName) {
    if (state === "suspend") {
        await hostControl.suspendHistory({ "documentID": documentID, "name": actionName });
        console.log("(Modal Action) History suspended.");
    } else if (state === "resume") {
        await hostControl.resumeHistory({ "documentID": documentID });
        console.log("(Modal Action) History resumed.");
    }
}

/**
 * Checks if a given target container already contains any of the source layer names.
 * If so, increments the skipped targets counter.
 */
function checkForExistingLayers(targetContainer, sourceLayerNames, skippedTargets) {
    const targetLayerNames = targetContainer.layers ? targetContainer.layers.map(l => l.name) : []; // Handle case where target might somehow have no layers array
    console.log(`(Modal Action) Target "${targetContainer.name}" existing layers: [${targetLayerNames.join(', ')}]`);
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
    console.log(`(Modal Action) Source '${sourceLayer.name}' relative pos: (${relativeX}, ${relativeY})`);
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
        console.log(`(Modal Action) Translating duplicated layer by (${deltaX}, ${deltaY})`);
        await duplicatedLayer.translate(deltaX, deltaY);
    } else {
        console.log(`(Modal Action) Duplicated layer already at correct relative position.`);
    }
    return duplicatedLayer;
}

/**
 * Places a layer at the correct depth in the target container based on the source layer distance from the bottom of the stack. (this is a bit wonky and needs improvement)
 */
async function placeAtCorrectDepth(layer, targetContainer, distanceFromBottom) {    
    const targetLayers = targetContainer.layers; // Get layers AFTER duplication
    const targetPlacementFromBottom = Math.max(0, targetLayers.length - distanceFromBottom - 1);
    // Ensure target index is realistically attainable within the target container's current layers
    //if current layer the duplicate is on is deeper than the source, and the source layer is higher than the current max layer depth for the target container, move it up
    if(targetPlacementFromBottom === 0) {
        ///if the source index is 0, just put this element at the top of the layer stack.
        console.log(`(Modal Action) Moving duplicated layer to top (index 0)`);
        await layer.move(targetLayers[0], ElementPlacement.PLACEBEFORE);
    } else {
        //otherwise find the element currently one layer above the source, and place duplicate copy at that depth
        const referenceLayerIndex = targetPlacementFromBottom - 1; 
        if(referenceLayerIndex >= 0) {
            const referenceLayer = targetLayers[referenceLayerIndex];
            // Important check: Don't try to move relative to self!
            if (referenceLayer && referenceLayer.id !== layer.id) {    
                console.log(`(Modal Action) Moving duplicated layer BELOW '${referenceLayer.name}' (aiming for index ${targetPlacementFromBottom})`);
                await layer.move(referenceLayer, ElementPlacement.PLACEAFTER); 
            } else {
                console.log(`(Modal Action) Reference layer at ${referenceLayerIndex} is self or invalid. Skipping reorder for safety.`);
                // Fallback: could attempt move to end, but might mess up order further.
            }
        } else {
            console.log(`(Modal Action) Reference layer is not at a targetable depth so i just put it at the start`);
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
    return new Promise((resolve) => {
        // Create dialog elements dynamically
        const dialog = document.createElement('dialog');
        const spDialog = document.createElement('sp-dialog');
        spDialog.setAttribute('size', 's'); // Small size dialog
        spDialog.classList.add('dialog-confirm'); // Optional class for styling

        const heading = document.createElement('sp-heading');
        heading.slot = 'heading';
        heading.textContent = title;

        const divider = document.createElement('sp-divider');
        divider.slot = 'heading';
        divider.setAttribute('size', 's');

        const content = document.createElement('div');
        content.slot = 'content';

        const fieldLabel = document.createElement('sp-field-label');
        fieldLabel.setAttribute('for', 'inputField');
        fieldLabel.textContent = label;

        const inputField = document.createElement('sp-textfield');
        inputField.id = 'inputField';
        inputField.value = defaultValue;
        // Automatically select the text field content for easy replacement
        inputField.addEventListener('focus', () => inputField.select()); 

        content.appendChild(fieldLabel);
        content.appendChild(inputField);

        const buttonGroup = document.createElement('sp-button-group');
        buttonGroup.slot = 'button';
        buttonGroup.setAttribute('align', 'end');

        const cancelButton = document.createElement('sp-button');
        cancelButton.variant = 'secondary';
        cancelButton.treatment = 'outline';
        cancelButton.textContent = cancelText;
        cancelButton.onclick = () => {
            resolve({ dismissed: true, value: null });
            dialog.close(); // Close the native dialog element
        };

        const okButton = document.createElement('sp-button');
        okButton.variant = 'cta';
        okButton.textContent = okText;
        okButton.onclick = () => {
            resolve({ dismissed: false, value: inputField.value });
            dialog.close();
        };
        
        // Allow submitting with Enter key
        inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                okButton.click();
            }
        });

        buttonGroup.appendChild(cancelButton);
        buttonGroup.appendChild(okButton);

        // Assemble the dialog
        spDialog.appendChild(heading);
        spDialog.appendChild(divider);
        spDialog.appendChild(content);
        spDialog.appendChild(buttonGroup);
        dialog.appendChild(spDialog);

        // Append to body and show
        document.body.appendChild(dialog);

        // Add cleanup for when the dialog is closed (either by button or Escape key)
        dialog.addEventListener('close', () => {
            dialog.remove(); // Remove from DOM after closing
        });
        
        // Show the modal. Focus the input field shortly after.
        dialog.showModal();
        setTimeout(() => inputField.focus(), 50); // Delay focus slightly
    });
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
    showInputDialog
};

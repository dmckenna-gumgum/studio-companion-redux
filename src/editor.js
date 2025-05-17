import { getEl, getEls, restoreFocus, proxyArraysEqual, capitalizeFirstLetter, parentGroupCount, setTagLabelCursor, buildScopeRegex, diffProxyArrays } from "./js/helpers/utils.js";
import { selectLayersByName } from "./js/actions/selectLayersByName.js";
import { selectLayersByName as selectLayersByNameAction } from "./store/actions/editorActions.js";
import { linkLayersByName } from "./js/actions/linkLayersByName.js";
import { unlinkLayersByName } from "./js/actions/unlinkLayersByName.js";
import { deleteLayersByName } from "./js/actions/deleteLayersByName.js";
import { propagateLayers } from "./js/actions/propagateLayers.js";
import { transformLayersIndividually } from "./js/actions/transformLayersIndividually.js";
import { deleteSelectedLayers } from "./js/actions/deleteSelectedLayers.js";
import { SelectListener } from "./js/services/SelectListener.js";
import { createLogger } from './js/helpers/logger.js';
import { linkSelectedLayers } from './js/actions/linkSelectedLayers.js';
import { matchStylesByName } from './js/actions/matchStylesByName.js';
import { addBoardInSequence } from './js/actions/addBoardInSequence.js';
import { findValidGroups } from './js/helpers/helpers.js';
import { collectAllLayers } from './js/helpers/helpers.js';

// Redux imports
import store from './store/index.js';
import {
    toggleAutoLink,
    setFilter,
    updateScopeFilter,
    linkLayers,
    unlinkLayers
} from './store/actions/editorActions.js';
import { showNotification } from './store/actions/uiActions.js';
import { getEditorState, getAutoLinkEnabled, getCurrentSelection, getFilterRegex, getScopeFilters } from './store/selectors/editorSelectors.js';
import { getPSTheme } from './js/helpers/themeSetter.js';

const { core, constants } = require("photoshop");
const { LayerKind } = constants;

// DOM Selectors
let ActionFeedback;
let _onUpdateCallback;

// Initialize logger
const logger = createLogger({ prefix: 'Editor', initialLevel: 'DEBUG' });

// Keep a reference to the SelectListener at module level
let selectListener = null;

// Subscribe to Redux store changes
store.subscribe(() => {
    // Get the current editor state from Redux
    const editorState = getEditorState(store.getState());

    // Update UI based on state changes
    updateEditorUI(editorState);

    // Pass state updates to parent component if callback is set
    if (_onUpdateCallback && typeof _onUpdateCallback === 'function') {
        _onUpdateCallback({
            type: 'editorStateUpdate',
            selection: editorState.currentSelection,
            autoLink: editorState.autoLink
        });
    }
});

/**
 * Handles legacy selection events (for backward compatibility)
 * @param {Object} data - Event data from SelectListener
 */
function handleEditorStateUpdate(data) {
    logger.debug('Editor state update from legacy callback', data);
    // This function is kept for backward compatibility with the callback pattern
    // The real state management is now handled via Redux directly
}

/**
 * Enable or disable editor functionality
 * @param {Boolean} enabled - Whether the editor should be enabled
 */
function enableEditorFunctionality(enabled) {
    logger.debug('Setting editor functionality:', enabled);

    // Set visibility of editor section
    const editorSection = getEl('#editorSection');
    if (editorSection) {
        editorSection.style.display = enabled ? 'block' : 'none';
    }

    // Enable/disable selection listener
    if (selectListener) {
        selectListener.setListening(enabled);
    }

    // Update button states
    updateButtonStates(enabled && getCurrentSelection(store.getState()).viable);
}

/**
 * Set up event listeners for UI elements
 */
function setupUIEventListeners() {
    // Auto-link toggle
    const autoLinkBtn = getEl('#btnAutoLink');
    if (autoLinkBtn) {
        autoLinkBtn.addEventListener('click', () => {
            const currentState = store.getState();
            const newEnabled = !getAutoLinkEnabled(currentState);
            store.dispatch(toggleAutoLink(newEnabled));

            // Update SelectListener
            if (selectListener) {
                selectListener.setAutoLink(newEnabled);
            }
        });
    }

    // Filter tag toggles
    const filterTags = getEls('.plugin-tag');
    if (filterTags && filterTags.length > 0) {
        setTagLabelCursor(filterTags);
        filterTags.forEach(tag => {
            tag.addEventListener('click', handleTagToggle);
        });
    }

    // Set up action buttons
    setupActionButtons();
}

function handleTagToggle(event) {
    // Toggle Clicked Tag
    const filter = event?.target?.dataset?.filter;
    const filterName = event?.target?.dataset?.name;
    const currentlyChecked = event?.target?.hasAttribute('selected');
    const newCheckState = !currentlyChecked;

    // Update the UI element
    newCheckState ? event.target.setAttribute('selected', '') : event.target.removeAttribute('selected');

    console.log('Toggle Tag:', filterName, 'Current:', currentlyChecked, 'New:', newCheckState);

    // Get current filters from Redux state
    const currentState = store.getState();
    const currentFilters = getScopeFilters(currentState);

    // Create new set of filters
    let newFilters = [...currentFilters];
    if (newCheckState && filterName) {
        newFilters.push({ name: filterName, pattern: filter })
    } else {
        newFilters = newFilters.filter(f => f.name !== filterName);
    }

    // Dispatch action to update filters in Redux
    store.dispatch(updateScopeFilter(newFilters));

    // Get updated regex from state for immediate use
    const updatedState = store.getState();
    const filters = getFilterRegex(updatedState);
}

/**
 * Set up action buttons with handlers
 */
function setupActionButtons() {
    // Link/Unlink buttons
    const linkBtn = getEl('#btnLink');
    if (linkBtn) {
        linkBtn.addEventListener('click', async () => {
            const state = store.getState();
            const selection = getCurrentSelection(state);

            if (selection.viable) {
                store.dispatch(linkLayers(selection.layers));
            }
        });
    }

    const unlinkBtn = getEl('#btnUnlink');
    if (unlinkBtn) {
        unlinkBtn.addEventListener('click', async () => {
            const state = store.getState();
            const selection = getCurrentSelection(state);

            if (selection.viable) {
                store.dispatch(unlinkLayers(selection.layers));
            }
        });
    }


    // Match styles button
    const matchStyleBtn = getEl('#btnMatchStyle');
    if (matchStyleBtn) {
        matchStyleBtn.addEventListener('click', async () => {
            const state = store.getState();
            const selection = getCurrentSelection(state);

            if (selection.viable) {
                try {
                    const result = await matchStylesByName(selection.layers);
                    logger.debug('Match styles result', result);
                } catch (error) {
                    logger.error('Error matching styles', error);
                }
            }
        });
    }

    // Clone buttons
    const cloneNextBtn = getEl('#btnCloneNext');
    if (cloneNextBtn) {
        cloneNextBtn.addEventListener('click', async () => {
            const state = store.getState();
            const selection = getCurrentSelection(state);

            if (selection.viable) {
                try {
                    const result = await addBoardInSequence({ selection }, ['next']);
                    logger.debug('Clone next result', result);
                } catch (error) {
                    logger.error('Error cloning next', error);
                }
            }
        });
    }

    const clonePrevBtn = getEl('#btnClonePrev');
    if (clonePrevBtn) {
        clonePrevBtn.addEventListener('click', async () => {
            const state = store.getState();
            const selection = getCurrentSelection(state);

            if (selection.viable) {
                try {
                    const result = await addBoardInSequence({ selection }, ['prev']);
                    logger.debug('Clone prev result', result);
                } catch (error) {
                    logger.error('Error cloning prev', error);
                }
            }
        });
    }
}

/**
 * Selects all layers with the same name as the currently selected layer(s)
 */
const selectAllLayers = async () => {
    // Get current state from Redux store
    const state = store.getState();
    const filterRegex = getFilterRegex(state);

    try {
        // Dispatch Redux action to select layers by name
        // This will be processed by photoshopMiddleware
        store.dispatch(selectLayersByNameAction({ filter: filterRegex }));

        // Return a success status since the middleware will handle the actual work
        return { success: true };
    } catch (error) {
        console.error('Error dispatching select layers action:', error);
        return { success: false, message: `Error: ${error.message || error}` };
    }
}

/**
 * Handle editor action button clicks
 * @param {Event} event - DOM event
 * @param {Object} behavior - Behavior configuration
 */
const handleEditorAction = async (event, behavior) => {
    console.debug('handleEditorAction', event, behavior);
    try {
        console.debug(`Starting awaited ${behavior.name} action...`);
        const currentState = store.getState();
        const filterRegex = getFilterRegex(currentState);
        const result = await behavior.action(filterRegex, ...behavior.options);
        console.debug(`DEBUG: Result from ${behavior.name} action:`, result);
        restoreFocus();

        // If the action returns layers, update selection
        if (result?.layers) {
            store.dispatch(selectLayers(result.layers));
        }

        if (!result.success && result.message) {
            // Show error message if needed
            console.error(result.message);
        }
    } catch (err) {
        console.error(`DEBUG: Error calling ${behavior.name} action:`, err);
        const errorMessage = err.message || err.toString() || "Unknown error.";
    }

    // Update UI with latest Redux state
    const newEditorState = getEditorState(store.getState());
    updateEditorUI(newEditorState);
}

/**
 * Update UI based on Redux state
 * @param {Object} editorState - Editor state from Redux
 */
function updateEditorUI(editorState) {
    logger.debug('Updating editor UI', editorState);

    // Update action bar based on selection
    toggleActionBar(editorState.currentSelection);

    // Update auto-link toggle button
    const autoLinkBtn = getEl('#btnAutoLink');
    if (autoLinkBtn) {
        editorState.autoLink?.enabled
            ? autoLinkBtn.setAttribute('selected', '')
            : autoLinkBtn.removeAttribute('selected');
    }

    // Update filter tags
    const filterTags = getEls('.plugin-tag');
    if (filterTags && filterTags.length > 0) {
        // Get active filters from state
        const activeFilters = editorState.scopeFilters || [];

        // Update tag UI based on active filters
        filterTags.forEach(tag => {
            const filterName = tag.dataset.name;
            const isActive = activeFilters.some(f => f.name === filterName);

            isActive
                ? tag.setAttribute('selected', '')
                : tag.removeAttribute('selected');
        });
    }

    // Update button states based on selection
    updateButtonStates(editorState.currentSelection?.viable || false);
}

/**
 * Toggle action bar visibility and update feedback based on selection
 * @param {Object} selection - Current selection data from Redux state
 */
function toggleActionBar(selection) {
    try {
        // Get action bar and feedback elements
        const actionBar = getEl('#action-bar');
        const feedbackElement = getEl('#action-feedback');

        if (!actionBar || !feedbackElement) {
            logger.error('Action bar elements not found');
            return false;
        }

        // Determine visibility based on selection
        const hasLayers = selection && selection.layers && selection.layers.length > 0;

        // Handle visibility
        if (!hasLayers) {
            actionBar.style.display = 'none';
            feedbackElement.textContent = 'No layers selected';
            return false;
        }

        // Show action bar when layers are selected
        actionBar.style.display = 'flex';

        // Set appropriate classes based on selection type
        const hasSingleGroup = selection.parentGroupCount === 1;

        // Clear previous classes
        actionBar.classList.remove('selection-many-groups', 'selection-same-groups', 'mixed-selection', 'group-selection');

        // Update group classification
        if (hasSingleGroup) {
            actionBar.classList.add('selection-same-groups');
        } else {
            actionBar.classList.add('selection-many-groups');
        }

        // Generate feedback message based on selection type
        let feedbackMessage = '';

        if (selection.type === 'group') {
            feedbackMessage = `${selection.layers.length} Artboard${selection.layers.length === 1 ? '' : 's'} selected`;
            actionBar.classList.add('group-selection');
        } else if (selection.type === 'layer') {
            const groupCount = hasSingleGroup ? 1 : (selection.parentGroupCount || 1);
            const groupText = groupCount === 1 ? 'in same artboard' : `across ${groupCount} artboards`;
            feedbackMessage = `${selection.layers.length} Layer${selection.layers.length === 1 ? '' : 's'} selected ${groupText}`;
        } else if (selection.type === 'mixed') {
            feedbackMessage = `Mixed selection of artboards and layers - some actions may be limited`;
            actionBar.classList.add('mixed-selection');
        }

        // Add auto-link status if enabled
        const state = store.getState();
        if (state.editor?.autoLink?.enabled) {
            feedbackMessage += ' (auto-link enabled)';
        }

        // Update feedback message
        feedbackElement.textContent = feedbackMessage;

        return true;
    } catch (error) {
        logger.error('Error updating action bar', error);
        return false;
    }
}

/**
 * Update selection UI components
 * @param {Object} selection - Current selection state
 */
function updateSelectionUI(selection) {
    const feedbackElement = getEl('#feedback');
    if (feedbackElement) {
        if (selection.layers.length > 0) {
            feedbackElement.textContent = `${selection.layers.length} layer(s) selected`;
            feedbackElement.classList.toggle('warning', !selection.viable);
        } else {
            feedbackElement.textContent = 'No layers selected';
            feedbackElement.classList.remove('warning');
        }
    }
}

/**
 * Update action buttons based on selection viability
 * @param {Boolean} isViable - Whether current selection is viable for actions
 */
function updateButtonStates(isViable) {
    const actionButtons = getEls('.plugin-action-button');
    if (actionButtons && actionButtons.length > 0) {
        actionButtons.forEach(button => {
            button.disabled = !isViable;
        });
    }
}

/**
}

/**
 * Handle filter tag click event
 * @param {Event} event - DOM event
 */
const handleFilterTagClick = (event) => {
    // Get filter data from clicked tag
    const filter = event.target.dataset.filter;
    const filterName = event.target.dataset.name;
    const currentlyChecked = event.target.hasAttribute('selected');
    const newCheckState = !currentlyChecked;

    // Update UI state
    if (newCheckState) {
        event.target.setAttribute('selected', '');
    } else {
        event.target.removeAttribute('selected');
    }

    // Get current filters and update them
    const currentState = store.getState();
    const currentFilters = getScopeFilters(currentState);
    let newFilters = [...currentFilters];

    if (newCheckState && filterName) {
        newFilters.push({ name: filterName, pattern: filter });
    } else {
        newFilters = newFilters.filter(f => f.name !== filterName);
    }

    // Dispatch action to update filters
    store.dispatch(updateScopeFilter(newFilters));
}

/**
 * Handle auto-link button click
 * @param {Event} event - DOM event
 * @returns {Promise<Object>} - Success status
 */
const handleAutoLinkClick = async (event) => {
    const checked = !event.target.hasAttribute('selected');
    
    // Dispatch Redux action to toggle auto-link state
    store.dispatch(toggleAutoLink(checked));
    
    // Update select listener directly if it exists
    if (selectListener && typeof selectListener.setAutoLink === 'function') {
        console.log('Updating SelectListener auto-link state directly:', checked);
        await selectListener.setAutoLink(checked);
    } else {
        console.warn('SelectListener not initialized or missing setAutoLink method');
    }
    
    return { success: true };
}

/**
 * Initialize the editor functionality
 * @param {Function} onUpdate - Callback for state updates
 * @param {Object} document - The active document
 * @param {String} initialMode - Initial app mode
 * @returns {Object} - Editor API
 */
function init(onUpdate, document, initialMode = 'builder') {
    logger.debug('Initializing editor', { initialMode });
    _onUpdateCallback = onUpdate;

    // Set up UI components
    setupUIEventListeners();
    setupActionButtons();

    // Get reference to action bar feedback element
    ActionFeedback = getEl('#feedback');

    // Set initial state
    const enabled = initialMode === 'editor';
    const initialAutoLink = false;
    const initialFilters = getFilterRegex(store.getState());

    try {
        // Initialize SelectListener directly - it now works with Redux via store.dispatch
        selectListener = SelectListener.initialize({
            // Pass callback for backward compatibility with the callback pattern
            callback: handleEditorStateUpdate,
            enableListener: enabled,
            autoLink: initialAutoLink,
            selectionFilters: initialFilters
        });

        logger.debug('SelectListener initialized successfully');

        // Pre-populate Redux store with initial values if needed
        store.dispatch(toggleAutoLink(initialAutoLink));
        store.dispatch(setFilter(initialFilters));

    } catch (error) {
        logger.error('Error initializing SelectListener', error);

        // Show error notification
        store.dispatch(showNotification({
            message: `Error initializing selection listener: ${error.message}`,
            type: 'error',
            duration: 5000
        }));
    }

    // Enable or disable editor functionality
    enableEditorFunctionality(enabled);

    // Create API for external use
    const api = {
        updateUI: () => {
            updateEditorUI(getEditorState(store.getState()));
        },
        setEnabled: (enabled) => {
            enableEditorFunctionality(enabled);
            return enabled;
        }
    };

    // Update UI initially
    api.updateUI();

    return api;
}

// Export the editor module API
export default {
    init,
    updateEditorUI,
    updateSelectionUI,
    updateButtonStates,
    selectAllLayers,
    handleEditorAction,
    handleFilterTagClick,
    handleAutoLinkClick
};

/* ---- Legacy code below is kept for reference only ----
   This code will be removed once all functionality has been reimplemented with Redux
*/

/**
 * Link selected layers
 * @param {Array} layers - Selected layers to link
 * @returns {Promise<Object>} - Result of link operation
 */
async function linkSelectedHandler(layers) {
    if (!layers || layers.length === 0) {
        return { success: false, message: 'No layers selected' };
    }

    try {
        const result = await linkSelectedLayers(layers, true);
        store.dispatch(linkLayers(layers));
        return result;
    } catch (error) {
        console.error('Error linking layers', error);
        return { success: false, message: error.message };
    }
}

/**
 * Unlink selected layers
 * @param {Array} layers - Selected layers to unlink
 * @returns {Promise<Object>} - Result of unlink operation
 */
async function unlinkSelectedHandler(layers) {
    if (!layers || layers.length === 0) {
        return { success: false, message: 'No layers selected' };
    }

    try {
        const result = await linkSelectedLayers(layers, false);
        store.dispatch(unlinkLayers(layers));
        return result;
    } catch (error) {
        console.error('Error unlinking layers', error);
        return { success: false, message: error.message };
    }
}

/* LEGACY CODE - All code below this point is kept for reference only










/*












/*
// Legacy state management approach
const _state = {
    type: 'editor',
    element: getEl('#editor-menu'),
    selectListener: null,
    behaviors: [
            {
                description: "Select All Layers With Name",
                name: "Select",
                action: selectLayersByName,
                actionReturns: 'proxyArray: all active layers',
                buttonId: 'btnSelect',
                buttonElement: document.querySelector('#btnSelect'),
                options: [],
                callback: null
            },
            {
                description: "Propagate All Layers",
                name: "Propagate",
                actionReturns: 'proxyArray: all new layers including the selection',
                action: propagateLayers,
                buttonId: 'btnDuplicate',
                buttonElement: document.querySelector('#btnDuplicate'),
                options: [false],
                callback: null
            },
            {
                description: "Propagate Missing Layers",
                name: "PropagateMissing",
                actionReturns: 'proxyArray: all matching layers including selection',
                action: propagateLayers,
                buttonId: 'btnMissing',
                buttonElement: document.querySelector('#btnMissing'),
                options: [true],
                callback: null
            },
            {
                description: "Link Selected Layers",
                name: "LinkSelected",
                action: linkSelectedHandler,
                buttonId: 'btnLink',
                buttonElement: document.querySelector('#btnLink'),
                options: [],
                callback: null
            },
            {
                description: "Unlink Selected Layers",
                name: "UnlinkSelected",
                action: unlinkSelectedHandler,
                buttonId: 'btnUnlink',
                buttonElement: document.querySelector('#btnUnlink'),
                options: [],
                callback: null
            },
            {
                description: "Transform Layers Individually",
                name: "ScaleIndividually",
                action: transformLayersIndividually,
                buttonId: 'btnScale',
                buttonElement: document.querySelector('#btnScale'),
                options: ['scale'],
                callback: null
            },
            {
                description: "Transform Layers Individually",
                name: "RotateIndividually",
                action: transformLayersIndividually,
                buttonId: 'btnRotate',
                buttonElement: document.querySelector('#btnRotate'),
                options: ['rotate'],
                callback: null
            },
            {
                description: "Delete Selected Layers",
                name: "DeleteSelected",
                action: deleteSelectedLayers,
                buttonId: 'btnDeleteSelected',
                buttonElement: document.querySelector('#btnDeleteSelected'),
                options: [],
                callback: null
            },
            {
                description: "Match Styles By Name",
                name: "MatchStyleByName",
                action: matchStylesByName,
                buttonId: 'btnMatchStyle',
                buttonElement: document.querySelector('#btnMatchStyle'),
                options: [],
                callback: null
            },
            {
                description: "Clone to Next",
                name: "AddBoardInSequence",
                action: addBoardInSequence,
                buttonId: 'btnCloneNext',
                buttonElement: document.querySelector('#btnCloneNext'),
                options: ['next'],
                callback: null
            },
            {
                description: "Clone to Previous",
                name: "AddBoardInSequence",
                action: addBoardInSequence,
                buttonId: 'btnClonePrev',
                buttonElement: document.querySelector('#btnClonePrev'),
                options: ['prev'],
                callback: null
            },
            {
                description: "Select All Layers",
                name: "SelectAll",
                action: selectAllLayers,
                buttonId: 'btnSelectAll',
                buttonElement: document.querySelector('#btnSelectAll'),
                options: ['next'],
                callback: null
            }
        ],
        buttonsActive: false,
        filterSwitchElements: getEls('.plugin-scope-filter'),
        filterTagContainers: {
            state: getEl('#stateFilters'),
            device: getEl('#deviceFilters')
        },
        filterFeedbackElement: getEl('.plugin-filter-note'),
        filterTagToggles: getEls('.plugin-filters .plugin-tag'),
        scopeFilters: [],
        filterRegex: new RegExp('^.*$'),
        autoLink: {
            element: getEl('#btnAutoLink'),
            enabled: false,
            handler: handleAutoLinkClick
        },
        actionBar: {
            element: getEl('#action-bar'),
            feedbackElement: getEl('#feedback')
        },
        currentSelection: {
            layers: [],
            viable: false,
            sameGroup: true,
            identical: false,
        }
    ],
    buttonsActive: false,
    filterSwitchElements: getEls('.plugin-scope-filter'),
    filterTagContainers: {
        state: getEl('#stateFilters'),
        device: getEl('#deviceFilters')
    },
    filterFeedbackElement: getEl('.plugin-filter-note'),
    filterTagToggles: getEls('.plugin-filters .plugin-tag'),
    scopeFilters: [],
    filterRegex: new RegExp('^.*$'),
    autoLink: {
        element: getEl('#btnAutoLink'),
        enabled: false,
        handler: handleAutoLinkClick
    },
    actionBar: {
        element: getEl('#action-bar'),
        feedbackElement: getEl('#feedback')
    },
    currentSelection: {
        layers: [],
        viable: false,
        sameGroup: true,
        identical: false,
    }
}
const state = new Proxy(_state, stateHandler);

    
const init = async (onUpdate, creative, initialMode) => {
    return new Promise(async (resolve, reject) => {
        _onUpdateCallback = onUpdate;

        state.behaviors.forEach(behavior => {
            const eventObj = {
                eventName: `${behavior.name}_Handler`,
                eventType: 'click',
                name: behavior.name,
                description: behavior.description,
                actionReturns: behavior.actionReturns,
                element: behavior.buttonElement,
                elementId: behavior.buttonId,
                action: behavior.action,
                options: behavior.options,
                callback: behavior.callback,
                handlerFunc: handleEditorAction
            }
            registerEventListener(eventObj);
        });
        try {
            setTagLabelCursor(state.filterTagToggles);
            state.filterTagToggles.forEach(filter => {
                const eventObj = {
                    eventName: `FilterTag_Handler`,
                    eventType: 'click',
                    element: filter,
                    elementId: filter.id,
                    action: null,
                    options: [],
                    callback: null,
                    handlerFunc: handleFilterTagClick
                    actionReturns: behavior.actionReturns,
                    element: behavior.buttonElement,
                    elementId: behavior.buttonId,
                    action: behavior.action,
                    options: behavior.options,
                    callback: behavior.callback,
                    handlerFunc: handleEditorAction
                }
                registerEventListener(eventObj);
            });
            try {
                setTagLabelCursor(state.filterTagToggles);
                state.filterTagToggles.forEach(filter => {
                    const eventObj = {
                        eventName: `FilterTag_Handler`,
                        eventType: 'click',
                        element: filter,
                        elementId: filter.id,
                        action: null,
                        options: [],
                        callback: null,
                        handlerFunc: handleFilterTagClick
                    }
                    registerEventListener(eventObj);
                });
            } catch (error) {
                console.error(error);
            }
            const autoLinkEventObj = {
                eventName: `AutoLink_Handler`,
                eventType: 'change',
                element: state.autoLink.element,
                elementId: state.autoLink.element.id,
                handlerFunc: handleAutoLinkClick
            }
            registerEventListener(autoLinkEventObj);

            const listenerEnabled = initialMode === 'editor' ? true : false;
            state.selectListener = SelectListener.initialize({
                callback: handleLayerSelect,
                autoLink: state.autoLink.enabled,
                selectionFilters: state.scopeFilters,
                enableListener: listenerEnabled
            });
            // state.selectListener = new SelectListener({ callback: handleLayerSelect, autoLink: state.autoLink.enabled, selectionFilters: state.scopeFilters, enableListener: listenerEnabled });
            resolve(state);
        });
    }

/* Legacy code - commented out to avoid multiple default exports
export default {
  init,
  getSubscriptions,
  registerEventListener
};































*/
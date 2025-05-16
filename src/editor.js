import { getEl, getEls, restoreFocus, proxyArraysEqual, capitalizeFirstLetter, parentGroupCount, setTagLabelCursor, buildScopeRegex, diffProxyArrays } from "./js/helpers/utils.js";
import { selectLayersByName } from "./js/actions/selectLayersByName.js";
import { linkLayersByName } from "./js/actions/linkLayersByName.js";
import { unlinkLayersByName } from "./js/actions/unlinkLayersByName.js";
import { deleteLayersByName } from "./js/actions/deleteLayersByName.js";
import { propagateLayers } from "./js/actions/propagateLayers.js";
import { transformLayersIndividually } from "./js/actions/transformLayersIndividually.js";
import { deleteSelectedLayers } from "./js/actions/deleteSelectedLayers.js";
import { SelectListener } from "./js/actions/SelectListener.js";
import { createLogger } from './js/helpers/logger.js';
import { linkSelectedLayers } from './js/actions/linkSelectedLayers.js';
import { matchStylesByName } from './js/actions/matchStylesByName.js';
import { addBoardInSequence } from './js/actions/addBoardInSequence.js';

const { core, constants } = require("photoshop");
const { LayerKind } = constants;
let _onUpdateCallback = null;

const Editor = (() => {
    const logger = createLogger({ prefix: 'Editor', initialLevel: 'INFO' });

    const _eventListeners = [];
    const registerEventListener = (eventConfig = {}) => {
        eventConfig.eventHandler = (e) => eventConfig.handlerFunc(e, eventConfig);
        eventConfig.listener = eventConfig.element.addEventListener(eventConfig.eventType, eventConfig.eventHandler);
        _eventListeners.push(eventConfig);
    }

    const destroyEventListener = (eventListener) => {
        if (!eventListener.element || !eventListener.event || !eventListener.handlerFunc) return;
        eventListener.element.removeEventListener(eventListener.event, eventListener.eventHandler);
        _eventListeners.splice(_eventListeners.indexOf(eventListener), 1);
    }

    const setCurrentSelection = (selection) => {
        if (selection.identical && state.currentSelection.identical) return state.currentSelection;
        return state.currentSelection = { ...selection };
    }

    const updateEditor = (_extState) => {
        ///external stuff that I want the editor to react to.
        _extState.currentMode === 'editor' ? enableEditorFunctionality(true) : enableEditorFunctionality(false);
    }

    const setButtonState = (buttonsActive) => {
        return state.buttonsActive = buttonsActive;
    }

    const getButtonState = () => {
        return state.buttonsActive;
    }

    const getCurrentSelection = () => {
        return state.currentSelection;
    }

    const changeFilters = async (event, add) => {
        const { dataset } = event.target;
        const filter = { ...dataset, active: add };
        const newScopeFilters = [...state.scopeFilters];
        const idx = newScopeFilters.findIndex(f => f.name === filter.name);
        if (idx > -1) { // Filter with the same name found
            if (!add) {
                newScopeFilters.splice(idx, 1);
                state.scopeFilters = newScopeFilters;
            }
        } else { // No filter with the same name found
            if (add) {
                newScopeFilters.push(filter);
                state.scopeFilters = newScopeFilters;
            }
        }
        state.filterRegex = buildScopeRegex(state.scopeFilters);
        updateFilterUI(event, add);
        const result = state.selectListener.setSelectionFilters(state.filterRegex);
        console.log("(Editor) Selection filters updated", result);
        return result;
    }

    const getFilters = () => {
        return state.filterRegex;
    }
    // --- Layer Selection Handlers --- 
    const handleLayerSelect = async (selection) => {
        toggleActionBar(selection);
        const newSelection = setCurrentSelection(selection);
        console.log("(Editor) Selection changed", newSelection);
    }

    const updateFilterUI = (event, checked) => {
        event.target.setAttribute('data-active', checked);
        event.target.classList.toggle('plugin-tag--active');
        if (state.scopeFilters.length === 0 || state.scopeFilters.length === state.filterTagToggles.length) {
            state.filterFeedbackElement.classList.remove('plugin-filter-note--restricted');
            state.filterFeedbackElement.textContent = 'Edits are currently unrestricted';
        } else {
            state.filterFeedbackElement.classList.add('plugin-filter-note--restricted');
            state.filterFeedbackElement.textContent = 'Edits are currently restricted to selected filters';
        }
    }

    const createTag = (type, name) => {
        const tag = document.createElement('sp-tag');
        tag.classList.add('plugin-tag', `plugin-tag--${type}`);
        tag.textContent = capitalizeFirstLetter(name);
        return tag;
    }

    // --- UI Feedback Handlers --- 
    const toggleButtons = (enable = getCurrentSelection().viable) => {
        const buttonState = getButtonState();
        if (enable === buttonState) return;
        const newState = setButtonState(enable);
        state.behaviors.forEach(behavior => {
            if (!newState) {
                behavior.buttonElement.setAttribute('disabled', true);
                // behavior.buttonElement.style.color = 'rgba(255, 255, 255, 0.1)';
            } else {
                behavior.buttonElement.removeAttribute('disabled');  // clears the flag
                // behavior.buttonElement.removeAttribute('style');
            }
        });
    }

    const setEditorEnabled = async ({ enabled }) => {
        logger.info('setEditorEnabled', enabled);
        if (enabled) {
            logger.info('Toggling Select Listener On', state.selectListener);
            const listenToggle = await state.selectListener?.setListening(true);
            logger.info('setEditorEnabled listenToggle', listenToggle);
        } else {
            logger.info('Toggling Select Listener Off');
            const results = await Promise.all([
                state.selectListener?.setListening(false),
                toggleAutoLinkBtn(false),
                toggleActionBar()
            ]);
            logger.info('setEditorEnabled results', results);
        }
    }

    const toggleActionBar = async (selection = null) => {
        try {


            let feedbackMessage = '';
            // logger.info('toggleActionBar', selection);
            if (!selection || selection.layers.length === 0) return state.actionBar.element.removeAttribute('open');
            state.actionBar.element.setAttribute('open', true);

            selection.parentGroupCount.size === 1 ?
                state.actionBar.element.classList.replace('selection-many-groups', 'selection-same-groups') :
                state.actionBar.element.classList.replace('selection-same-groups', 'selection-many-groups');

            console.log('TYPE!!!!!!!!!!', selection.type);
            if (selection.type === 'group') {
                feedbackMessage = `<span class='plugin-action-bar-pill'>${selection.layers.length} Artboard${selection.layers.length === 1 ? '' : 's'}</span> selected`;
                state.actionBar.element.classList.remove('mixed-selection');
                state.actionBar.element.classList.add('group-selection');
            }
            if (selection.type === 'layer') {
                feedbackMessage = `<span class='plugin-action-bar-pill'>${selection.layers.length} Layer${selection.layers.length === 1 ? '' : 's'}</span> selected ${selection.parentGroupCount.size === 1 ? ('In The <span class="plugin-action-bar-pill">Same Artboard</span>') : (`Across <span class='plugin-action-bar-pill'>${selection.parentGroupCount.size} Artboards</span>`)}`;
                state.actionBar.element.classList.remove('mixed-selection');
                state.actionBar.element.classList.remove('group-selection');
            }
            if (selection.type === 'mixed') {
                feedbackMessage = `You've currently selected an artboard, or a mix of artboards and layers. Performing bulk actions on artboards is not supported`;
                state.actionBar.element.classList.add('mixed-selection');
                state.actionBar.element.classList.remove('group-selection');
            }
            state.actionBar.feedbackElement.innerHTML = feedbackMessage;

            return { name: 'toggleActionBar', success: true, message: 'Action bar toggled successfully' }
        } catch (err) {
            return { name: 'toggleActionBar', success: false, message: err.message }
        }
    }

    // --- Editor Event Handlers --- 
    const handleEditorAction = (event, behavior) => {
        logger.debug('handleEditorAction', event, behavior);
        // console.log(`executing ${behavior.name} action...`);
        setTimeout(async () => {
            try {
                logger.debug(`Starting awaited ${behavior.name} action...`);
                const validTypes = getFilters();
                logger.debug('validTypes', validTypes)
                const result = await behavior.action(validTypes, ...behavior.options);
                logger.debug(`DEBUG: Result from ${behavior.name} action:`, result);
                restoreFocus();
                behavior.callback?.(result.layers);
                if (!result.success && result.message) {
                    // await core.showAlert(result.message);
                }
            } catch (err) {
                logger.error(`DEBUG: Error calling ${behavior.name} action:`, err);
                const errorMessage = err.message || err.toString() || "Unknown error.";
                //state.actionBar.feedbackElement.textContent = `Error: ${errorMessage}`;
                //await core.showAlert(`Error ${behavior.name}: ${errorMessage}`);
            }
        }, 1);
    }

    const handleFilterChange = (event, behavior) => {
        const { checked } = event.target;
        const newFilters = changeFilters(event, checked);
        behavior.callback?.(newFilters);
    }

    const handleFilterTagClick = (event, behavior) => {
        const checked = !(event.target.dataset.active === 'true' || event.target.dataset.active === true);
        const newFilters = changeFilters(event, checked);
        behavior.callback?.(newFilters);
    }

    const handleAutoLinkClick = async (event) => {
        const checked = !event.target.hasAttribute('selected');
        const result = await toggleAutoLinkBtn(checked);
        return result;
    }

    const toggleAutoLinkBtn = async (active) => {
        state.autoLink.enabled = active;
        active ? state.autoLink.element.setAttribute('selected', '') : state.autoLink.element.removeAttribute('selected');
        active ? state.autoLink.element.textContent = 'Auto Link Enabled' : state.autoLink.element.textContent = 'Auto Link Disabled';
        // console.log('setting autolink to', state.autoLink.enabled);
        const result = await state.selectListener.setAutoLink(state.autoLink.enabled);
        // console.log('autolink result', result);
        return result;
    }

    const stateHandler = {
        set: function (target, property, value) {
            target[property] = value;
            logger.debug('setting state property:', target, property, value);
            _notifyStateChange(state);
            return target[property];
        },
        get: function (target, property) {
            return target[property];
        }
    };

    function _notifyStateChange(state) {
        // logger.debug('state change', state);
        if (_onUpdateCallback) {
            _onUpdateCallback(state);
        }
    }

    const linkSelectedHandler = async () => {
        const { layers } = state.currentSelection;
        if (layers.length === 0) {
            // state.actionBar.feedbackElement.textContent = 'No layers selected.';
            return;
        }
        await linkSelectedLayers(layers, true);
    }

    const unlinkSelectedHandler = async () => {
        const { layers } = state.currentSelection;
        if (layers.length === 0) {
            // state.actionBar.feedbackElement.textContent = 'No layers selected.';
            return;
        }
        await linkSelectedLayers(layers, false);
    }

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
                options: [],
                callback: null
            },
            {
                description: "Clone to Previous",
                name: "AddBoardInSequence",
                action: addBoardInSequence,
                buttonId: 'btnClonePrev',
                buttonElement: document.querySelector('#btnClonePrev'),
                options: [],
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
        filterRegex: /^.*$/,
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
    // let _creativeState = null,
    //     creativeState = null;

    const init = async (onUpdate, creative, initialMode) => {
        return new Promise(async (resolve, reject) => {
            _onUpdateCallback = onUpdate;
            // logger.info('creative', creative);
            // _creativeState = creative;
            // creativeState = new Proxy(_creativeState, stateHandler);


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
            /*
            state.filterSwitchElements.forEach(filterElement => {
                const eventObj = {
                    eventName: `FilterSwitch_Handler`,
                    eventType: 'change',
                    element: filterElement,
                    elementId: filterElement.id,
                    action: null,
                    options: [],
                    callback: updateFilterUI,
                    handlerFunc: handleFilterChange
                }
                registerEventListener(eventObj);
                // filter.addEventListener('change', handleFilterChange);
            });
            */
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
    return { init, setEditorEnabled };
})();


export default Editor;
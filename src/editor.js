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

const { core, constants } = require("photoshop");
const { LayerKind } = constants;
let _onUpdateCallback = null;

const Editor = (() => {
    const logger = createLogger({ prefix: 'Editor', initialLevel: 'INFO' });

    const stateHandler = {
        set: function (target, property, value) {
            target[property] = value;
            // logger.debug('setting state property:', target, property, value);
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
            // {
            //     description: "Link All Layers With Name",
            //     name: "Link",
            //     actionReturns: 'proxyArray: linked layer selection',
            //     action: linkLayersByName,
            //     buttonId: 'btnLink',
            //     buttonElement: document.querySelector('#btnLink'),
            //     options: [],
            //     callback: null
            // },
            // {
            //     description: "Unlink All Layers With Name",
            //     name: "Unlink",
            //     actionReturns: 'proxyArray: unlinked layer selection',
            //     action: unlinkLayersByName,
            //     buttonId: 'btnUnlink',
            //     buttonElement: document.querySelector('#btnUnlink'),
            //     options: [],
            //     callback: null
            // },
            // {
            //     description: "Delete All Layers With Name",
            //     name: "Delete",
            //     actionReturns: 'proxyArray: empty layer selection',
            //     action: deleteLayersByName,
            //     buttonId: 'btnDelete',
            //     buttonElement: document.querySelector('#btnDelete'),
            //     options: [],
            //     callback: null
            // },
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
            handler: toggleAutoLink
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
    let _creativeState = null,
        creativeState = null;

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

    // const getSelectionViability = (layers) => {
    //     ///if some selected layers are groups, BUT not all of them are groups, then it's not viable - We don't want to be applying transformations
    //     /// to individual layers and artboards on the same action because it'll produce weird results.
    //     return !layers.some(item => item.kind === LayerKind.GROUP) && layers.every(item => item.kind !== LayerKind.GROUP)
    // }

    const setCurrentSelection = (selection) => {
        /* // const _sel = { ...state.currentSelection };
        // console.log('setting current selection', selection);
        ///if empty selection reset to default
        // logger.debug("(Editor) STARTING SET CURRENT", Date.now());

        // if(selection.length === 0) {
        // //     _sel.viable = true;
        // //     _sel.identical = false;
        // //     _sel.layers = [];
        // //     _sel.sameGroup = true;
        // //     state.currentSelection = _sel;
        // //     // console.log('set select to empty, update state');
        // //     return state.currentSelection;
        // // }
        // //check if the new selection is identical to the existing selection
        // const isIdentical = proxyArraysEqual(selection, _sel.layers);


        // //if selection is already set to identical to current selection, return current selection without processing further.
        // const alreadyIdentical = isIdentical && _sel.identical;
        // if(alreadyIdentical) return _sel;


        //otherwise either set to identical, or update viability and layers. Then return the current selection
        // _sel.identical = isIdentical; 
        // if(_sel.identical) {
        //     state.currentSelection = _sel;
        //     // console.log('set select to identical, update state');
        //     return state.currentSelection;
        // } else {
        //     _sel.viable = getSelectionViability(selection);
        //     _sel.layers = selection;
        //     _sel.parentGroupCount = parentGroupCount(selection);
        //     state.currentSelection = _sel;
        //     // console.log('selection changed, update state');
        //     // logger.debug("(Editor) DONE SET CURRENT SELECTION", Date.now());
        //     logger.debug('selection changed', state.currentSelection);
        //     return state.currentSelection;
        // }*/
        state.currentSelection = selection;
        return state.currentSelection;
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

    function changeFilters(event, add) {
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
        state.selectListener.setSelectionFilters(state.filterRegex);
        return state.scopeFilters;
    }

    function getFilters() {
        return state.filterRegex;
    }
    // --- Layer Selection Handlers --- 
    function handleLayerSelect(event, selection = []) {
        const newSelection = setCurrentSelection(selection);
        toggleActionBar(newSelection);
        // toggleButtons(newSelection.viable);
    }

    function updateFilterUI(event, checked) {
        event.target.setAttribute('data-active', checked);
        event.target.classList.toggle('plugin-tag--active');
        if (state.scopeFilters.length === 0 || state.scopeFilters.length === state.filterTagToggles.length) {
            state.filterFeedbackElement.classList.remove('plugin-filter-note--restricted');
            state.filterFeedbackElement.textContent = 'Edits are currently unrestricted';
        } else {
            state.filterFeedbackElement.classList.add('plugin-filter-note--restricted');
            state.filterFeedbackElement.textContent = 'Edits are currently restricted to selected filters';
        }
        /*
        const deviceFilters = state.scopeFilters.filter(f => f.type === 'device');
        const stateFilters = state.scopeFilters.filter(f => f.type === 'state');
        const deviceFilterContainer = state.filterTagContainers.device;
        const stateFilterContainer = state.filterTagContainers.state;
        deviceFilterContainer.innerHTML = '';
        stateFilterContainer.innerHTML = '';
        if(deviceFilters.length === 0) {
            const tag = createTag('device', 'All Devices');
            deviceFilterContainer.appendChild(tag);
        } else {
            deviceFilters.forEach(f => {
                const tag = createTag(f.type, f.name);
                deviceFilterContainer.appendChild(tag);
            });
        }
        if(stateFilters.length === 0) {
            const tag = createTag('state', 'All Sequences');
            stateFilterContainer.appendChild(tag);
        } else {            
            stateFilters.forEach(f => {
                const tag = createTag(f.type, f.name);
                stateFilterContainer.appendChild(tag);
            });
        }
        */
    }

    function createTag(type, name) {
        const tag = document.createElement('sp-tag');
        tag.classList.add('plugin-tag', `plugin-tag--${type}`);
        tag.textContent = capitalizeFirstLetter(name);
        return tag;
    }

    // --- UI Feedback Handlers --- 
    function toggleButtons(enable = getCurrentSelection().viable) {
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

    function toggleActionBar(selection = null) {
        if (!selection || selection.layers.length === 0) return state.actionBar.element.removeAttribute('open');
        state.actionBar.element.setAttribute('open', true);


        selection.parentGroupCount.size === 1 ?
            state.actionBar.element.classList.replace('selection-many-groups', 'selection-same-groups') :
            state.actionBar.element.classList.replace('selection-same-groups', 'selection-many-groups');

        let feedbackMessage;
        if (!selection.viable) {
            feedbackMessage = `You've currently selected an artboard, or a mix of artboards and layers. Performing bulk actions on artboards is not supported`;
            state.actionBar.element.classList.add('mixed-selection');
        } else {
            feedbackMessage = `<span class='plugin-action-bar-pill'>${selection.layers.length} Layer${selection.layers.length === 1 ? '' : 's'}</span> selected ${selection.parentGroupCount.size === 1 ? ('In The <span class="plugin-action-bar-pill">Same Artboard</span>') : (`Across <span class='plugin-action-bar-pill'>${selection.parentGroupCount.size} Artboards</span>`)}`;
            state.actionBar.element.classList.remove('mixed-selection');
        }
        state.actionBar.feedbackElement.innerHTML = feedbackMessage;
    }

    // --- Editor Event Handlers --- 
    function handleEditorAction(event, behavior) {
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

    function handleFilterChange(event, behavior) {
        const { checked } = event.target;
        const newFilters = changeFilters(event, checked);
        behavior.callback?.(newFilters);
    }

    function handleFilterTagClick(event, behavior) {
        const checked = !(event.target.dataset.active === 'true' || event.target.dataset.active === true);
        const newFilters = changeFilters(event, checked);
        behavior.callback?.(newFilters);
    }

    function toggleAutoLink(event) {
        console.log('enabled: ', event.target);
        const checked = !event.target.hasAttribute('selected');
        state.autoLink.enabled = checked;
        checked ? event.target.setAttribute('selected', '') : event.target.removeAttribute('selected');
        checked ? event.target.textContent = 'Auto Link Enabled' : event.target.textContent = 'Auto Link Disabled';
        state.selectListener.setAutoLink(state.autoLink.enabled);
    }

    const init = (onUpdate, creative) => {
        return new Promise((resolve, reject) => {
            _onUpdateCallback = onUpdate;
            _creativeState = creative;
            creativeState = new Proxy(_creativeState, stateHandler);

            state.behaviors.forEach(behavior => {
                /* EXAMPLE BEHAVIOR OBJECT
                {
                    description: "Propagate Missing Layers",
                    name: "PropagateMissing",
                    actionReturns: 'proxyArray: all matching layers including selection',
                    action: propagateLayers,
                    buttonId: 'btnMissing',
                    buttonElement: document.querySelector('#btnMissing'),
                    options: [true],
                    callback: null
                }
                */
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
                // behavior.buttonElement.addEventListener('click', () => handleEditorAction(behavior));
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
            ///this will be refactored eventually. At one point i was trying to do this all with classes but i've decided against that. 

            // const autoLinkEventObj = {
            //     eventName: `AutoLink_Handler`,
            //     eventType: 'change',
            //     element: state.autoLink.element,
            //     elementId: state.autoLink.element.id,
            //     handlerFunc: toggleAutoLink
            // }
            // registerEventListener(autoLinkEventObj);
            const autoLinkEventObj = {
                eventName: `AutoLink_Handler`,
                eventType: 'change',
                element: state.autoLink.element,
                elementId: state.autoLink.element.id,
                handlerFunc: toggleAutoLink
            }
            registerEventListener(autoLinkEventObj);
            state.selectListener = new SelectListener({ callback: handleLayerSelect, autoLink: state.autoLink.enabled, selectionFilters: state.scopeFilters });
            resolve(state);
        });
    }
    return { init };
})();


export default Editor;
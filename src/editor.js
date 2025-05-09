import { getEl, getEls, restoreFocus, proxyArraysEqual } from "./js/helpers/utils.js";
import { selectLayersByName } from "./js/actions/selectLayersByName.js";
import { linkLayersByName } from "./js/actions/linkLayersByName.js";
import { unlinkLayersByName } from "./js/actions/unlinkLayersByName.js";
import { deleteLayersByName } from "./js/actions/deleteLayersByName.js";
import { propagateLayers } from "./js/actions/propagateLayers.js";
import { transformLayersIndividually } from "./js/actions/transformLayersIndividually.js";
import { deleteSelectedLayers } from "./js/actions/deleteSelectedLayers.js";
import { SelectListener } from "./js/actions/SelectListener.js";


const { core, constants } = require("photoshop");
const { LayerKind } = constants;
let _onUpdateCallback = null;

const Editor = (() => {

    const stateHandler = {
        set: function(target, property, value) {
            target[property] = value;
            _notifyStateChange();
            return true;
        }
    };

    function _notifyStateChange() {
        if (_onUpdateCallback) {
            _onUpdateCallback({
                panel: 'editor',
                state: state
            });
        }
    }

    const linkSelectedLayers = async () => {
    }

    const _state = {
        element: getEl('#editor-menu'),
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
                action: linkSelectedLayers,
                buttonId: 'btnLink',
                buttonElement: document.querySelector('#btnLink'),
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
        scopeFilters: [],
        scopeMatchRule: 'all',
        actionBar: {
            element: getEl('#action-bar'),
            feedbackElement: getEl('#feedback'),
        },
        currentSelection: {
            layers:[],
            viable: false,
            identical: false,   
        }
    }

    const state = new Proxy(_state, stateHandler);

    const _eventListeners = [];
    const registerEventListener = (eventConfig = {}) => {
        eventConfig.eventHandler = (e) => eventConfig.handlerFunc(e, eventConfig);
        eventConfig.listener = eventConfig.element.addEventListener(eventConfig.eventType, eventConfig.eventHandler);
        _eventListeners.push(eventConfig);
        console.log('registerEventListener', eventConfig);
    }

    const destroyEventListener = (eventListener) => {
        if(!eventListener.element || !eventListener.event || !eventListener.handlerFunc) return;
        eventListener.element.removeEventListener(eventListener.event, eventListener.eventHandler);
        _eventListeners.splice(_eventListeners.indexOf(eventListener), 1);
    }

    const getSelectionViability = (layers) => {
        console.log(layers);
        ///if some selected layers are groups, BUT not all of them are groups, then it's not viable - We don't want to be applying transformations
        /// to individual layers and artboards on the same action because it'll produce weird results.
        return !layers.some(item => item.kind === LayerKind.GROUP) && layers.every(item => item.kind !== LayerKind.GROUP)
    }

    const setCurrentSelection = (selection) => {
        const _sel = {...getCurrentSelection()};
        ///if empty selection reset to default
        if(selection.length === 0) {
            _sel.viable = true;
            _sel.identical = false;
            _sel.layers = [];
            state.currentSelection = _sel;
            return state.currentSelection;
        }

        //check if the new selection is identical to the existing selection
        const isIdentical = proxyArraysEqual(selection, _sel.layers);

        //if selection is already set to identical to current selection, return current selection without processing further.
        const alreadyIdentical = isIdentical && _sel.identical;
        if(alreadyIdentical) return _sel;

        ///otherwise either set to identical, or update viability and layers. Then return the current selection
        _sel.identical = isIdentical; 
        if(_sel.identical) {
            state.currentSelection = _sel;
            return state.currentSelection;
        } else {
            _sel.viable = getSelectionViability(selection);
            _sel.layers = selection;
            state.currentSelection = _sel;
            return state.currentSelection;
        }
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
    
    function changeFilters(dataset, add) {
        const filter = {...dataset};
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
        return state.scopeFilters;
    }

    function getFilters() {
        return state.scopeFilters;
    }
    // --- Layer Selection Handlers --- 
    function handleLayerSelect(event, selection = []) {
        const newSelection = setCurrentSelection(selection);
        console.log(newSelection)
        toggleActionBar(newSelection);
        toggleButtons(newSelection.viable);
    }

    function updateFilterUI() {
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
    }
    


    function createTag(type, name) {
        const tag = document.createElement('sp-tag');
        tag.classList.add('plugin-tag', `plugin-tag--${type}`);
        tag.textContent = name;
        return tag;
    }

    // --- UI Feedback Handlers --- 
    function toggleButtons(enable = getCurrentSelection().viable) {
        console.log('enable buttons?:', enable)
        const buttonState = getButtonState();
        console.log('button state:', buttonState)
        if(enable === buttonState) return;
        const newState = setButtonState(enable);
        state.behaviors.forEach(behavior => {
            if(!newState) {
                behavior.buttonElement.setAttribute('disabled', true);
                behavior.buttonElement.style.color = 'rgba(255, 255, 255, 0.1)';
            } else {
                behavior.buttonElement.removeAttribute('disabled');  // clears the flag
                behavior.buttonElement.removeAttribute('style');
            }
        });
    }

    function toggleActionBar(selection = null) {
        if(!selection || selection.layers.length === 0) return state.actionBar.element.removeAttribute('open');    
        state.actionBar.element.setAttribute('open', true);
        if(!selection.viable) {
            state.actionBar.feedbackElement.textContent = `You've currently selected a mix of artboards and layers. Performing bulk actions on a mix of artboards and layers is not supported`;
            state.actionBar.element.removeAttribute('emphasized');
        } else {
            state.actionBar.feedbackElement.textContent = `${selection.layers.length} layers selected`;
            state.actionBar.element.setAttribute('emphasized', true);
        }
    }   

    // --- Editor Event Handlers --- 
    function handleEditorAction(event, behavior) {
        console.log('handleEditorAction', event, behavior); 
        // console.log(`executing ${behavior.name} action...`);
        setTimeout(async () => {
            try {
                console.log(`Starting awaited ${behavior.name} action...`);
                const validTypes = getFilters();
                console.log(validTypes)
                const result = await behavior.action(validTypes, ...behavior.options); 
                console.log(`DEBUG: Result from ${behavior.name} action:`, result);
                restoreFocus();
                behavior.callback?.(result.layers);
                if (!result.success && result.message) { 
                    await core.showAlert(result.message);
                } 
            } catch (err) {
                console.error(`DEBUG: Error calling ${behavior.name} action:`, err);
                const errorMessage = err.message || err.toString() || "Unknown error.";
                state.actionBar.feedbackElement.textContent = `Error: ${errorMessage}`;
                await core.showAlert(`Error ${behavior.name}: ${errorMessage}`);
            }    
        }, 1);
    }

    function handleFilterChange(event, behavior) {
        const {dataset, checked} = event.target;
        const newFilters = changeFilters(dataset, checked);
        behavior.callback(newFilters);
    }

   const initializeSection = (onUpdate) => {
    
        _onUpdateCallback = onUpdate;
        
        state.behaviors.forEach(behavior => {
            const eventObj = {
                eventName: `${behavior.name}_Handler`,
                eventType: 'click',
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
        ///this will be refactored eventually. At one point i was trying to do this all with classes but i've decided against that. 
        const selectListener = new SelectListener({callback: handleLayerSelect});
    }
    return { initializeSection };
})();


export default Editor;
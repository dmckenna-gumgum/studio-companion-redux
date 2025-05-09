import { getEl, getEls, restoreFocus } from "./js/helpers/utils.js";
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

const Editor = (() => {

    const editor = {
        element: getEl('#editor-menu'),
        behaviors: [
            {
                description: "Select All Layers With Name",
                name: "Select",
                action: selectLayersByName,
                buttonId: 'btnSelect',
                buttonElement: document.querySelector('#btnSelect'),
                options: [],
                callback: handleLayerSelect
            },
            {
                description: "Link All Layers With Name",
                name: "Link",
                action: linkLayersByName,
                buttonId: 'btnLink',
                buttonElement: document.querySelector('#btnLink'),
                options: []
            },
            {
                description: "Unlink All Layers With Name",
                name: "Unlink",
                action: unlinkLayersByName,
                buttonId: 'btnUnlink',
                buttonElement: document.querySelector('#btnUnlink'),
                options: []
            },
            {
                description: "Delete All Layers With Name",
                name: "Delete",
                action: deleteLayersByName,
                buttonId: 'btnDelete',
                buttonElement: document.querySelector('#btnDelete'),
                options: []
            },
            {
                description: "Propagate All Layers",
                name: "Propagate",
                action: propagateLayers,
                buttonId: 'btnDuplicate',
                buttonElement: document.querySelector('#btnDuplicate'),
                options: [false]
            },
            {
                description: "Propagate Missing Layers",
                name: "Propagate Missing",
                action: propagateLayers,
                buttonId: 'btnMissing',
                buttonElement: document.querySelector('#btnMissing'),
                options: [true]
            },
            {
                description: "Transform Layers Individually",
                name: "Transform Individually",
                action: transformLayersIndividually,
                buttonId: 'btnScale',
                buttonElement: document.querySelector('#btnScale'),
                options: ['scale'] // Pass validTypes and transformType
            },
            {
                description: "Transform Layers Individually",
                name: "Transform Individually",
                action: transformLayersIndividually,
                buttonId: 'btnRotate',
                buttonElement: document.querySelector('#btnRotate'),
                options: ['rotate']
            },
            {
                description: "Delete Selected Layers",
                name: "Delete Selected",
                action: deleteSelectedLayers,
                buttonId: 'btnDeleteSelected',
                buttonElement: document.querySelector('#btnDeleteSelected'),
                options: []
            }
        ],
        buttonsActive: false,
        filterSwitchElements: getEls('.plugin-scope-filter'),
        scopeFilters: [],
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


    const setCurrentSelection = (selection) => {
        editor.currentSelection.identical = selection.length === getCurrentSelection().layers.length && [...selection].every((v, i) => v === getCurrentSelection().layers[i]) ? true : false;    
        if(editor.currentSelection.identical) return;
        editor.currentSelection.viable = !selection.some(item => item.kind === LayerKind.GROUP) && selection.every(item => item.kind !== LayerKind.GROUP)
        editor.currentSelection.layers = selection;
        return editor.currentSelection;
    }

    const setButtonState = (state) => {
        return editor.buttonsActive = state;
    }

    const getButtonState = () => {
        return editor.buttonsActive;
    }

    const getCurrentSelection = () => {
        return editor.currentSelection;
    } 
    
    function addFilterString(filterString, add) {
        const idx = editor.filterValues.indexOf(filterString);
        if (add && idx === -1) editor.filterValues.push(filterString);
        if (!add && idx > -1)  editor.filterValues.splice(idx, 1);
        return editor.filterValues;
    }

    function getFilterStrings() {
        return editor.filterValues;
    }
    // --- Layer Selection Handlers --- 
    function handleLayerSelect(selection = []) {
        if(selection.length === 0) return toggleActionBar();
        const newSelection = setCurrentSelection(selection);
        toggleActionBar(newSelection);
        toggleButtonDisable(newSelection.viable);
    }

    // --- UI Feedback Handlers --- 
    function toggleButtonDisable(enable = getCurrentSelection().viable) {
        const buttonState = getButtonState();
        if(enable === buttonState) return;
        setButtonState(enable);
        editor.behaviors.forEach(behavior => {
            enable ? behavior.buttonElement.removeAttribute('disabled') : behavior.buttonElement.setAttribute('disabled', '');
            enable ? behavior.buttonElement.setAttribute('style', 'border-color: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.1);') : behavior.buttonElement.removeAttribute('style');
        });
    }

    function toggleActionBar(selection = null) {
        if(!selection) return editor.actionBar.element.removeAttribute('open');    
        editor.actionBar.element.setAttribute('open', true);
        if(!selection.viable) {
            editor.actionBar.feedbackElement.textContent = `You've currently selected a mix of artboards and layers. Performing bulk actions on a mix of artboards and layers is not supported`;
            editor.actionBar.element.removeAttribute('emphasized');
            editor.behaviors.forEach(behavior => {
                //behavior.buttonElement.setAttribute('disabled', true);
                behavior.buttonElement.style.color = 'rgba(255, 255, 255, 0.1)';
            });
        } else {
            editor.actionBar.feedbackElement.textContent = `${selection.layers.length} layers selected`;
            editor.actionBar.element.setAttribute('emphasized', true);
            editor.behaviors.forEach(behavior => {
                behavior.buttonElement.removeAttribute('disabled');  // clears the flag
                behavior.buttonElement.removeAttribute('style');
            });
        }
    }   

    // --- Editor Event Handlers --- 
    function handleEditorAction(behavior) {
        console.log(`executing ${behavior.name} action...`);
        setTimeout(async () => {
            try {
                console.log(`Starting awaited ${behavior.name} action...`);
                const validTypes = getFilterStrings();
                console.log(validTypes)
                const result = await behavior.action(validTypes, ...behavior.options); 
                console.log(`DEBUG: Result from ${behavior.name} action:`, result);
                restoreFocus();
                behavior.callback?.();
                if (!result.success && result.message) { 
                    await core.showAlert(result.message);
                } 
            } catch (err) {
                console.error(`DEBUG: Error calling ${behavior.name} action:`, err);
                const errorMessage = err.message || err.toString() || "Unknown error.";
                plugin.sections.editor.actionBar.feedbackElement.textContent = `Error: ${errorMessage}`;
                await core.showAlert(`Error ${behavior.name}: ${errorMessage}`);
            }    
        }, 1);
    }

    function handleFilterChange(event) {
        const {dataset, checked} = event.target;
        addFilterString(dataset.filter, checked);
    }

   const initializeSection = () => {
        console.log('hello world');
        
        editor.behaviors.forEach(behavior => {
            behavior.buttonElement.addEventListener('click', () => handleEditorAction(behavior));
        });    
        editor.filterSwitchElements.forEach(filter => {
            filter.addEventListener('change', () => handleFilterChange(filter));
        });
        const selectListener = new SelectListener({callback: handleLayerSelect});
    }
    return { initializeSection };
})();

export default Editor;
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/src/themes.js';
import '@swc-uxp-wrappers/utils';
import '@swc-uxp-wrappers/button/sp-button.js';
import '@swc-uxp-wrappers/checkbox/sp-checkbox.js';
import '@swc-uxp-wrappers/action-bar/sp-action-bar.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-heading.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-item.js';

// Core Actions
import { selectLayersByName } from "./js/actions/selectLayersByName.js";
import { linkLayersByName } from "./js/actions/linkLayersByName.js";
import { unlinkLayersByName } from "./js/actions/unlinkLayersByName.js";
import { deleteLayersByName } from "./js/actions/deleteLayersByName.js";
import { propagateLayers } from "./js/actions/propagateLayers.js";

// UXP modules
const { core } = require("photoshop");

const checkBoxElements = [];
let feedbackElement;

// --- Helper Function to Get Options ---
function getValidTypes() {
    const validTypes = [];
    const anyChecked = checkBoxElements.some(checkbox => checkbox.checked);
    //if none are checked, default to all, otherwise only add values of checked boxes. 
    checkBoxElements.forEach(element => {
        if (element.checked || !anyChecked) validTypes.push(element.value);
    });
    return validTypes;
}

// --- Event Handlers ---
function buttonClickHandler(behavior) {
    feedbackElement.textContent = `executing ${behavior.name} action...`;
    setTimeout(async () => {
        try {
            console.log(`Starting awaited ${behavior.name} action...`);
            const result = await behavior.action(getValidTypes(), ...behavior.options); 
            console.log(`DEBUG: Result from ${behavior.name} action:`, result);
            // Use a more descriptive message if possible
            feedbackElement.textContent = result.message || (result.success ? `${behavior.name} finished. ${behavior.description} affected ${result.count} total instances.` : `${behavior.name} failed.`);
            restoreFocus();
            // Optional: Alert only on unexpected failure 
            if (!result.success && result.message) { 
                await core.showAlert(result.message);
            } 
        } catch (err) {
            console.error(`DEBUG: Error calling ${behavior.name} action:`, err);
            const errorMessage = err.message || err.toString() || "Unknown error.";
            feedbackElement.textContent = `Error: ${errorMessage}`;
            await core.showAlert(`Error ${behavior.name}: ${errorMessage}`);
        }    
    }, 1);
}


//Per this thread: https://forums.creativeclouddeveloper.com/t/clicking-any-button-on-any-uxp-panel-inactivates-keyboard-shortcuts-for-tools-and-brush-sizes/2379/11 
//This stupid workaround is needed to ensure keyboard shortcuts work after any action is run. Fuck you adobe!
function restoreFocus() {
    //get OS platform 
    const os = require('os').platform();
    if (os.includes('win')) {
        //for PC
        core.performMenuCommand({
            commandID: 1208,
            kcanDispatchWhileModal: true,
            _isCommand: false
        });
    } else {
        //for Mac
        const cmds = [2982,2986,2986];
        cmds.map(cmd => core.performMenuCommand({
            commandID: cmd,
            kcanDispatchWhileModal: true,
            _isCommand: false
        }));
    }
}


// --- Initialization ---
function initializePanel() {
    console.log("DEBUG: Initializing panel...");

    checkBoxElements.push(
        document.getElementById('chkDesktop'),
        document.getElementById('chkMobile'),
        document.getElementById('chkTile')
    );
    feedbackElement = document.getElementById('feedback');

    // Import actions directly
    const behaviors = [
        {
            description: "Select All Layers With Name",
            name: "Select",
            action: selectLayersByName,
            buttonId: 'btnSelect',
            buttonElement: document.getElementById('btnSelect'),
            options: []
        },
        {
            description: "Link All Layers With Name",
            name: "Link",
            action: linkLayersByName,
            buttonId: 'btnLink',
            buttonElement: document.getElementById('btnLink'),
            options: []
        },
        {
            description: "Unlink All Layers With Name",
            name: "Unlink",
            action: unlinkLayersByName,
            buttonId: 'btnUnlink',
            buttonElement: document.getElementById('btnUnlink'),
            options: []
        },
        {
            description: "Delete All Layers With Name",
            name: "Delete",
            action: deleteLayersByName,
            buttonId: 'btnDelete',
            buttonElement: document.getElementById('btnDelete'),
            options: []
        },
        {
            description: "Propagate All Layers",
            name: "Propagate",
            action: propagateLayers,
            buttonId: 'btnDuplicate',
            buttonElement: document.getElementById('btnDuplicate'),
            options: [false]
        },
        {
            description: "Propagate Missing Layers",
            name: "Propagate Missing",
            action: propagateLayers,
            buttonId: 'btnMissing',
            buttonElement: document.getElementById('btnMissing'),
            options: [true]
        }
    ];

    behaviors.forEach(behavior => {
        if (behavior.buttonElement) {
            behavior.buttonElement.addEventListener('click', () => buttonClickHandler(behavior));
        } else {
            console.error(`Button element not found for ${behavior.buttonId}`);
        }
    });

    document.getElementById('feedback').textContent = 'Panel ready.';
}

// Handle proper loading sequence
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing");
    initializePanel();
});

console.log("DEBUG: Script execution started. Waiting for DOMContentLoaded.");
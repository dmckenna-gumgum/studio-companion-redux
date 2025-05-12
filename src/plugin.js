// Import Spectrum components
import '@swc-uxp-wrappers/utils';
import '@spectrum-web-components/theme/src/themes.js';
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons-ui/icons/sp-icon-arrow500.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-add.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-wrench.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-link.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-unlink.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-layers.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-maximize.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-rotate-c-w.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-magic-wand.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-edit.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-application-delivery.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-duplicate.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-education.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-device-phone.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-device-desktop.js';
import '@spectrum-web-components/icons-ui/src/index.js';

import '@swc-uxp-wrappers/button/sp-button.js';
import '@swc-uxp-wrappers/button-group/sp-button-group.js';
import '@swc-uxp-wrappers/checkbox/sp-checkbox.js';
import '@swc-uxp-wrappers/action-bar/sp-action-bar.js';
import '@swc-uxp-wrappers/action-button/sp-action-button.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-heading.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-item.js';
import '@swc-uxp-wrappers/switch/sp-switch.js';
import '@swc-uxp-wrappers/field-group/sp-field-group.js';
import '@swc-uxp-wrappers/field-label/sp-field-label.js';
import '@swc-uxp-wrappers/textfield/sp-textfield.js';
import '@swc-uxp-wrappers/dialog/sp-dialog.js';
import '@swc-uxp-wrappers/divider/sp-divider.js';
import '@swc-uxp-wrappers/tags/sp-tag.js';

import Editor from './editor.js';
import Builder from './builder.js';

// Configurations and Constants
import { creativeConfigs } from "./js/constants/creativeConfigs.js";
import { getPSTheme } from "./js/helpers/themeSetter.js";
import { getEl, loadManifest, logInitData } from "./js/helpers/utils.js";
import { createLogger } from './js/helpers/logger.js';

const { versions, host, storage } = require('uxp');
const { app, action } = require('photoshop');
const { arch, platform } = require('os');


const logger = createLogger({ prefix: 'Plugin', initialLevel: 'DEBUG' });

const Plugin = (() => {
    // UXP modules
    ///Eventually i'll use this component  to open files, and send the user to the studio when finished. 
    //Add file load detection, which checks the activeDocument for a number of indicators
    //which will tell it what type of creative we're working on. Then it will set mode and pull the correct
    //config schema from creativeConfigs
    const state = {
        currentMode: 'build',
        mode: 'velocity',
        sections: {
            nav: {
                element: getEl('sp-sidenav'),
                activeAttribute: 'data-active-menu',
                targetElement: getEl('.plugin-content')
            },
            production: {
            }
        },
    }
    state.creative = {...creativeConfigs.find(config => config.name === state.mode)};
    
    const handleStateChange = (newState) => {
    //const handleStateChange = (params = {panel: null, newState: null}) => {
        if(!newState) return;
        newState.type === 'creative' ? state[newState.type] = newState : state.sections[newState.type] = newState;
    }

    const {nav} = state.sections; 

    function setActiveMenu(event) {
        ///note: these are shallow changes so no spread to copy needed for now. May be needed layer if currentMode becomes a bit more comples in terms of the stuff i want
        //to store in it. 
        state.currentMode = event.target.value;
        nav.targetElement.setAttribute(nav.activeAttribute, state.currentMode);
    }
    
    async function applyTheme() {
        const themeValue = await getPSTheme();
        document.getElementById('theme').setAttribute("color", themeValue);
        return themeValue;
    }

    async function loadPluginState() {
        const manifest = await loadManifest();
        return manifest;
    }

    function documentChangeHandler(eventType, descriptor) {
        //logger.debug('documentChangeHandler', eventType, descriptor);
        if (eventType === "select") {
            const targetRef = descriptor._target?.[0]?._ref;
            if (targetRef !== "document") {
                return;
            }
        }        
        logger.debug(`Active document changed: ${app.activeDocument.name}`);
    }
    
    function watchActiveDocumentChange() {
        const events = ["select", "open", "close"];
        action.addNotificationListener(events.map(ev => ({ event: ev })), documentChangeHandler);
    }

    
    // --- Initialization ---
    const initializePanel = async () => {
        const manifest = await loadPluginState();
        const applicationTheme = await applyTheme();
        try {
            const currentPlatform = platform();
            const currentArch = arch();
            logInitData(manifest, versions, host, app.activeDocument, currentArch, currentPlatform, applicationTheme);
        } catch (error) {
            console.error('Error logging initialization data', error);
        }

        //Initialize Sections
        try {
            state.sections.editor = Editor.init(handleStateChange, state.creative);
            state.sections.builder = Builder.init(handleStateChange, state.creative);
        } catch (error) {
            console.error('Error initializing sections', error);
        }

        //Assign Event Listeners
        nav.element.addEventListener('change', setActiveMenu);
        document.theme.onUpdated.addListener(applyTheme);  
        try {
            watchActiveDocumentChange();
        } catch (error) {
            logger.error('Error watching active document change', error);
        }

        console.log("Plugin initialized", state);
    }

    return { initializePanel, state }
})();

export default Plugin;
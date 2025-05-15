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
import '@spectrum-web-components/icons-workflow/icons/sp-icon-refresh.js';

import Editor from './editor.js';
import Builder from './builder.js';
import { clearAllSnapshots } from './js/helpers/history.js';

// Configurations and Constants
import { creativeConfigs } from "./js/constants/creativeConfigs.js";
import { getPSTheme } from "./js/helpers/themeSetter.js";
import { getEl, loadManifest, logInitData, capitalizeFirstLetter } from "./js/helpers/utils.js";
import { createLogger } from './js/helpers/logger.js';

const { versions, host, storage } = require('uxp');
const { app, action } = require('photoshop');
const { arch, platform } = require('os');

const mode = 'DEBUG';

const Plugin = (() => {

    const logger = createLogger({ prefix: 'Plugin', initialLevel: mode });
    // UXP modules
    ///Eventually i'll use this component  to open files, and send the user to the studio when finished. 
    //Add file load detection, which checks the activeDocument for a number of indicators
    //which will tell it what type of creative we're working on. Then it will set mode and pull the correct
    //config schema from creativeConfigs
    const state = {
        currentMode: 'editor',
        format: 'velocity',
        currentDocument: app.activeDocument.name,
        sections: {
            nav: {
                element: getEl('sp-sidenav'),
                activeAttribute: 'data-active-menu',
                targetElement: getEl('.plugin-content')
            },
            header: {
                element: getEl('#plugin-title'),
                titleText: 'Loading...',
                help: []
            },
            production: {
            }
        },
    }
    state.creative = { ...creativeConfigs.find(config => config.name === state.format) };

    const handleStateChange = (newState) => {
        //const handleStateChange = (params = {panel: null, newState: null}) => {
        if (!newState) return;
        newState.type === 'creative' ? state[newState.type] = newState : state.sections[newState.type] = newState;
        // console.log('handleStateChange', state);
        setHeaderText(generateTitleText());
    }

    const { nav } = state.sections;

    const setActiveMenu = async (event) => {
        ///note: these are shallow changes so no spread to copy needed for now. May be needed layer if currentMode becomes a bit more comples in terms of the stuff i want
        //to store in it. 
        state.currentMode = event.target.value;
        nav.targetElement.setAttribute(nav.activeAttribute, state.currentMode);
        // setHeaderText(generateTitleText());
        logger.log('setActiveMenu', state);
        await Editor.setEditorEnabled({ enabled: state.currentMode === 'editor' ? true : false });
    }


    const applyTheme = async () => {
        const themeValue = await getPSTheme();
        document.getElementById('theme').setAttribute("color", themeValue);
        return themeValue;
    }

    const loadPluginState = async () => {
        const manifest = await loadManifest();
        return manifest;
    }


    const documentChangeHandler = (eventType, descriptor) => {
        //logger.debug('documentChangeHandler', eventType, descriptor);
        if (eventType === "select") {
            const targetRef = descriptor._target?.[0]?._ref;
            if (targetRef !== "document") {
                return;
            }
        }
        if (app.activeDocument?.name) {
            logger.debug(`Active document changed: ${app.activeDocument.name}`);
            setHeaderText(generateTitleText());
            // Builder.initHistory(app.activeDocument);
        }
    }

    const watchActiveDocumentChange = () => {
        const events = ["select", "open", "close"];
        action.addNotificationListener(events.map(ev => ({ event: ev })), documentChangeHandler);
    }

    const generateTitleText = () => {
        let sectionTitle = '';
        switch (state.currentMode) {
            case 'build':
                sectionTitle = getBuildStepTitle();
                break;
            case 'editor':
                sectionTitle = `<span style="font-weight: bold">Editing:</span> ${app.activeDocument.name}`;
                break;
            case 'production':
                sectionTitle = `<span style="font-weight: bold">Finalizing:</span> ${app.activeDocument.name}`;
                break;
            default:
                sectionTitle = 'Studio Companion: ';
        }
        //logger.debug(sectionTitle);
        return `${sectionTitle}`;
    }

    const getBuildStepTitle = () => {
        logger.debug('getBuildStepTitle', state.sections.builder?.currentStep);
        const stepNumber = state.sections.builder?.currentStep ? state.sections.builder.currentStep : 1;
        return `<span style="font-weight: bold">${capitalizeFirstLetter(state.format)}</span>: Step ${stepNumber + 1}`;//of ${state.sections.builder.buildSteps.length}`;
    }

    const setHeaderText = (text) => {
        // state.sections.header.titleText = text;
        state.sections.header.element.innerHTML = text;
        //return state.sections.header.element;
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
            const builder = await Builder.init(handleStateChange, state.creative, state.currentMode);
            logger.debug('builder initialized');
            logger.debug(builder);
            state.sections.builder = { ...builder };
            ///editor doesn't need creative state at the moment. 
            const editor = await Editor.init(handleStateChange, null, state.currentMode);
            logger.debug('editor initialized');
            logger.debug(editor);
            state.sections.editor = { ...editor };
            setHeaderText(generateTitleText());
        } catch (error) {
            logger.error('Error initializing sections', error);
        }
        //Assign Event Listeners
        nav.element.addEventListener('change', setActiveMenu);
        document.theme.onUpdated.addListener(applyTheme);
        try {
            watchActiveDocumentChange();
        } catch (error) {
            logger.error('Error watching active document change', error);
        }

        logger.debug("Plugin initialized", state);
        //mode === 'DEBUG' && await clearAllSnapshots();
    }

    getEl('#btnReload').addEventListener('click', () => location.reload());
    return { initializePanel, state }
})();

export default Plugin;
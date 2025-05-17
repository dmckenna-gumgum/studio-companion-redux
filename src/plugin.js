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

// Redux store, actions, and selectors
import store from './store/index.js';

// Import actions
import { setActiveMode, showNotification } from './store/actions/uiActions.js';
import { loadDocument, documentClosed } from './store/actions/photoshopActions.js';

// Import selectors
import { uiSelectors, photoshopSelectors } from './store/selectors/index.js';

// Components
import Editor from './editor.js';
import * as builder from './builder.js';

// Editor API instance
let editorAPI = null;

// Utilities and helpers
import { createLogger } from './js/helpers/logger.js';
import { loadManifest, logInitData } from "./js/helpers/utils.js";
import { getPSTheme } from "./js/helpers/themeSetter.js";

// Helper functions until we create domHelper.js module
function getEl(selector) {
    return document.querySelector(selector);
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// UXP modules
import { app, action, core, constants } from 'photoshop';
const { versions, host, storage } = require('uxp');
const { arch, platform } = require('os');

// Initialize logger
const logger = createLogger({ prefix: 'Plugin', initialLevel: 'DEBUG' });

/**
 * Main plugin initialization function
 * Sets up Redux store connections, initializes components,
 * and establishes event listeners
 */
export const initializePanel = async () => {
    logger.debug('Initializing Studio Companion panel - Now with Redux!');

    try {
        // Load environment information and configuration
        await initializeEnvironment();

        // Initialize component modules with Redux-integrated approach
        try {
            editorAPI = await Editor.init();
            logger.debug('Editor initialized successfully');
        } catch (error) {
            logger.error('Error initializing Editor:', error);
            // Fallback to ensure UI works without Editor
            editorAPI = { setEditorEnabled: () => { } };
        }

        try {
            const builderApi = await builder.init();
            logger.debug('Builder initialized successfully');
        } catch (error) {
            logger.error('Error initializing Builder:', error);
        }

        // Set up UI event listeners
        setupEventListeners();

        // Set up Photoshop notification listeners
        setupPhotoshopListeners();

        // Subscribe to Redux store for UI updates
        store.subscribe(handleStoreUpdates);

        // Initial UI update based on current state
        updateUI(store.getState());

        logger.debug('Panel initialization complete');
    } catch (error) {
        logger.error('Error initializing panel:', error);
        showErrorNotification('Failed to initialize plugin: ' + error.message);
    }
};

/**
 * Initializes environment information and configurations
 */
async function initializeEnvironment() {
    // Load manifest and log initialization data
    const manifest = await loadManifest();
    const applicationTheme = await applyTheme();

    try {
        const currentPlatform = platform();
        const currentArch = arch();

        // Log initialization data for debugging
        logInitData(
            manifest,
            versions,
            host,
            app.activeDocument,
            currentArch,
            currentPlatform,
            applicationTheme
        );
    } catch (error) {
        logger.error('Error logging initialization data', error);
    }
}

/**
 * Maps between Redux mode values and UI attribute values
 * @param {string} reduxMode - Redux mode value (builder, editor, production)
 * @returns {string} UI menu value (build, editor, production)
 */
function mapReduxModeToUIValue(reduxMode) {
    switch (reduxMode) {
        case 'editor': return 'editor';
        case 'builder': return 'build';
        case 'production': return 'production';
        default: return 'build';
    }
}

/**
 * Maps between UI menu values and Redux mode values
 * @param {string} uiValue - UI menu value (build, editor, production)
 * @returns {string} Redux mode value (builder, editor, production)
 */
function mapUIValueToReduxMode(uiValue) {
    switch (uiValue) {
        case 'build': return 'builder';
        case 'editor': return 'editor';
        case 'production': return 'production';
        default: return 'builder';
    }
}

/**
 * Sets up event listeners for UI elements
 */
function setupEventListeners() {
    logger.debug('Setting up event listeners');

    // Navigation mode changes using sp-sidenav
    const sidenav = document.querySelector('sp-sidenav');
    if (sidenav) {
        logger.debug('Found sidenav element, attaching event listener');

        // Handle navigation changes
        sidenav.addEventListener('change', (event) => {
            // The sidenav component automatically updates its selection
            const selectedValue = event.target.value;
            logger.debug('Sidenav change event detected, selected value:', selectedValue);

            // Map UI value to Redux state value and update store
            const mode = mapUIValueToReduxMode(selectedValue);
            logger.debug('Dispatching Redux action to update mode:', mode);
            store.dispatch(setActiveMode(mode));
        });
    } else {
        logger.error('Sidenav element not found');
    }

    // Reload button
    const reloadBtn = document.querySelector('#btnReload');
    if (reloadBtn) {
        logger.debug('Found reload button, attaching event listener');
        reloadBtn.addEventListener('click', () => {
            logger.debug('Reload button clicked');
            window.location.reload();
        });
    }

    // Theme changes
    if (document.theme && document.theme.onUpdated) {
        document.theme.onUpdated.addListener(applyTheme);
    }
}

/**
 * Sets up Photoshop notification listeners for document changes
 */
function setupPhotoshopListeners() {
    try {
        // Listen for document changes (select, open, close)
        const events = ["select", "open", "close"];
        action.addNotificationListener(
            events.map(ev => ({ event: ev })),
            handleDocumentChange
        );

        // If a document is already open, dispatch it to the store
        if (app.activeDocument) {
            store.dispatch(loadDocument(app.activeDocument));
        }
    } catch (error) {
        logger.error('Error setting up Photoshop listeners:', error);
    }
}

/**
 * Handles document change notifications from Photoshop
 */
function handleDocumentChange(eventType, descriptor) {
    logger.debug('Document change:', eventType, descriptor);

    // For select events, verify it's a document-level selection
    if (eventType === "select") {
        const targetRef = descriptor._target?.[0]?._ref;
        if (targetRef !== "document") {
            return;
        }
    }

    // Document opened or selected
    if ((eventType === "select" || eventType === "open") && app.activeDocument) {
        store.dispatch(loadDocument(app.activeDocument));
    }
    // Document closed
    else if (eventType === "close") {
        store.dispatch(documentClosed());
    }
}

// Use the existing updateContentVisibility and updateSidenavSelection functions

/**
 * Redux store subscription handler
 * Called whenever the store state changes
 */
function handleStoreUpdates() {
    const state = store.getState();
    updateUI(state);
}

/**
 * Updates the UI based on the current state
 * @param {Object} state - The current Redux state
 */
function updateUI(state) {
    logger.debug('Updating UI with state');
    // Extract relevant state
    const activeMode = uiSelectors.getActiveMode(state);
    const theme = photoshopSelectors.getTheme(state);
    const headerTitle = activeMode === 'builder' ? 'Build Assistant' :
        activeMode === 'editor' ? 'Editor' : 'Production';

    // Update content visibility based on active mode
    const uiValue = mapReduxModeToUIValue(activeMode);
    const contentContainer = document.querySelector('.plugin-content');
    if (contentContainer) {
        const currentMenu = contentContainer.getAttribute('data-active-menu');
        if (currentMenu !== uiValue) {
            contentContainer.setAttribute('data-active-menu', uiValue);
            logger.debug(`UI update: Changed data-active-menu from ${currentMenu} to ${uiValue}`);
        }
    }

    // Set document state message visibility
    const isDocumentOpen = photoshopSelectors.isDocumentOpen(state);
    const noDocumentMessage = document.getElementById('noDocumentMessage');
    if (noDocumentMessage) {
        noDocumentMessage.style.display = isDocumentOpen ? 'none' : 'block';
    }

    // Update header text
    updateHeaderText(headerTitle);

    // Update theme if needed
    const themeElement = document.getElementById('theme');
    if (themeElement) {
        themeElement.setAttribute("color", theme);
    }

    // Update operation status indicator if it exists
    const isOperationInProgress = photoshopSelectors.isOperationInProgress(state);
    const statusIndicator = document.querySelector('#operationStatus');
    if (statusIndicator) {
        statusIndicator.style.display = isOperationInProgress ? 'block' : 'none';
    }
}

/**
 * Updates the header text element with new content
 */
function updateHeaderText(text) {
    const headerElement = document.querySelector('#headerTitle');
    if (headerElement && headerElement.innerHTML !== text) {
        headerElement.innerHTML = text;
    }
}

/**
 * Applies the current Photoshop theme to the UI
 */
async function applyTheme() {
    try {
        const themeValue = await getPSTheme();
        document.getElementById('theme').setAttribute("color", themeValue);
        store.dispatch({
            type: 'SET_THEME',
            payload: themeValue
        });
        return themeValue;
    } catch (error) {
        logger.error('Error applying theme:', error);
        return 'light';
    }
}

/**
 * Shows an error notification in the UI
 */
function showErrorNotification(message) {
    store.dispatch(showNotification(message, 'error', 5000));
}
// Legacy code has been refactored into the new Redux implementation above
// This commented section is kept for reference but is not used in the current implementation
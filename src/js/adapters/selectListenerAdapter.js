// src/js/adapters/selectListenerAdapter.js
import { SelectListener } from '../services/SelectListener.js';
import store from '../../store/index.js';
import {
    selectLayers,
    updateSelection,
    toggleAutoLink
} from '../../store/actions/editorActions.js';
import { getAutoLinkEnabled } from '../../store/selectors/editorSelectors.js';
import { createLogger } from '../helpers/logger.js';

// Initialize logger
const logger = createLogger({ prefix: 'SelectListenerAdapter', initialLevel: 'DEBUG' });

/**
 * Creates a Redux-connected SelectListener adapter
 * This adapter bridges the existing SelectListener module with Redux
 * while maintaining compatibility with the UXP API requirements
 */
export const createSelectListenerAdapter = () => {
    let listener = null;

    // Redux state change handler
    const handleReduxStateChange = () => {
        const state = store.getState();
        const autoLinkEnabled = getAutoLinkEnabled(state);

        // Only update SelectListener if auto-link setting changed
        if (listener && listener.isAutoLinkEnabled() !== autoLinkEnabled) {
            logger.debug('Auto-link setting changed in Redux, updating SelectListener', { autoLinkEnabled });
            listener.setAutoLink(autoLinkEnabled);
        }
    };

    // SelectListener callback
    const handleSelectionChange = (event, selection) => {
        logger.debug('Selection changed in SelectListener, updating Redux', { selection });

        // Make sure selection object is valid before updating Redux
        if (selection && Array.isArray(selection.layers)) {
            // Update Redux store with new selection
            store.dispatch(selectLayers(selection.layers));
            store.dispatch(updateSelection({
                layers: selection.layers,
                viable: selection.viable || false,
                identical: selection.identical || false,
                sameGroup: selection.sameGroup || true,
                parentGroupCount: selection.parentGroupCount || 0,
                type: selection.type || 'layer'
            }));
        } else {
            logger.error('Invalid selection object received from SelectListener', { selection });
        }
    };

    // Create and initialize the SelectListener
    const initialize = () => {
        logger.debug('Initializing SelectListener adapter');
        const state = store.getState();

        listener = SelectListener.initialize({
            callback: handleSelectionChange,
            enableListener: true,
            autoLink: getAutoLinkEnabled(state),
            selectionFilters: null // You might want to get this from Redux state too
        });

        // Subscribe to Redux store changes
        const unsubscribe = store.subscribe(handleReduxStateChange);

        return {
            destroy: () => {
                logger.debug('Destroying SelectListener adapter');
                unsubscribe();
                if (listener) {
                    SelectListener.destroy();
                    listener = null;
                }
            },
            getListener: () => listener
        };
    };

    return { initialize };
};

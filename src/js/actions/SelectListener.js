const { app, action, constants } = require("photoshop");
const { LayerKind } = constants;
import { createLogger } from '../helpers/logger.js';
import store from '../../store/index.js';
import { selectionChanged } from '../../store/actions/selectionActions.js';

const logger = createLogger({ prefix: 'SelectListener', initialLevel: 'DEBUG' });

/**
 * SelectListener - Pure event system for Photoshop selection events
 * 
 * This module listens for Photoshop selection events and dispatches Redux actions
 * when the selection changes. It no longer maintains its own state or does processing.
 * 
 * The complete flow is:
 * 1. SelectListener detects Photoshop selection change
 * 2. It dispatches SELECTION_CHANGED action with the raw layers
 * 3. selectionMiddleware processes the selection data (viable, identical, etc.)
 * 4. selectionMiddleware dispatches SELECTION_PROCESSED with complete data
 * 5. UI components update based on Redux state changes
 */
const SelectListener = (() => {
    // Private variables
    let _enabled = false;
    let _pollingId = null;
    let _externalCallback = null; // For backward compatibility with the callback pattern

    /**
     * Handles selection change events from Photoshop
     * @param {Event} event - Photoshop selection event
     */
    const selectHandler = (event) => {
        if (_pollingId) {
            clearTimeout(_pollingId);
            _pollingId = null;
        }
        
        if (!_enabled) {
            logger.debug("(SelectListener) Selection is disabled");
            return;
        }
        
        try {
            // Get current layers from Photoshop
            const currentLayers = app.activeDocument.activeLayers || [];
            
            // Dispatch Redux action with selected layers
            store.dispatch(selectionChanged(currentLayers));
            
            // For backward compatibility with callback pattern
            if (_externalCallback && typeof _externalCallback === 'function') {
                _externalCallback({
                    type: 'editorStateUpdate',
                    selection: {
                        layers: currentLayers
                    }
                });
            }
            
            logger.debug("(SelectListener) Selection changed", { layerCount: currentLayers.length });
        } catch (error) {
            logger.error("(SelectListener) Error handling selection change", error);
        }
    };
    
    /**
     * Start polling for selection changes
     * This is a backup mechanism since the Photoshop events can be unreliable
     */
    const startPolling = (interval = 100) => {
        if (_pollingId) {
            clearTimeout(_pollingId);
        }
        
        try {
            const currentLayers = app.activeDocument.activeLayers || [];
            
            // Check if we need to handle a selection change
            if (_enabled && app.activeDocument) {
                // Dispatch same action as the event handler would
                selectHandler({ type: 'pollingCycle' });
            }
            
            // Schedule next poll
            _pollingId = setTimeout(() => startPolling(interval), interval);
        } catch (error) {
            logger.error("(SelectListener) Error in polling cycle", error);
            _pollingId = setTimeout(() => startPolling(interval), interval);
        }
    };
    
    /**
     * Stop selection polling
     */
    const stopPolling = () => {
        if (_pollingId) {
            clearTimeout(_pollingId);
            _pollingId = null;
        }
    };

    /**
     * Registers event listeners with Photoshop
     * @returns {Boolean} - Success status
     */
    const create = () => {
        try {
            action.addNotificationListener([{ event: "select" }], selectHandler);
            logger.debug("(SelectListener) Event listener registered");
            return true;
        } catch (error) {
            logger.error("(SelectListener) Failed to register event listener", error);
            return false;
        }
    };

    /**
     * Removes event listeners from Photoshop
     */
    const destroy = () => {
        try {
            stopPolling();
            action.removeNotificationListener([{ event: "select" }], selectHandler);
            logger.debug("(SelectListener) Event listener removed");
        } catch (error) {
            logger.error("(SelectListener) Failed to remove event listener", error);
        }
    };

    /**
     * Enable or disable the selection listener
     * @param {Boolean} enabled - Whether to enable selection listening
     * @returns {Object} - Status information
     */
    const setListening = (enabled) => {
        _enabled = enabled;
        
        if (_enabled) {
            // Check current selection when enabling
            try {
                if (app.activeDocument) {
                    const currentLayers = app.activeDocument.activeLayers || [];
                    if (currentLayers.length > 0) {
                        // Dispatch current selection immediately
                        store.dispatch(selectionChanged(currentLayers));
                    }
                }
                
                // Start polling as a backup mechanism
                startPolling();
                
                return { 
                    success: true, 
                    message: "(SelectListener) Listener enabled successfully"
                };
            } catch (error) {
                logger.error("(SelectListener) Error enabling listener", error);
                return { 
                    success: false, 
                    message: `Error enabling listener: ${error.message}` 
                };
            }
        } else {
            // Stop polling when disabling
            stopPolling();
            return { 
                success: true, 
                message: "(SelectListener) Listener disabled successfully"
            };
        }
    };
    
    /**
     * Set filters for selection
     * @param {RegExp|String} filters - Selection filters
     * @returns {Object} - Status information
     */
    const setSelectionFilters = (filters) => {
        // We don't manage filters directly anymore - Redux does
        // Just dispatch an action to update the filters in Redux
        store.dispatch({
            type: 'SET_FILTER',
            payload: filters
        });
        
        return { 
            success: true, 
            message: "(SelectListener) Filters updated through Redux"
        };
    };
    
    /**
     * Initialize the selection listener
     * @param {Object} options - Configuration options
     * @param {Function} options.callback - Optional callback for backward compatibility
     * @param {Boolean} options.enableListener - Whether to enable listening immediately
     * @param {Boolean} options.autoLink - Whether auto-link is enabled
     * @param {RegExp|String} options.selectionFilters - Selection filters
     * @returns {Object} - Public API for the listener
     */
    const initialize = (options = {}) => {
        logger.debug('Initializing SelectListener', options);
        
        // Store callback for backward compatibility
        _externalCallback = options.callback || null;
        
        // Register the event listener with Photoshop
        create();
        
        // Set initial state through Redux actions instead of managing internally
        if (options.enableListener) {
            setListening(true);
        }
        
        // Set auto-link through Redux
        if (options.autoLink) {
            store.dispatch({
                type: 'TOGGLE_AUTO_LINK',
                payload: true
            });
        }
        
        // Set filters through Redux
        if (options.selectionFilters) {
            store.dispatch({
                type: 'SET_FILTER',
                payload: options.selectionFilters
            });
        }
        
        // Return public API
        return {
            // Methods for external use
            setListening,
            destroy,
            
            // For compatibility with existing code
            isEnabled: () => _enabled,
            setAutoLink: (enabled) => {
                store.dispatch({
                    type: 'TOGGLE_AUTO_LINK',
                    payload: enabled
                });
                return { success: true };
            },
            setSelectionFilters
        };
    };
    
    // Public API
    return {
        initialize,
        destroy,
        setListening
    };
})();

export { SelectListener };
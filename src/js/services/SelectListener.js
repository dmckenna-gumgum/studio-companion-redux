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
        console.log('Photoshop selection event received', event || 'unknown event type');

        // Clear any pending polling timeout
        if (_pollingId) {
            clearTimeout(_pollingId);
            _pollingId = null;
        }

        // Check if selection listening is enabled
        if (!_enabled) {
            console.log("(SelectListener) Selection is disabled, ignoring event");
            return;
        }

        try {
            // Verify we have access to the Photoshop app object
            if (!app) {
                throw new Error("Photoshop app object not available");
            }

            // Verify we have an active document
            if (!app.activeDocument) {
                console.log("(SelectListener) No active document");
                console.log('No active document in Photoshop');
                return;
            }

            // Get current layers from Photoshop
            const currentLayers = app.activeDocument.activeLayers || [];
            console.log(`Selection changed: ${currentLayers.length} layers selected`);

            // For very detailed debugging
            if (currentLayers.length > 0) {
                console.log('Selected layer info:', currentLayers.map(layer => ({
                    id: layer.id,
                    name: layer.name,
                    type: layer.type,
                    visible: layer.visible
                })));
            }

            // Dispatch Redux action with selected layers
            store.dispatch(selectionChanged(currentLayers));

            // For backward compatibility with callback pattern (props down, events up)
            if (_externalCallback && typeof _externalCallback === 'function') {
                console.log('Calling external callback with selection update');
                _externalCallback({
                    type: 'editorStateUpdate',
                    selection: {
                        layers: currentLayers
                    }
                });
            } else {
                console.log('No external callback registered for selection events');
            }

            console.log("(SelectListener) Selection changed", { layerCount: currentLayers.length });

            // Schedule the next polling cycle as a fallback
            _pollingId = setTimeout(() => startPolling(100), 100);

        } catch (error) {
            console.log("(SelectListener) Error handling selection change", error);
            console.error("Error handling Photoshop selection event:", error);

            // Try to restart polling even if we hit an error
            try {
                _pollingId = setTimeout(() => startPolling(500), 500); // Use longer polling interval after error
            } catch (e) {
                // Last resort, don't let errors propagate
            }
        }
    };

    /**
     * Start polling for selection changes
     * This is a backup mechanism since the Photoshop events can be unreliable
     * @param {Number} interval - Polling interval in milliseconds
     */
    const startPolling = (interval = 100) => {
        // Clear any existing polling timeout
        if (_pollingId) {
            clearTimeout(_pollingId);
            _pollingId = null;
        }

        if (!_enabled) {
            logger.debug("(SelectListener) Polling not started because listener is disabled");
            return;
        }

        logger.debug("(SelectListener) Starting selection polling", { interval });
        console.log(`Starting Photoshop selection polling with interval: ${interval}ms`);

        const pollForChanges = () => {
            try {
                // Check if Photoshop app object is available
                if (!app) {
                    logger.warn("(SelectListener) Photoshop app object not available during polling");
                    _pollingId = setTimeout(pollForChanges, interval * 2); // Longer interval when app not available
                    return;
                }

                // Check if there's an active document
                if (!app.activeDocument) {
                    logger.debug("(SelectListener) No active document during polling");
                    _pollingId = setTimeout(pollForChanges, interval);
                    return;
                }

                // Get current selection
                const currentLayers = app.activeDocument.activeLayers || [];

                // If listener is enabled and we have an active document, process the selection
                if (_enabled) {
                    // Create a polling event and pass it to the handler
                    selectHandler({
                        type: 'pollingCycle',
                        timestamp: Date.now(),
                        layerCount: currentLayers.length
                    });
                }
            } catch (error) {
                logger.error("(SelectListener) Error in polling cycle", error);
                console.error("Polling cycle error:", error);
            }

            // Schedule next polling cycle if listener is still enabled
            if (_enabled) {
                _pollingId = setTimeout(pollForChanges, interval);
            }
        };

        // Start the polling cycle
        _pollingId = setTimeout(pollForChanges, interval);
        return true;
    };

    /**
     * Stop selection polling
     * @returns {Boolean} - Whether polling was successfully stopped
     */
    const stopPolling = () => {
        logger.debug("(SelectListener) Stopping selection polling");
        console.log("Stopping Photoshop selection polling");

        if (_pollingId) {
            clearTimeout(_pollingId);
            _pollingId = null;
            return true;
        }

        return false; // Polling wasn't running
    };

    /**
     * Registers event listeners with Photoshop
     * @returns {Boolean} - Success status
     */
    const create = () => {
        try {
            logger.debug("(SelectListener) Registering Photoshop select event listener");

            // Check if we have a valid Photoshop application context
            if (!app || !action) {
                logger.error("(SelectListener) Missing Photoshop API objects");
                return false;
            }

            // Register for the select event with Photoshop
            action.addNotificationListener([{ event: "select" }], selectHandler);

            // Start polling as a fallback mechanism
            startPolling(100);

            logger.debug("(SelectListener) Event listener and polling successfully registered");
            return true;
        } catch (error) {
            logger.error("(SelectListener) Failed to register event listener", error);
            console.error("Error registering Photoshop event listener:", error);
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
        console.log("(SelectListener) Selection listening set to:", _enabled);
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
        console.log('Initializing SelectListener with options:', options);
        logger.debug('Initializing SelectListener', options);

        // Store callback for backward compatibility with the props down, events up pattern
        _externalCallback = options.callback || null;
        console.log('External callback set:', !!_externalCallback);

        try {
            // Verify Photoshop app context is available
            if (!app) {
                const errorMsg = "Photoshop app object not available. Cannot initialize SelectListener.";
                logger.error(errorMsg);
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            // Register the event listener with Photoshop
            const listenerRegistered = create();
            console.log('Event listener registration result:', listenerRegistered);

            if (!listenerRegistered) {
                throw new Error("Failed to register Photoshop selection event listener");
            }

            // Check if we should enable listening immediately
            if (options.enableListener) {
                const listeningResult = setListening(true);
                console.log('Listening enabled result:', listeningResult);
            }

            // Set auto-link through Redux
            if (options.autoLink) {
                console.log('Setting auto-link to enabled');
                store.dispatch({
                    type: 'TOGGLE_AUTO_LINK',
                    payload: true
                });
            }

            // Set filters through Redux
            if (options.selectionFilters) {
                console.log('Setting selection filters:', options.selectionFilters);
                store.dispatch({
                    type: 'SET_FILTER',
                    payload: options.selectionFilters
                });
            }

            // Do an initial selection check if there's an active document
            try {
                if (app.activeDocument) {
                    const currentLayers = app.activeDocument.activeLayers || [];
                    if (currentLayers.length > 0) {
                        console.log('Initial selection detected, dispatching selection event');
                        // Dispatch initial selection state
                        store.dispatch(selectionChanged(currentLayers));

                        // Also call the callback for backward compatibility
                        if (_externalCallback && typeof _externalCallback === 'function') {
                            console.log('Calling external callback with initial selection');
                            _externalCallback({
                                type: 'editorStateUpdate',
                                selection: {
                                    layers: currentLayers
                                }
                            });
                        }
                    }
                }
            } catch (docErr) {
                logger.warn('Could not check initial document selection state:', docErr);
                console.warn('Initial document check failed:', docErr);
                // Non-fatal error, continue initialization
            }

            console.log('SelectListener initialization complete');

            // Return public API
            return {
                // Methods for external use
                setListening,
                destroy,

                // For compatibility with existing code
                isEnabled: () => _enabled,
                setAutoLink: (enabled) => {
                    console.log('Setting auto-link through API to:', enabled);
                    store.dispatch({
                        type: 'TOGGLE_AUTO_LINK',
                        payload: enabled
                    });
                    return { success: true };
                },
                setSelectionFilters
            };
        } catch (error) {
            logger.error('Error during SelectListener initialization:', error);
            console.error('SelectListener initialization failed:', error);

            // Return limited API that won't cause further errors
            return {
                setListening: () => ({ success: false, message: 'SelectListener failed to initialize' }),
                destroy: () => { },
                isEnabled: () => false,
                setAutoLink: () => ({ success: false }),
                setSelectionFilters: () => ({ success: false })
            };
        }
    };

    // Public API
    return {
        initialize,
        destroy,
        setListening
    };
})();

export { SelectListener };
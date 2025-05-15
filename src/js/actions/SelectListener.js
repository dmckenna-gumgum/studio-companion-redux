const { app, action, constants } = require("photoshop");
const { LayerKind } = constants;
import { createLogger } from '../helpers/logger.js';
import { LinkByArrayOfLayers, UnlinkAllLayers } from './LinkProcessor.js';
import { proxyArraysEqual, parentGroupCount, getSelectionViability, mergeUniqueById } from "../helpers/utils.js";

const logger = createLogger({ prefix: 'SelectListener', initialLevel: 'DEBUG' });

const SelectListener = (() => {
    // Private state
    const _state = {
        selection: {
            layers: [],
            viable: true,
            identical: false,
            sameGroup: true,
            parentGroupCount: 0
        },
        enabled: false,
        autoLink: false,
        linkedLayers: [],
        lastSelection: {
            layers: [],
            viable: true,
            identical: false,
            sameGroup: true,
            parentGroupCount: 0
        },
        selectionPoll: null,
        selectionFilters: null,
        listener: null,
        callback: null
    };

    // Create state handler for proxy
    const stateHandler = {
        set(target, property, value) {
            const oldValue = target[property];
            target[property] = value;

            // Add any needed state change notifications here
            // if (property === 'selection' || property === 'enabled' || property === 'autoLink') {
            //     _notifyStateChange(property, oldValue, value);
            // }

            return true;
        },
        get(target, property) {
            return target[property];
        }
    };

    // Create proxied state
    const state = new Proxy(_state, stateHandler);

    // Private methods for state changes
    const _notifyStateChange = (property, oldValue, newValue) => {
        logger.debug(`State change: ${property}`, { oldValue, newValue });
        // Additional notification logic can be added here
    };

    // Bind the selectHandler to preserve context
    const selectHandler = async (event) => {
        // logger.log("(Action Script) Select Handler", event, state.enabled);
        if (!state.enabled) {
            logger.debug("(Action Script) Select Handler: Listener disabled");
            stopSelectionPoll();
            return;
        } else {
            return await adjustSelection(event);
        }
    };

    const create = () => {
        return action.addNotificationListener([{ event: "select" }], selectHandler);
    };

    const destroy = () => {
        state.listener = null;
        action.removeNotificationListener([{ event: "select" }], selectHandler);
    };

    const startSelectionPoll = () => {
        if (!state.selectionPoll) {
            state.selectionPoll = setInterval(() => { selectHandler('select') }, 500);
        }
    };

    const stopSelectionPoll = () => {
        try {
            clearInterval(state.selectionPoll);
            state.selectionPoll = null;
            return { success: true, message: 'Selection poll stopped successfully' };
        } catch (error) {
            console.error("Error stopping selection poll:", error);
            return { success: false, message: error.message };
        }
    };

    const setListenerEnabled = async (enabled) => {
        state.enabled = enabled;
        if (state.enabled) {
            const result = await setAutoLink(false);
            return result;
        } else {
            const results = await Promise.all([
                stopSelectionPoll(),
                setAutoLink(false)
            ]);
            return results;
        }
    };

    const startAutoLink = async () => {
        logger.debug("Starting AutoLink");
        if (state.autoLink !== true) {
            state.autoLink = true;
            const result = state.selection.layers.length > 0 && await LinkByArrayOfLayers(state.selection.layers, state.lastSelection.layers, state.selectionFilters);
            return result;
        } else {
            return { success: false, message: "AutoLink is already enabled" };
        }
    };

    const stopAutoLink = async () => {
        logger.debug("Stopping AutoLink");
        if (state.autoLink !== false) {
            state.autoLink = false;
            const allLayers = mergeUniqueById(state.selection.layers, state.lastSelection.layers);
            const result = allLayers.length > 0 && await UnlinkAllLayers(allLayers);
            return { success: true, message: "AutoLink stopped successfully", result: result };
        } else {
            return { success: false, message: "AutoLink is already disabled" };
        }
    };

    const setAutoLink = async (autoLink) => {
        if (autoLink !== state.autoLink) {
            state.autoLink = autoLink;
            if (autoLink) {
                const result = await startAutoLink();
                return { success: true, message: "AutoLink started successfully", result: result };
            } else {
                const result = await stopAutoLink();
                return { success: true, message: "AutoLink stopped successfully", result: result };
            }
        } else {
            return { success: false, message: "AutoLink state is already set to " + autoLink };
        }
    };

    ///for some reason selectedFilters keeps reseting.
    const setSelectionFilters = async (filters) => {
        console.log("!Setting selection filters to", filters);
        state.selectionFilters = filters;
        await adjustSelection('select');
        return { success: true, message: "Selection filters updated successfully" };
        // if (state.autoLink) {
        //     // const unlinkResult = await UnlinkAllLayers(mergeUniqueById(state.selection.layers, state.lastSelection.layers));
        //     const linkResult = await LinkByArrayOfLayers(state.selection.layers, state.lastSelection.layers, state.selectionFilters, true);
        //     return { success: true, message: "Selection filters updated successfully", result: linkResult };
        // } else {
        //     return { success: false, message: "AutoLink is disabled, cannot update selection filters" };
        // }
    };

    const adjustSelection = async (event) => {
        console.log("Adjusting selection", state.selectionFilters);
        state.selection.layers = app.activeDocument.activeLayers;
        if (state.selection.layers.length === 0) {
            //no layers selected, reset selection state
            state.selection = {
                layers: [],
                viable: true,
                identical: false,
                sameGroup: true,
                parentGroupCount: 0
            };
            //reset last selection state as well
            state.lastSelection = {};
            //stop selection poll
            stopSelectionPoll();
            //send callback with empty selection to respond in the ui
            state.callback?.(event, state.selection);
            //if autolink is active, deselect all active layers
            try {
                const unlinkResult = state.autoLink && await UnlinkAllLayers(state.lastSelection.layers);
                state.lastSelection = {};
                logger.debug("(Action Script) Unlink Result:", unlinkResult);
                return { success: true, message: "All layers unlinked and selection reset" };
            } catch (error) {
                console.error("(Action Script) Error unlinking layers:", error);
            }
        } else {
            state.selection.identical = proxyArraysEqual(state.selection.layers, state.lastSelection.layers, state.selectionFilters);
            if (state.selection.identical === true) {
                ///already identical, do not process further
                state.lastSelection = { ...state.selection };
                return state.callback?.(event, state.selection);
            } else {
                try {
                    state.selection.viable = getSelectionViability(state.selection.layers);
                    state.selection.parentGroupCount = parentGroupCount(state.selection.layers);
                    startSelectionPoll();
                    state.callback?.(event, state.selection);
                    const linkResult = state.autoLink && await LinkByArrayOfLayers(state.selection.layers, state.lastSelection.layers, state.selectionFilters);
                    state.lastSelection = { ...state.selection };
                    logger.debug("(Action Script) Link Result:", linkResult);
                    return { success: true, message: "Selection changed successfully", result: linkResult };
                } catch (error) {
                    console.error("(Action Script) Error linking layers:", error);
                    return { success: false, message: error.message };
                }
            }
        }
    };

    // Initialize the module with options
    const initialize = (options = {}) => {
        console.log('SelectListener initialize', options);
        state.callback = options.callback || null;
        state.enabled = options.enableListener || false;
        state.autoLink = options.autoLink || false;
        state.selectionFilters = options.selectionFilters || null;
        state.listener = create();

        return {
            getSelection: () => ({ ...state.selection }),
            isEnabled: () => state.enabled,
            isAutoLinkEnabled: () => state.autoLink
        };
    };

    // Public API
    return {
        initialize,
        destroy,
        startSelectionPoll,
        stopSelectionPoll,
        setListenerEnabled,
        startAutoLink,
        stopAutoLink,
        setAutoLink,
        setSelectionFilters,
        adjustSelection
    };
})();

export { SelectListener };
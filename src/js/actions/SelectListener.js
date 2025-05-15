const { app, action, constants } = require("photoshop");
const { LayerKind } = constants;
import { createLogger } from '../helpers/logger.js';
import { LinkByArrayOfLayers, UnlinkAllLayers } from './LinkProcessor.js';
import { sameIdSet, parentGroupCount, getSelectionViability, mergeUniqueById, diffArraysByIds } from "../helpers/utils.js";

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
        stopSelectionPoll();
        state.selection.layers = app.activeDocument.activeLayers;
        state.selection.identical = state.lastSelection.layers.length > 0 ? sameIdSet(state.selection.layers, state.lastSelection.layers) : false;
        if (!state.enabled) {
            logger.debug("(Action Script) Select Handler: Listener disabled");
            return;
        }
        if (state.selection.identical) {
            return;
        } else {
            return await selectionProcessor(event, 'selectHandler');
        }
    };

    const create = () => {
        const listener = action.addNotificationListener([{ event: "select" }], selectHandler);
        logger.info("SelectListener created", listener);
        return listener;
    };

    const destroy = () => {
        state.listener = null;
        action.removeNotificationListener([{ event: "select" }], selectionProcessor);
    };

    const startSelectionPoll = () => {
        state.selection.layers = app.activeDocument.activeLayers;
        state.selection.identical = state.lastSelection.layers.length > 0 ? sameIdSet(state.selection.layers, state.lastSelection.layers) : false;
        if (state.selection.identical === true) {
            ///if they're still identical, don't process anything
            console.log('filtering due to identical selection')
            state.selectionPoll = setTimeout(startSelectionPoll, 500);
        } else {
            ///if they're not identical, process the selection
            state.selectionPoll = setTimeout(() => { selectionProcessor('select', 'pollingCycle') }, 500);
        }
    };

    const stopSelectionPoll = () => {
        try {
            clearTimeout(state.selectionPoll);
            return { success: true, message: 'Selection poll stopped successfully' };
        } catch (error) {
            console.error("Error stopping selection poll:", error);
            return { success: false, message: error.message };
        }
    };

    const setListening = async (enabled) => {
        state.enabled = enabled;
        logger.info("setListening", state.enabled);
        if (state.enabled) {
            const result = setAutoLink(false);
            return { success: true, message: "Selection listener enabled successfully", listening: state.enabled, listener: state.listener, autoLinkStatus: result };
        } else {
            stopSelectionPoll();
            setAutoLink(false);
            return { success: true, message: "Selection listener disabled successfully", listening: state.enabled, listener: state.listener, autoLinkStatus: true };
        }
    };

    const startAutoLink = () => {
        logger.debug("Starting AutoLink");
        if (state.autoLink !== true) {
            state.autoLink = true;
            state.selection.identical = false;
            state.enabled && selectionProcessor('select', 'autolinkEnabled');
            return true;
        } else {
            return false;
        }
    };

    const stopAutoLink = () => {
        logger.debug("Stopping AutoLink");
        if (state.autoLink !== false) {
            state.autoLink = false;
            state.enabled && selectionProcessor('select', 'autolinkDisabled');
            return false;
        } else {
            return true;
        }
    };

    const setAutoLink = (autoLink) => {
        state.selection.layers = app.activeDocument.activeLayers;
        if (autoLink !== state.autoLink) {
            if (autoLink) {
                return { success: startAutoLink(autoLink), message: "AutoLink started successfully" };
            } else {
                return { success: stopAutoLink(autoLink), message: "AutoLink stopped successfully" };
            }
        } else {
            return { success: true, message: "AutoLink state is already set to " + autoLink };
        }
    };

    ///for some reason selectedFilters keeps reseting.
    const setSelectionFilters = async (filters) => {
        // console.log("!Setting selection filters to", filters);
        stopSelectionPoll();
        state.selectionFilters = filters;
        state.selection.identical = false;
        ///i know this is async, but i don't want to wait for it to finish and the editor.js doesn't need that info anyway.
        state.enabled && selectionProcessor('select', 'filterChange');
        return { success: true, message: "Selection filters updated successfully" };
    };

    const handleDeselect = () => {
        //no layers selected, reset selection state

        console.log("(Action Script) Selection Processor: No layers selected");
        state.lastSelection = { ...state.selection };
        state.selection = {
            layers: [],
            viable: true,
            identical: false,
            sameGroup: true,
            parentGroupCount: 0
        };
        stopSelectionPoll();
        state.callback?.(state.selection);
        try {
            //const unlinkResult = state.autoLink && await UnlinkAllLayers(state.lastSelection.layers);
            //logger.debug("(Action Script) Unlink Result:", unlinkResult);
            return { success: true, message: "All layers unlinked and selection reset" };
        } catch (error) {
            console.error("(Action Script) Error unlinking layers:", error);
        }
    }

    const handleSelectionFeedback = () => {
        state.lastSelection = { ...state.selection };
        return state.callback?.(state.selection);
    }

    const selectionProcessor = async (event, trigger = 'selectHandler') => {
        console.log("(Action Script) Selection Processor", event, trigger);
        if (state.selection.layers.length === 0) {
            handleDeselect();
        } else {
            try {
                state.selection.viable = getSelectionViability(state.selection.layers);
                state.selection.parentGroupCount = parentGroupCount(state.selection.layers);
                state.selection.identical = state.lastSelection.layers.length > 0 ? sameIdSet(state.selection.layers, state.lastSelection.layers) : false; //proxyArraysEqual(state.selection.layers, state.lastSelection.layers);
                const { onlyA: newLayers, onlyB: unselectedLayers, both: existingLayers } = diffArraysByIds(state.selection.layers, state.lastSelection.layers);
                console.log('results of diff', { new: newLayers, old: unselectedLayers, same: existingLayers });
                const linkResult = state.autoLink ? await LinkByArrayOfLayers(newLayers, unselectedLayers, existingLayers, state.selectionFilters) : false;
                handleSelectionFeedback();
                startSelectionPoll();
                return { success: true, message: "Selection changed successfully", linkResult: `Linked Layers: ${linkResult}` };
                //logger.debug("(Action Script) Link Result:", linkResult);
                //return { success: true, message: "Selection changed successfully", result: linkResult };
            } catch (error) {
                // console.error("(Action Script) Error linking layers:", error);
                return { success: false, message: error.message };
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
            isAutoLinkEnabled: () => state.autoLink,
            setListening,
            setAutoLink,
            setSelectionFilters
        };
    };

    // Public API
    return {
        initialize,
        destroy,
        startSelectionPoll,
        stopSelectionPoll,
        setListening,
        startAutoLink,
        stopAutoLink,
        setAutoLink,
        setSelectionFilters,
        selectionProcessor
    };
})();

export { SelectListener };
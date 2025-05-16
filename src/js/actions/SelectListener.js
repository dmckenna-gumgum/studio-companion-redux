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
            identical: true,
            sameGroup: true,
            parentGroupCount: 0
        },
        enabled: false,
        autoLink: false,
        linkedLayers: [],
        lastSelection: {
            layers: [],
            viable: true,
            identical: true,
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
        logger.debug(`(SelectListener) State change: ${property}`, { oldValue, newValue });
        // Additional notification logic can be added here
    };

    // Bind the selectHandler to preserve context
    const selectHandler = async (event) => {
        stopSelectionPoll();
        state.selection.layers = app.activeDocument.activeLayers;
        state.selection.identical = state.lastSelection.layers.length > 0 ? sameIdSet(state.selection.layers, state.lastSelection.layers) : false;
        //return !state.selection.identical ?
        return state.enabled ? await selectionProcessor(event, 'selectHandler') :
            console.log("(SelectListener) Selection is disabled");
    };

    const create = () => {
        action.addNotificationListener([{ event: "select" }], selectHandler);
        return true;
    };

    const destroy = () => {
        state.listener = null;
        action.removeNotificationListener([{ event: "select" }], selectHandler);
    };

    const startSelectionPoll = () => {
        state.selection.layers = app.activeDocument.activeLayers;
        state.selection.identical = state.lastSelection.layers.length > 0 ? sameIdSet(state.selection.layers, state.lastSelection.layers) : true;
        state.selection.identical === true ?
            state.selectionPoll = setTimeout(startSelectionPoll, 500) :
            ///if they're not identical, process the selection
            state.selectionPoll = setTimeout(() => { selectionProcessor('select', 'pollingCycle') }, 500);
    };

    const stopSelectionPoll = () => {
        clearTimeout(state.selectionPoll);
    };

    const setListening = async (enabled) => {
        state.enabled = enabled;
        if (state.enabled) {
            const result = setAutoLink(false);
            return { success: true, message: "(SelectListener) Listener enabled successfully", listening: state.enabled, listener: state.listener, autoLinkStatus: result };
        } else {
            stopSelectionPoll();
            setAutoLink(false);
            return { success: true, message: "(SelectListener) Listener disabled successfully", listening: state.enabled, listener: state.listener, autoLinkStatus: true };
        }
    };

    const startAutoLink = () => {
        if (state.autoLink !== true) {
            stopSelectionPoll();
            state.autoLink = true;
            state.selection.identical = false;
            state.enabled && selectionProcessor('select', 'autolinkEnabled');
            return true;
        } else {
            return false;
        }
    };

    const stopAutoLink = async () => {
        if (state.autoLink !== false) {
            state.autoLink = false;
            state.enabled && selectionProcessor('select', 'autolinkDisabled');
            const unlinkResult = await UnlinkAllLayers(state.lastSelection.layers);
            return { success: true, message: "(SelectListener) AutoLink stopped successfully", unlinkResult: unlinkResult };
        } else {
            return { success: true, message: "(SelectListener) AutoLink was already stopped" };
        }
    };

    const setAutoLink = (autoLink) => {
        state.selection.layers = app.activeDocument.activeLayers;
        if (autoLink !== state.autoLink) {
            if (autoLink) {
                return { success: startAutoLink(autoLink), message: "(SelectListener) AutoLink started successfully" };
            } else {
                return { success: stopAutoLink(autoLink), message: "(SelectListener) AutoLink stopped successfully" };
            }
        } else {
            return { success: true, message: "(SelectListener) AutoLink state is already set to " + autoLink };
        }
    };

    ///for some reason selectedFilters keeps reseting.
    const setSelectionFilters = (filters) => {
        // console.log("!Setting selection filters to", filters);
        stopSelectionPoll();
        state.selectionFilters = filters;
        state.selection.identical = false;
        ///i know this is async, but i don't want to wait for it to finish and the editor.js doesn't need that info anyway.
        state.enabled && state.autoLink && selectionProcessor('select', 'filterChange');
        return { success: true, message: `(SelectListener) Selection filters updated successfully: ${state.selectionFilters}` };
    };

    const handleDeselect = async () => {
        //no layers selected, reset selection state
        state.selection = {
            layers: [],
            viable: true,
            identical: false,
            sameGroup: true,
            parentGroupCount: 0
        };
        state.callback?.(state.selection);
        stopSelectionPoll();
        try {
            const unlinkResult = state.autoLink ? await UnlinkAllLayers(state.lastSelection.layers) : false;
            console.log("(SelectListener) Unlink Result:", unlinkResult);
            state.lastSelection = { ...state.selection };
            return { success: true, message: "(SelectListener) All layers unlinked and selection reset" };
        } catch (error) {
            console.error("(SelectListener) Error unlinking layers:", error);
            return { success: false, message: error.message };
        }
    }

    const handleSelectionFeedback = () => {
        return state.callback?.(state.selection);
    }

    const selectionProcessor = async (event, trigger = 'selectHandler') => {
        console.log("\n\n\n");
        console.log("(SelectListener) Selection Processor Triggered by: ", trigger);
        if (state.selection.layers.length === 0) {
            handleDeselect();
        } else {
            try {
                state.selection.viable = getSelectionViability(state.selection.layers);
                state.selection.parentGroupCount = parentGroupCount(state.selection.layers);
                //state.selection.identical = state.lastSelection.layers.length > 0 ? sameIdSet(state.selection.layers, state.lastSelection.layers) : true;
                handleSelectionFeedback();
                ///if autolink is on and selectiopn is viable.
                if (state.autoLink && state.selection.viable) {
                    try {
                        const { onlyA: newLayers, onlyB: unselectedLayers, both: existingLayers } = trigger !== 'filterChange' && trigger != 'autolinkEnabled' ?
                            diffArraysByIds(state.selection.layers, state.lastSelection.layers) :
                            { onlyA: [], onlyB: [], both: state.selection.layers };
                        // console.log("\n\n\n");
                        // console.log("(SelectListener) Selection Processor Triggered by: ", trigger);
                        // console.log("(SelectListener) New Layers:", newLayers);
                        // console.log("(SelectListener) Unselected Layers:", unselectedLayers);
                        // console.log("(SelectListener) Existing Layers:", existingLayers);
                        // console.log("\n\n\n");
                        ///don't engage in autolinking if the feature is disabled, or if the selection has artboards and layers in it//
                        const linkResult = await LinkByArrayOfLayers(newLayers, unselectedLayers, existingLayers, state.selectionFilters);
                        state.lastSelection = { ...state.selection };
                        startSelectionPoll();
                        const result = { success: true, message: "(SelectListener) Selection changed successfully", result: linkResult };
                        console.log("(SelectListener) Selection Processor Result:", result);
                        return result;
                    } catch (error) {
                        startSelectionPoll();
                        const result = { success: false, message: error.message };
                        console.log("(SelectListener) Selection Processor Error:", result);
                        return result;
                    }
                } else {
                    state.lastSelection = { ...state.selection };
                    startSelectionPoll();
                    return { success: true, message: "(SelectListener) Selection changed successfully" };
                }
            } catch (error) {
                console.error("(SelectListener) Error processing selection:", error);
                return { success: false, message: error.message };
            }
        }
    };

    // Initialize the module with options
    const initialize = (options = {}) => {
        console.log('SelectListener initialized', options);
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
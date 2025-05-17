// Assistant Step Actions
import { getEl, restoreFocus, mergeArraysByKey, pickProps } from "./js/helpers/utils.js";
import { normalizeAndPropagateRestStates } from "./js/buildActions/propagateRestState.js";
import { propagateToIntro } from "./js/buildActions/propagateToIntro.js";
import { revealAndPropagateToRestState } from "./js/buildActions/revealAndPropagateToRestState.js";
import { readyPositioningForIntros } from "./js/buildActions/readyPositioningForIntros.js";
import { createLogger } from './js/helpers/logger.js';
import History from './js/helpers/history.js';
import { app, core } from "photoshop";

// Redux imports
import store from './store/index.js';
import {
    setBuildStep,
    incrementStep,
    decrementStep,
    updateCreative,
    addToHistory,
    restoreHistoryState
} from './store/actions/builderActions.js';
import { executePhotoshopOperation } from './store/actions/photoshopActions.js';
import { showNotification } from './store/actions/uiActions.js';

// Initialize logger
const logger = createLogger({ prefix: 'Builder', initialLevel: 'DEBUG' });

/**
 * Initialize the Builder module
 * @param {Object} config - Configuration options
 * @returns {Object} - Builder API
 */
export const init = async (config = {}) => {
    logger.debug('Initializing Builder with Redux');
    
    // Initialize UI elements
    setupUIEventListeners();
    
    // If a document is open, check for creative history
    if (app.activeDocument) {
        initHistory();
    }
    
    // Subscribe to Redux store changes
    const unsubscribe = store.subscribe(() => {
        updateBuilderUI(store.getState().builder);
    });
    
    // Initial UI update
    updateBuilderUI(store.getState().builder);
    
    // Return API
    return {
        destroy: () => {
            logger.debug('Destroying Builder');
            unsubscribe();
            // Clean up event listeners and resources
        }
    };
};

/**
 * Set up event listeners for Builder UI elements
 */
function setupUIEventListeners() {
    logger.debug('Setting up Builder UI event listeners');
    
    // Next step button
    const nextBtn = getEl('#btnNext');
    if (nextBtn) {
        logger.debug('Found Next button, adding event listener');
        nextBtn.addEventListener('click', () => {
            logger.debug('Next button clicked');
            store.dispatch(incrementStep());
        });
    } else {
        logger.warn('Next button not found');
    }
    
    // Previous step button
    const prevBtn = getEl('#btnPrev');
    if (prevBtn) {
        logger.debug('Found Previous button, adding event listener');
        prevBtn.addEventListener('click', () => {
            logger.debug('Previous button clicked');
            store.dispatch(decrementStep());
        });
    } else {
        logger.warn('Previous button not found');
    }
    
    // Add step button
    const addStepBtn = getEl('#btnAddStep');
    if (addStepBtn) {
        addStepBtn.addEventListener('click', () => {
            logger.debug('Add step button clicked');
            // Here we would dispatch an action to add a custom step
            store.dispatch(showNotification('Adding custom step functionality is coming soon!'));
        });
    }
    
    // History buttons container is set up dynamically in updateHistoryButtons
}

/**
 * Update the Builder UI based on Redux state
 * @param {Object} builderState - Builder state from Redux
 */
function updateBuilderUI(builderState) {
    logger.debug('Updating Builder UI with state:', builderState);
    
    if (!builderState) {
        logger.error('Builder state is undefined');
        return;
    }
    
    const { currentStep, buildSteps, creative, history } = builderState;
    
    // Skip UI updates if no build steps defined
    if (!buildSteps || buildSteps.length === 0) {
        logger.warn('No build steps available');
        return;
    }
    
    // Update step counter and description
    const stepNumber = getEl('.plugin-step-number');
    const stepName = getEl('.plugin-step-name');
    const stepText = getEl('.plugin-step-text');
    
    if (stepNumber && currentStep !== undefined) {
        stepNumber.textContent = `Step ${currentStep + 1}:`;
    }
    
    // Update step name and description
    const buildStep = buildSteps[currentStep];
    if (buildStep) {
        if (stepName) {
            stepName.textContent = buildStep.name || 'Unknown Step';
        }
        
        if (stepText) {
            stepText.textContent = buildStep.description || '';
        }
        
        // Update progress bar
        const progressBar = getEl('.plugin-progress-bar-fill');
        if (progressBar) {
            const progressPercentage = ((currentStep + 1) / buildSteps.length) * 100;
            progressBar.style.width = `${progressPercentage}%`;
        }
    }
    
    // Update history buttons
    updateHistoryButtons(history);
    
    // Update nav buttons enabled/disabled state
    const prevButton = getEl('#btnPrev');
    const nextButton = getEl('#btnNext');
    
    if (prevButton) {
        prevButton.disabled = currentStep <= 0;
    }
    
    if (nextButton) {
        nextButton.disabled = currentStep >= buildSteps.length - 1;
    }
}

/**
 * Update history buttons based on available history entries
 * @param {Array} history - History entries from Redux state
 */
function updateHistoryButtons(history) {
    const historyContainer = getEl('#buildHistoryButtons');
    if (!historyContainer) return;
    
    // Clear existing buttons
    historyContainer.innerHTML = '';
    
    if (!history || history.length === 0) {
        // Hide history section if no history
        const historySection = getEl('#buildHistory');
        if (historySection) {
            historySection.style.display = 'none';
        }
        return;
    }
    
    // Show history section
    const historySection = getEl('#buildHistory');
    if (historySection) {
        historySection.style.display = 'flex';
    }
    
    // Add history buttons (limited to last 5 entries to avoid cluttering UI)
    const entriesToShow = history.slice(-5);
    
    entriesToShow.forEach((entry, index) => {
        const button = document.createElement('sp-button');
        button.setAttribute('size', 's');
        button.textContent = `${entry.stepNumber}`;
        button.dataset.historyIndex = index;
        
        button.addEventListener('click', () => {
            store.dispatch(restoreHistoryState(entry.historyIndex));
        });
        
        historyContainer.appendChild(button);
    });
}

/**
 * Update the history UI based on available history items
 * @param {Array} history - History items array
 */
function updateHistoryUI(history) {
    const historyContainer = getEl('#historyContainer');
    if (!historyContainer) return;
    
    // Clear existing history items
    historyContainer.innerHTML = '';
    
    // Show/hide history container based on history availability
    if (history && history.length > 0) {
        historyContainer.style.display = 'block';
        
        // Create history item buttons
        history.forEach((item, index) => {
            const historyBtn = document.createElement('sp-button');
            historyBtn.setAttribute('variant', 'secondary');
            historyBtn.setAttribute('size', 'S');
            historyBtn.setAttribute('data-snapshot', item.name);
            historyBtn.setAttribute('data-step', item.step);
            historyBtn.textContent = `Step ${item.step + 1}: ${item.name}`;
            
            historyBtn.addEventListener('click', () => {
                handleHistoryRevert(index);
            });
            
            historyContainer.appendChild(historyBtn);
        });
    } else {
        historyContainer.style.display = 'none';
    }
}

/**
 * Handle history revert action
 * @param {Number} historyIndex - Index of history item to revert to
 */
async function handleHistoryRevert(historyIndex) {
    try {
        // Dispatch action to revert to this history state
        store.dispatch(restoreHistoryState(historyIndex));
        
        // Attempt to restore Photoshop document state
        const history = store.getState().builder.history[historyIndex];
        if (history) {
            await History.restore(history.name);
            
            store.dispatch(showNotification(
                `Reverted to Step ${history.step + 1}`, 
                'success', 
                3000
            ));
        }
    } catch (error) {
        logger.error('Error reverting to history state', error);
        store.dispatch(showNotification(
            `Error reverting to snapshot: ${error.message}`, 
            'error', 
            5000
        ));
    }
}

/**
 * Initialize history from document snapshots
 */
async function initHistory() {
    try {
        const snapshots = await History.getAllSnapshots();
        
        if (snapshots && snapshots.length > 0) {
            // For each snapshot, add to Redux store history
            snapshots.forEach(snapshot => {
                const { name, stepNumber, historyState } = snapshot;
                
                store.dispatch(addToHistory(
                    name,
                    parseInt(stepNumber, 10),
                    historyState
                ));
            });
            
            logger.debug('History initialized with snapshots', snapshots.length);
        } else {
            logger.debug('No snapshots found');
        }
    } catch (error) {
        logger.error('Error initializing history', error);
    }
}

/**
 * Save current document state to history
 */
async function saveSnapshot() {
    try {
        const currentStep = store.getState().builder.currentStep;
        const snapshotName = `Step_${currentStep}`;
        
        // Create Photoshop snapshot
        const historyState = await History.capture(snapshotName);
        
        // Add to Redux store
        store.dispatch(addToHistory(
            snapshotName,
            currentStep,
            historyState
        ));
        
        logger.debug('Snapshot saved', snapshotName);
        return true;
    } catch (error) {
        logger.error('Error saving snapshot', error);
        store.dispatch(showNotification(
            `Error saving snapshot: ${error.message}`, 
            'error', 
            5000
        ));
        return false;
    }
}

/**
 * Clear all snapshots from history
 */
async function clearSnapshots() {
    try {
        await History.clear();
        // Create a new empty history array in Redux
        store.dispatch({ type: 'CLEAR_HISTORY' });
        
        logger.debug('All snapshots cleared');
        return true;
    } catch (error) {
        logger.error('Error clearing snapshots', error);
        return false;
    }
}

/**
 * Execute a build step action
 * @param {Object} action - The action to execute
 * @param {Object} state - Current state to pass to the action
 * @returns {Array} - Array of result objects
 */
async function executeStepAction(action, state) {
    const { functions = [] } = action;
    
    // If there are no functions, return a single "success" result
    if (functions.length === 0) {
        return [{ success: true, message: 'No functions to execute' }];
    }
    
    // Execute each function in sequence, passing results to the next
    const finalResults = await functions.reduce(
        async (resultPromise, func) => {
            const resultsSoFar = await resultPromise;
            
            try {
                // Execute the function
                const result = await func.doIt(func.options, state);
                
                // Add result to the list
                return [...resultsSoFar, { 
                    success: true, 
                    message: `${func.id} completed successfully`, 
                    payload: result 
                }];
            } catch (error) {
                // Add error to the list
                logger.error(`Function ${func.id} failed`, error);
                return [...resultsSoFar, { 
                    success: false, 
                    message: error.message || `Function ${func.id} failed` 
                }];
            }
        },
        Promise.resolve([])  // initial "resultsSoFar" is []
    );
    
    logger.debug('Build Action Results:', finalResults);
    return finalResults;
}

// Export the Redux-integrated Builder module
export default {
    init,
    saveSnapshot,
    clearSnapshots,
    executeStepAction,
    updateBuilderUI,
    handleHistoryRevert,
    initHistory
};
/*
let _onUpdateCallback = null;
const Builder = (() => {
    const logger = createLogger({ prefix: 'Builder', initialLevel: 'DEBUG' });

    const _eventListeners = [];
    const registerEventListener = (eventConfig = {}) => {
        eventConfig.eventHandler = async (e) => eventConfig.handlerFunc(e, eventConfig);
        eventConfig.listener = eventConfig.element.addEventListener(eventConfig.eventType, eventConfig.eventHandler);
        _eventListeners.push(eventConfig);
    }

    const destroyEventListener = (eventListener) => {
        if (!eventListener.element || !eventListener.event || !eventListener.handlerFunc) return;
        eventListener.element.removeEventListener(eventListener.event, eventListener.eventHandler);
        _eventListeners.splice(_eventListeners.indexOf(eventListener), 1);
    }
    //////everything here needs to be sorted into the plugin object eventually
    const legacyBuilderState = {
        introSteps: {
            desktop: 0,
            mobile: 0,
        }
    }

    const getIntroSteps = (device) => {
        ///these are temporary until i'm properly pushing created intro boards into the config above, then i can use length of those arrays rather than a separate number 
        return legacyBuilderState.introSteps[device];
    }

    const setIntroSteps = (device, step) => {
        ///these are temporary until i'm properly pushing created intro boards into the config above, then i can use length of those arrays rather than a separate number 
        // logger.debug('setIntroSteps', device, step);
        return legacyBuilderState.introSteps[device] = step;
    }

    const setBuildStep = (step) => {
        return state.currentStep = step;
    }

    const getBuildStepNumber = () => {
        return state.currentStep;
    }

    const getBuildStep = () => {
        return state.buildSteps[getBuildStepNumber()];
    }


    //////////////////////////////////////
    ////////////BUILD ACTIONS/////////////
    //////////////////////////////////////
    const runStep = async (event, config) => {

        ///before running step capture a snapshot of the current state;
        try {
            config.options[0] === 'next' && await saveSnapshot();
        } catch (error) {
            logger.error('snapshot error', error);
        }

        logger.debug('runStep', config);
        const currentStep = getBuildStepNumber();
        logger.debug('currentStep', currentStep);
        const buildStep = getBuildStep();
        logger.debug('buildStep', buildStep);
        const action = config.options[0] === 'next' ? buildStep.nextAction : buildStep.action;
        logger.debug('action', action);
        // const creativeSections = creativeState.devices.filter(item => action.device.includes(item.device));
        logger.debug('state pre-send', creativeState)
        const stateToPass = pickProps(creativeState.devices, action.device);
        logger.debug('runStep', action, stateToPass);
        try {
            const results = await executeStepAction(action, stateToPass);
            logger.log('runStep results', results);
            if (results.every(result => result.success)) {
                logger.log('runStep success');
                results.forEach((result) => {
                    action.callbacks?.forEach(callback => callback?.(action, result));
                });
                restoreFocus();
            } else {
                logger.log(results.find(result => !result.success).message);
            }
        } catch (error) {
            logger.error(error);
            // await core.showAlert(`Error ${builder.buildSteps[currentStep].name}: ${error}`);
        }
    }

    const executeStepAction = async (action, stateToPass) => {
        const { functions = [] } = action;

        // If there are no functions, return a single “success” result
        if (functions.length === 0) {
            return [{ success: true, message: "No functions to execute." }];
        }

        // We start with a Promise that resolves to an empty array of results
        const finalResults = await functions.reduce(
            async (previousPromise, { doIt, options }) => {

                // wait for the array of results so far
                const resultsSoFar = await previousPromise;

                // now run the next function
                const result = await doIt(action, stateToPass, options);
                logger.log(`Build Action Result: ${result.message}`);
                // (handle throws inside here if you want, pushing a failure object)

                // push it onto the array
                resultsSoFar.push(result);

                // return the updated array for the next iteration
                return resultsSoFar;
            },
            Promise.resolve([])  // initial “resultsSoFar” is []
        );

        logger.log(`Build Action Results:`, finalResults);
        return finalResults;   // this is an array of all { success, message } objects
    }

    const updateArtboardState = (action, result) => {
        logger.log(`${action.name} Completed. Updating Creative State With:`, result.payload);
        if (!result.payload || !creativeState.devices) return;
        creativeState.devices = { ...creativeState.devices, ...result.payload.devices }
        logger.log('creativeState', creativeState);
        //mergeArraysByKey(creativeState.devices, result.payload, 'device');
    }

    const incrementSubStep = (action, results) => {
        // buildStep.options[1] = setIntroSteps(buildStep.device, getIntroSteps(buildStep.device)+1);
        const introSteps = setIntroSteps(action.device, getIntroSteps(action.device) + 1);
        //logger.debug(`DEBUG:${action.device} Intro Sequence Now Has ${introSteps} Steps`);
    }

    const incrementStep = (action) => {
        const currentStep = setBuildStep(Math.min(getBuildStepNumber() + 1, state.buildSteps.length - 1));
        const buildStep = getBuildStep();
        //console.log(`DEBUG: Incrementing To Main Step: ${currentStep+1}, named: ${buildStep.name}`); 
        updateBuildInterface(buildStep);

    }

    const saveSnapshot = async () => {
        try {
            const stepNumber = getBuildStepNumber();
            const snapShotName = `Step_${stepNumber}`;
            const historyState = await History.capture(snapShotName);
            state.buildHistory.history.push(createHistoryEntry(snapShotName, stepNumber, historyState));
            updateHistoryUI();
        } catch (error) {
            return error;
        }
    }

    const updateHistoryUI = () => {
        if (state.buildHistory.history.length > 0) {
            state.buildHistory.containerEl.classList.add('-show');
        } else {
            state.buildHistory.containerEl.classList.remove('-show');
        }
    }

    const initHistory = async () => {
        const snapshots = await getSnapshots();
        if (snapshots && snapshots.length > 0) {
            // logger.info('initHistory', snapshots);
            state.buildHistory.history = [];
            state.buildHistory.buttonGroup.innerHTML = '';
            try {
                state.buildHistory.history = snapshots.map((snapshot, index) => {
                    // logger.log('entry', snapshot, index);
                    return createHistoryEntry(snapshot.name, index, snapshot);
                });
                updateHistoryUI();
                const mostRecent = state.buildHistory.history[state.buildHistory.history.length - 1];
                const results = 'hello'//await revertToSnapshot(mostRecent.snapshotName, mostRecent.stepNumber - 1);
                logger.log('initHistory', results);
                return results;
            } catch (error) {
                logger.error('initHistory', error);
            }
        } else {
            logger.info('No snapshots found');
            return null;
        }
    }

    const getSnapshots = async () => {
        return await History.getAllSnapshots();
    }

    const createHistoryEntry = (snapShotName, stepNumber, historyState) => {
        try {
            logger.log('createHistoryEntry', snapShotName, stepNumber, historyState);
            const newHistoryEntry = {};
            newHistoryEntry.stepNumber = stepNumber;
            newHistoryEntry.snapshotName = snapShotName;
            newHistoryEntry.historyState = historyState;
            const btnMarkup = document.createElement(`sp-button`);
            btnMarkup.classList.add('plugin-history-btn');
            btnMarkup.id = `historyBtn_${stepNumber}`;
            btnMarkup.textContent = `${stepNumber + 1}`;
            btnMarkup.setAttribute('data-step', stepNumber);
            btnMarkup.setAttribute('size', 's');
            btnMarkup.setAttribute('treatment', 'outline');
            btnMarkup.setAttribute('variant', 'secondary');
            btnMarkup.setAttribute('data-snapshot', snapShotName);
            newHistoryEntry.buttonEl = state.buildHistory.buttonGroup.appendChild(btnMarkup);
            const eventObj = {
                eventName: `HistoryStep_${stepNumber}`,
                eventType: 'click',
                name: `HistoryStep_${stepNumber}`,
                description: `Revert History to Step ${stepNumber}`,
                actionReturns: null,
                action: revertToSnapshot,
                options: [snapShotName, stepNumber],
                element: newHistoryEntry.buttonEl,
                elementId: `historyBtn_${stepNumber}`,
                handlerFunc: revertHandler
            }
            registerEventListener(eventObj);
            return newHistoryEntry;
        } catch (error) {
            return error;
        }
    }

    const clearSnapshots = () => {
        History.clear();
    }
    const revertHandler = async (event, config) => {
        // logger.log('revertHandler', event, config);
        const snapshotName = event.target.getAttribute('data-snapshot');
        const stepNumber = Math.max(0, event.target.getAttribute('data-step'));
        logger.log('revertHandler', snapshotName, stepNumber);
        const result = await revertToSnapshot(snapshotName, stepNumber);
        return result;
    }
    const revertToSnapshot = async (snapshotName, stepNumber) => {
        // logger.log('revertToSnapshot', snapshotName, stepNumber);
        setBuildStep(stepNumber);
        updateBuildInterface(stepNumber);
        const result = await History.restore(snapshotName);
        return result;
    }

    const updateBuildInterface = (buildStep) => {
        const currentStep = getBuildStepNumber();
        if (!buildStep) {
            buildStep = getBuildStep(currentStep);
        }
        logger.log('updateBuildInterface', currentStep, buildStep)
        state.infoElements.stepNumber.textContent = `Step ${currentStep + 1}:`;
        state.infoElements.stepName.textContent = buildStep.name;
        state.infoElements.stepText.textContent = buildStep.directions;
        const progressWidth = Math.max(5, currentStep / (state.buildSteps.length - 1) * 100);
        state.infoElements.progressBarFill.style.width = `${progressWidth}%`;
        if (currentStep === 4) {
            // state.infoElements.nextButton.textContent = 'Finish';
        }
        if (buildStep.action !== null) {
            state.infoElements.subUi.classList.add('-show');
        } else {
            state.infoElements.subUi.classList.remove('-show');
        }
    }



    const _state = {
        type: 'builder',
        element: getEl('#build-menu'),
        currentStep: 0,
        buttonsActive: false,
        buildHistory: {
            containerEl: getEl('#buildHistory'),
            buttonGroup: getEl('#buildHistoryButtons'),
            history: [],
        },
        stepButtons: [
            {
                description: 'Move to the next step',
                name: 'Next Step',
                buttonElement: getEl('#btnNext'),
                buttonId: 'btnNext',
                actionReturns: null,
                options: ['next'],
                handlerFunc: runStep
            },
            {
                description: 'Move to the previous step',
                name: 'Previous Step',
                buttonElement: getEl('#btnPrev'),
                buttonId: 'btnPrev',
                actionReturns: null,
                options: ['prev'],
                handlerFunc: runStep
            },
            {
                description: 'Move to the next sub step',
                name: 'Next Sub Step',
                buttonElement: getEl('#btnAddStep'),
                buttonId: '#btnAddStep',
                actionReturns: null,
                options: ['substep'],
                handlerFunc: runStep
            }
        ],
        infoElements: {
            stepText: getEl('.plugin-step-text'),
            progressBarFill: getEl('.plugin-progress-bar-fill'),
            stepNumber: getEl('.plugin-step-number'),
            stepNote: getEl('.plugin-step-note'),
            stepName: getEl('.plugin-step-name'),
            subUi: getEl('.plugin-step-sub-ui'),
        },
        buildSteps: [
            {
                id: 0,
                name: "Design Desktop Rest States",
                directions: "Start by building the designs for the desktop rest states of your Velocity. Velocity Ads have two device sizes, and each device size has an expanded and a collapsed rest state. Once you've completed these two boards click next and I'll convert any remaining raster or text layers to smart objects and move to the next step.",
                ////NO ACTIONS ON THIS STEP
                action: null,
                ///THIS ACTION RUNS WHEN YOU PRESS NEXT ON THIS STEP - IT'S THE ACTION THAT HAPPENS BETWEEN THIS STEP AND THE NEXT
                nextAction: {
                    type: 'next',
                    device: ['desktop'],
                    sequences: ['expanded', 'collapsed'],
                    functions: [
                        { id: 1, doIt: normalizeAndPropagateRestStates, options: { device: ['desktop'], sequences: ['expanded', 'collapsed'] } },
                        //{id: 2, doIt:readyPositioningForIntros, options: {device: ['desktop'], sequences: ['expanded', 'collapsed']}},
                    ],
                    // funcs: [normalizeAndPropagateRestStates],
                    callbacks: [incrementStep, updateArtboardState],
                    name: 'Create Desktop Velocity Boards',
                    description: 'Rasterizing, Converting and Propagating The Desktop Rest State Layers to Velocity State Artboards'
                },
            },
            {
                id: 1,
                name: "Design Desktop Velocity States",
                directions: "Start by building the designs for the rest state of your Velocity. Velocity Ads have two sizes, and each size has two rest states. Once you've completed these four boards click next and I'll convert any remaining raster or text layers to smart objects and move to the next step.",
                ////NO ACTIONS ON THIS STEP
                action: null,
                ///THIS ACTION RUNS WHEN YOU PRESS NEXT ON THIS STEP - IT'S THE ACTION THAT HAPPENS BETWEEN THIS STEP AND THE NEXT
                nextAction: {
                    type: 'next',
                    device: 'mobile',
                    sequences: ['expanded', 'collapsed'],
                    functions: [
                        { id: 1, doIt: revealAndPropagateToRestState, options: { device: ['mobile'], sequences: ['expanded', 'collapsed'] } }
                    ],
                    callbacks: [incrementStep],
                    options: ['mobile'],
                    name: 'Reveal Mobile Rest States',
                    description: 'Propagate to, Reveal, and Focus the Mobile Rest State Artboards'
                },
            },
            {
                id: 2,
                name: "Design Mobile Rest States",
                directions: "Start by building the designs for the desktop rest states of your Velocity. Velocity Ads have two device sizes, and each device size has an expanded and a collapsed rest state. Once you've completed these two boards click next and I'll convert any remaining raster or text layers to smart objects and move to the next step.",
                ////NO ACTIONS ON THIS STEP
                action: null,
                ///THIS ACTION RUNS WHEN YOU PRESS NEXT ON THIS STEP - IT'S THE ACTION THAT HAPPENS BETWEEN THIS STEP AND THE NEXT
                nextAction: {
                    type: 'next',
                    device: ['mobile'],
                    sequences: ['expanded', 'collapsed'],
                    functions: [
                        { id: 1, doIt: normalizeAndPropagateRestStates, options: { device: ['mobile'], sequences: ['expanded', 'collapsed'] } }
                    ],
                    callbacks: [incrementStep, updateArtboardState],
                    options: [],
                    name: 'Create Mobile Velocity Boards',
                    description: 'Rasterizing, Converting and Propagating The Mobile Rest State Layers to Velocity State Artboards'
                },
            },
            {
                id: 3,
                name: "Design Mobile Velocity States",
                directions: "Now let's design how your add will look when it reacts to user scroll behavior. The top boards represent how your ad will look when the user is scrolling downwards. The boards on the bottom represent how your add will look when the user is scrolling upwards. Once you're done click next.",
                ////NO ACTIONS ON THIS STEP
                action: null,
                ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
                nextAction: {
                    type: 'next',
                    device: ['desktop'],
                    sequences: ['intro'],
                    functions: [
                        //{id: 1, doIt:readyPositioningForIntros, options: {device: ['desktop'], sequences: ['intro']}},
                        { id: 2, doIt: propagateToIntro, options: { device: ['desktop'], sequences: ['intro'], callbacks: [incrementStep, incrementSubStep, updateArtboardState] } }
                    ],
                    callbacks: [incrementStep, incrementSubStep, updateArtboardState],
                    options: [],
                    name: 'Create Desktop Intro Board',
                    description: 'Clone the Desktop Expanded Artboard to Start a New Desktop Intro Artboard Sequence'
                },
            },
            {
                id: 4,
                name: "Design Desktop Intro Sequence",
                directions: "Now we'll create the desktop intro animation. It's best to storyboard this in reverse: from the expanded rest state. Click the plus button to the right to clone and add a descending artboard in this sequence.",
                ////THIS ACTION CAN RUN MULTIPLE TIMES WITHIN THIS BUILD STEP
                action: {
                    type: 'substep',
                    device: ['desktop'],
                    sequences: ['intro'],
                    functions: [{ id: 1, doIt: propagateToIntro, options: { device: ['desktop'], sequences: ['intro'] } }],
                    callbacks: [incrementSubStep, updateArtboardState],
                    options: ['desktop'],
                    name: 'Create Desktop Intro Board',
                    description: 'Clone the Last Intro Board Created, and Reorder the Numbering of the Artboards So This New Board is #1'
                },
                ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
                nextAction: {
                    type: 'next',
                    device: ['mobile'],
                    sequences: ['intro'],
                    functions: [{ id: 1, doIt: propagateToIntro, options: { device: ['mobile'], sequences: ['intro'] } }],
                    callbacks: [incrementStep, incrementSubStep, updateArtboardState],
                    options: ['mobile'],
                    name: 'Create Mobile Intro Board',
                    description: 'Clone the Mobile Expanded Artboard to Start a New Mobile Intro Artboard Sequence'
                }
            },
            {
                id: 5,
                name: "Design Mobile Intro Sequence",
                directions: "Now we'll do the same for the mobile size.  Click the plus button to the right to clone and add a descending artboard in this sequence.  When you're done, hit next and we'll finalize this project for animating.",
                ////THIS ACTION CAN RUN MULTIPLE TIMES WITHIN THIS BUILD STEP
                action: {
                    type: 'substep',
                    device: ['mobile'],
                    sequences: ['intro'],
                    functions: [{ id: 1, doIt: propagateToIntro, options: { device: ['mobile'], sequences: ['intro'] } }],
                    callbacks: [incrementSubStep, updateArtboardState],
                    options: ['mobile'],
                    name: 'Create Mobile Intro Board',
                    description: 'Clone the Mobile Expanded Artboard to Start a New Mobile Intro Artboard Sequence'
                },
                ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
                nextAction: {
                    type: 'next',
                    device: 'both',
                    functions: [{ id: 1, doIt: null, options: { device: ['desktop', 'mobile'], sequences: ['intro'] } }], ///this will be a convert and sanitization action,
                    callbacks: [incrementStep],
                    options: [],
                    name: 'Finalize Project',
                    description: 'Fix Missing Smart Objects, Convert any lingering Raster Layers or Text, and Warn the User if Anything Looks Amiss'
                }
            },
            {
                id: 6,
                name: "Prepare for Production",
                directions: "You're almost done! Click finish and Studio Companion will do its best to prep your file for Studio. If you'd prefer to do this manually, click on the Production tab on the left and we'll provide some tools to make that process easier.",
                ////NO ACTIONS ON THIS STEP
                action: null,
                nextAction: {
                    type: 'next',
                    functions: [{ id: 1, doIt: null, options: { device: ['desktop', 'mobile'], sequences: ['intro'] } }], ///this will be a convert and sanitization action,
                    options: ['mobile'],
                    name: 'Move into Studio',
                    description: 'Move the Project into Studio' //maybe one day this can be done via API?
                }
            }
        ],
        introSteps: {
            desktop: 0,
            mobile: 0,
        }
    }


    const stateHandler = {
        set: function (target, property, value) {
            logger.debug('setting state property:', target, property, value);
            target[property] = value;
            _notifyStateChange(state);
            return true;
        },
        get: function (target, property) {
            return target[property];
        }
    };

    const creativeStateHandler = {
        set: function (target, property, value) {
            logger.debug('creativeStateHandler', target, property, value);
            target[property] = value;
            _notifyStateChange(creativeState);
            return true;
        },
        get: function (target, property) {
            return target[property];
        }
    };


    const _notifyStateChange = (state) => {
        if (_onUpdateCallback) {
            _onUpdateCallback({
                newState: state
            });
        }
    }

    const state = new Proxy(_state, stateHandler);
    let _creativeState = null,
        creativeState = null;


    const init = async (onUpdate, creative, mode) => {
        return new Promise((resolve, reject) => {
            try {
                _onUpdateCallback = onUpdate;
                _creativeState = creative;
                creativeState = new Proxy(_creativeState, creativeStateHandler);
                state.stepButtons.forEach(button => {
                    const eventObj = {
                        eventName: `${button.name}_Handler`,
                        eventType: 'click',
                        name: button.name,
                        description: button.description,
                        actionReturns: null,
                        element: button.buttonElement,
                        elementId: button.buttonId,
                        action: null, ///handlerFunc will pick the action based on buildstep instead
                        options: button.options,
                        callback: null,
                        handlerFunc: button.handlerFunc
                    }
                    registerEventListener(eventObj);
                });

                try {
                    mode === 'builder' ? initHistory().then(buildStep => {
                        console.log('buildStep', buildStep);
                        updateBuildInterface(buildStep);
                    }) : null;
                } catch (error) {
                    console.error(error);
                }
                // const buildStep = getBuildStep();

                resolve(state);
            } catch (error) {
                reject(error);
            }
        });
    }
    return { init, initHistory, state };
})();

export default Builder;
*/
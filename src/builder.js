// Assistant Step Actions
import { getEl, restoreFocus, mergeArraysByKey, pickProps } from "./js/helpers/utils.js";
import { normalizeAndPropagateRestStates } from "./js/buildActions/propagateRestState.js";
import { propagateToIntro } from "./js/buildActions/propagateToIntro.js";
import { revealAndPropagateToRestState } from "./js/buildActions/revealAndPropagateToRestState.js";
import { readyPositioningForIntros } from "./js/buildActions/readyPositioningForIntros.js";
import { createLogger } from './js/helpers/logger.js';
import History from './js/helpers/history.js';
const { core } = require("photoshop");
let _onUpdateCallback = null;
const Builder = (() => {
    const logger = createLogger({ prefix: 'Builder', initialLevel: 'INFO' });

    const stateHandler = {
        set: function(target, property, value) {
            target[property] = value;
            _notifyStateChange(state);
            return true;
        },
        get: function(target, property) {
            return target[property];
        }
    };

    const creativeStateHandler = {
        set: function(target, property, value) {
            console.log('creativeStateHandler', target, property, value);
            target[property] = value;
            _notifyStateChange(creativeState);
            return true;
        },
        get: function(target, property) {
            return target[property];
        }
    };


    function _notifyStateChange(state) {
        if (_onUpdateCallback) {
            _onUpdateCallback({
                newState: state
            });
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
                        {id: 1, doIt:normalizeAndPropagateRestStates, options: {device: ['desktop'], sequences: ['expanded', 'collapsed']}},
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
                        {id: 1, doIt:revealAndPropagateToRestState, options: {device: ['mobile'], sequences: ['expanded', 'collapsed']}}
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
                        {id: 1, doIt:normalizeAndPropagateRestStates, options: {device: ['mobile'], sequences: ['expanded', 'collapsed']}}
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
                        {id: 2, doIt:propagateToIntro, options: {device: ['desktop'], sequences: ['intro'], callbacks: [incrementStep, incrementSubStep, updateArtboardState]}}
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
                    functions: [{id: 1, doIt:propagateToIntro, options: {device: ['desktop'], sequences: ['intro']}}],
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
                    functions: [{id: 1, doIt:propagateToIntro, options: {device: ['mobile'], sequences: ['intro']}}],
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
                    functions: [{id: 1, doIt:propagateToIntro, options: {device: ['mobile'], sequences: ['intro']}}],
                    callbacks: [incrementSubStep, updateArtboardState],
                    options: ['mobile'],
                    name: 'Create Mobile Intro Board',
                    description: 'Clone the Mobile Expanded Artboard to Start a New Mobile Intro Artboard Sequence'
                },
                ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
                nextAction: {
                    type: 'next',
                    device: 'both',
                    functions: [{id: 1, doIt:null, options: {device: ['desktop', 'mobile'], sequences: ['intro']}}], ///this will be a convert and sanitization action,
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
                    functions: [{id: 1, doIt:null, options: {device: ['desktop', 'mobile'], sequences: ['intro']}}], ///this will be a convert and sanitization action,
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

    const state = new Proxy(_state, stateHandler);
    let _creativeState = null,
        creativeState = null;


    const _eventListeners = [];
    const registerEventListener = (eventConfig = {}) => {
        eventConfig.eventHandler = async (e) => eventConfig.handlerFunc(e, eventConfig);
        eventConfig.listener = eventConfig.element.addEventListener(eventConfig.eventType, eventConfig.eventHandler);
        _eventListeners.push(eventConfig);
    }

    const destroyEventListener = (eventListener) => {
        if(!eventListener.element || !eventListener.event || !eventListener.handlerFunc) return;
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
    async function runStep(event, config) {  

        ///before running step capture a snapshot of the current state;
        try {
            await saveSnapshot();
        } catch (error) {
            logger.error('snapshot error', error);
        }

        console.log('runStep', config);
        const currentStep = getBuildStepNumber();
        console.log('currentStep', currentStep);
        const buildStep = getBuildStep();
        console.log('buildStep', buildStep);
        const action = config.options[0] === 'next' ? buildStep.nextAction : buildStep.action;
        console.log('action', action);
        // const creativeSections = creativeState.devices.filter(item => action.device.includes(item.device));
        console.log('state pre-send',creativeState)
        const stateToPass = pickProps(creativeState.devices, action.device);
        console.log('runStep', action, stateToPass);
        try {
            const results = await executeStepAction(action, stateToPass);
            console.log('runStep results', results);
            if(results.every(result => result.success)) {
                console.log('runStep success');
                results.forEach((result) => {
                    action.callbacks?.forEach(callback => callback?.(action, result));
                });
                restoreFocus();
            } else {
                console.log(results.find(result => !result.success).message);
            }
        } catch (error) {
            console.error('Error executing step action:', error);
            // await core.showAlert(`Error ${builder.buildSteps[currentStep].name}: ${error}`);
        }
    }
    
    async function executeStepAction(action, stateToPass) {
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

    /*  
    async function executeStepAction(action, stateToPass) {
        const {name, type, functions, description, device} = action;
        // logger.debug(`DEBUG: On ${type === 'substep' ? 'Substep' : 'Step'}: ${action.step+1}. User click initiated: ${name}, which will: ${description}`);
        try {
            // logger.debug(`DEBUG: Action:`, action, creativeSection);
            let results = [];
            if (functions && functions.length > 0) {
                // Execute each function sequentially using reduce to create a promise chain
                // This ensures each function completes before starting the next one
                return await functions.reduce(async (previousPromise, {doIt, options}) => {
                    // Wait for the previous promise to complete
                    await previousPromise;                
                    // Then execute the current function
                    const result = await doIt(action, stateToPass, options);
                    logger.log(`Build Action Result: ${result.message}`);
                    if (!result.success && result.message) {
                        // logger.error(`Build Action ResultError: ${result.message}`);
                        // await core.showAlert(result.message);
                    }
                    return result;
                }, Promise.resolve()); // Start with a resolved promise
            } else {
                return { success: true, message: "No functions to execute." };
            }
        } catch (err) {
            logger.error(`Error calling ${name} action:`, err);
            const errorMessage = err.message || err.toString() || "Unknown error.";
            await core.showAlert(`Error ${name}: ${errorMessage}`);
            return [{ success: false, message: errorMessage }];
        }    
    }
        */

    function updateArtboardState(action, result) {
        logger.log(`${action.name} Completed. Updating Creative State With:`, result.payload);
        if (!result.payload || !creativeState.devices) return;        
        creativeState.devices = {...creativeState.devices, ...result.payload.devices}
        logger.log('creativeState', creativeState);
        //mergeArraysByKey(creativeState.devices, result.payload, 'device');
    }

    function incrementSubStep(action, results) {
        // buildStep.options[1] = setIntroSteps(buildStep.device, getIntroSteps(buildStep.device)+1);
        const introSteps = setIntroSteps(action.device, getIntroSteps(action.device)+1);
        //logger.debug(`DEBUG:${action.device} Intro Sequence Now Has ${introSteps} Steps`);
    } 

    function incrementStep(action) {   
        const currentStep = setBuildStep(Math.min(getBuildStepNumber()+1, state.buildSteps.length-1));
        const buildStep = getBuildStep();
        //console.log(`DEBUG: Incrementing To Main Step: ${currentStep+1}, named: ${buildStep.name}`); 
        updateBuildInterface(buildStep);
        
    }

    async function saveSnapshot() {
        try {
            const stepNumber = getBuildStepNumber();
            const snapShotName = `Step_${stepNumber}`;
            await History.capture(snapShotName);
            createHistoryEntry(snapShotName, stepNumber);
            updateHistoryUI();
        } catch (error) {
            return error;
        }
    }
    
    function updateHistoryUI() {
        if(state.buildHistory.history.length > 0) {
            state.buildHistory.containerEl.classList.add('-show');
        } else {
            state.buildHistory.containerEl.classList.remove('-show');
        }
    }
    
    function createHistoryEntry(snapShotName, stepNumber) {
        try {
            const newHistoryEntry = {};
            newHistoryEntry.stepNumber = stepNumber;
            newHistoryEntry.snapshotName = snapShotName;
            const btnMarkup = document.createElement(`sp-button`);
            btnMarkup.classList.add('plugin-history-btn');
            btnMarkup.id = `historyBtn_${stepNumber}`;
            btnMarkup.textContent = `${stepNumber+1}`;
            btnMarkup.setAttribute('data-step', stepNumber);
            btnMarkup.setAttribute('size', 's');
            btnMarkup.setAttribute('treatment', 'outline');
            btnMarkup.setAttribute('variant', 'secondary');
            btnMarkup.setAttribute('data-snapshot', snapShotName);  
            newHistoryEntry.buttonEl =state.buildHistory.buttonGroup.appendChild(btnMarkup);
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
            state.buildHistory.history.push(newHistoryEntry);
        } catch (error) {
            return error;
        }
    }

    function clearSnapshots() {
        History.clear();
    }
    function revertHandler(event, config) {
        logger.log('revertHandler', event, config);
        const snapshotName = event.target.getAttribute('data-snapshot');
        const stepNumber = event.target.getAttribute('data-step');
        logger.log('revertHandler', snapshotName, stepNumber);
        revertToSnapshot(snapshotName, stepNumber);
    }
    function revertToSnapshot(snapshotName, stepNumber) {
        console.log('revertToSnapshot', snapshotName, stepNumber);
        History.restore(snapshotName);
        setBuildStep(stepNumber);
        updateBuildInterface(getBuildStep());
    }

    function updateBuildInterface(buildStep) {
        const currentStep = getBuildStepNumber();
        // console.log(currentStep,  state.infoElements)
        state.infoElements.stepNumber.textContent = `Step ${currentStep+1}:`;
        state.infoElements.stepName.textContent = buildStep.name;
        state.infoElements.stepText.textContent = buildStep.directions;
        const progressWidth = Math.max(5, currentStep/(state.buildSteps.length-1)*100);
        state.infoElements.progressBarFill.style.width = `${progressWidth}%`;  
        if (currentStep === 4) {
        // state.infoElements.nextButton.textContent = 'Finish';
        }
        if(buildStep.action !== null) {
            state.infoElements.subUi.classList.add('-show');
        } else {
            state.infoElements.subUi.classList.remove('-show');
        }
    }

   const init = (onUpdate, creative) => {
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
        const buildStep = getBuildStep();
        updateBuildInterface(buildStep);
        return state
    }
    return { init };
})();

export default Builder;
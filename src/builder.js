// Assistant Step Actions
import { getEl, restoreFocus, mergeArraysByKey, pickProps } from "./js/helpers/utils.js";
import { normalizeAndPropagateRestStates } from "./js/buildActions/propagateRestState.js";
import { propagateToIntro } from "./js/buildActions/propagateToIntro.js";
import { revealAndPropagateToRestState } from "./js/buildActions/revealAndPropagateToRestState.js";
import { readyPositioningForIntros } from "./js/buildActions/readyPositioningForIntros.js";
import { createLogger } from './js/helpers/logger.js';
const { core } = require("photoshop");
let _onUpdateCallback = null;
const logger = createLogger({ prefix: 'Builder', initialLevel: 'DEBUG' });
const Builder = (() => {

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
            // console.log('creativeStateHandler', target, property, value);
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
        currentStep: 3,
        buttonsActive: false,
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
                buttonElement: getEl('.plugin-sub-step-button'),
                buttonId: 'plugin-sub-step-button',
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
                id: 3,
                name: "Design Desktop Rest States",
                directions: "Start by building the designs for the desktop rest states of your Velocity. Velocity Ads have two device sizes, and each device size has an expanded and a collapsed rest state. Once you've completed these two boards click next and I'll convert any remaining raster or text layers to smart objects and move to the next step.",
                ////NO ACTIONS ON THIS STEP
                action: null,
                ///THIS ACTION RUNS WHEN YOU PRESS NEXT ON THIS STEP - IT'S THE ACTION THAT HAPPENS BETWEEN THIS STEP AND THE NEXT
                nextAction: {
                    type: 'next',
                    device: ['desktop'],
                    sequences: ['expanded', 'collapsed'],
                    funcs: [normalizeAndPropagateRestStates],
                    callbacks: [incrementStep, updateArtboardState],
                    options: [],
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
                    funcs: [revealAndPropagateToRestState],
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
                    funcs: [normalizeAndPropagateRestStates],
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
                    funcs: [/*readyPositioningForIntros,*/ propagateToIntro],
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
                    funcs: [propagateToIntro],
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
                    funcs: [/*readyPositioningForIntros,*/ propagateToIntro],
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
                    funcs: [propagateToIntro],
                    callbacks: [incrementSubStep, updateArtboardState],
                    options: ['mobile'],
                    name: 'Create Mobile Intro Board',
                    description: 'Clone the Mobile Expanded Artboard to Start a New Mobile Intro Artboard Sequence'
                },
                ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
                nextAction: {
                    type: 'next',
                    device: 'both',
                    funcs: [null], ///this will be a convert and sanitization action,
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
                    funcs: [null], ///this will be a convert and sanitization action,
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

    const getBuildStep = () => {
        return state.currentStep;
    }

    
   //////////////////////////////////////
    ////////////BUILD ACTIONS/////////////
    //////////////////////////////////////
    async function runStep(event, config) {  
        const currentStep = getBuildStep();
        const buildStep = state.buildSteps[currentStep];
        const action = config.options[0] === 'next' ? buildStep.nextAction : buildStep.action;
        // const creativeSections = creativeState.devices.filter(item => action.device.includes(item.device));
        logger.debug('state pre-send',creativeState)
        const stateToPass = pickProps(creativeState.devices, action.device);
        logger.debug('runStep', action, stateToPass);
        try {
            const results = await executeStepAction(action, stateToPass);
            if(results.every(result => result.success)) {
                results.forEach((result) => {
                    action.callbacks?.forEach(callback => callback?.(action, result));
                });
                restoreFocus();
            } else {
                //await core.showAlert(results.find(result => !result.success).message);
            }
        } catch (error) {
            console.error('Error executing step action:', error);
            // await core.showAlert(`Error ${builder.buildSteps[currentStep].name}: ${error}`);
        }
    }

    async function executeStepAction(action, stateToPass) {
        const {name, type, funcs, description, device} = action;
        // logger.debug(`DEBUG: On ${type === 'substep' ? 'Substep' : 'Step'}: ${action.step+1}. User click initiated: ${name}, which will: ${description}`);
        try {
            // logger.debug(`DEBUG: Action:`, action, creativeSection);
            let results =[];
            funcs && (results = await Promise.all(funcs.map(async func => {
                    const result = await func(action, stateToPass);
                    if (!result.success && result.message) {
                        // await core.showAlert(result.message);
                    }
                    return result;
                }
            )));
            return results;
        } catch (err) {
            console.error(`Error calling ${name} action:`, err);
            const errorMessage = err.message || err.toString() || "Unknown error.";
            // await core.showAlert(`Error ${name}: ${errorMessage}`);
        }    
    }

    function updateArtboardState(action, result) {
        logger.debug(`${action.name} Completed. Updating Creative State With:`, result.payload);
        if (!result.payload || !creativeState.devices) return;        
        creativeState.devices = {...creativeState.devices, ...result.payload.devices}
        logger.debug('creativeState', creativeState);
        //mergeArraysByKey(creativeState.devices, result.payload, 'device');
    }

    function incrementSubStep(action, results) {
        // buildStep.options[1] = setIntroSteps(buildStep.device, getIntroSteps(buildStep.device)+1);
        const introSteps = setIntroSteps(action.device, getIntroSteps(action.device)+1);
        //logger.debug(`DEBUG:${action.device} Intro Sequence Now Has ${introSteps} Steps`);
    } 

    function incrementStep(action) {   
        const currentStep = setBuildStep(Math.min(getBuildStep()+1, state.buildSteps.length-1));
        const buildStep = state.buildSteps[currentStep];
        //console.log(`DEBUG: Incrementing To Main Step: ${currentStep+1}, named: ${buildStep.name}`); 
        updateBuildInterface(buildStep);
    }

    function updateBuildInterface(buildStep) {
        const currentStep = getBuildStep();
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
        return state
    }
    return { init };
})();

export default Builder;
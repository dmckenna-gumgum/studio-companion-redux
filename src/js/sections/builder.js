// Assistant Step Actions
import { getEl, restoreFocus } from "../helpers/utils.js";
import { normalizeAndPropagateRestStates } from "../buildActions/propagateRestState.js";
import { propagateToIntro } from "../buildActions/propagateToIntro.js";
import { revealAndPropagateToRestState } from "../buildActions/revealAndPropagateToRestState.js";
import { readyPositioningForIntros } from "../buildActions/readyPositioningForIntros.js";
const { core } = require("photoshop");
console.log('core loaded', core);
const Builder = (() => {


    
    const builder = {
        currentStep: 0,
        buttonsActive: false,
        stepButtons: [
            {
                element: getEl('#btnNext'),
                func: runStep,
                options: ['next']
            },
            {
                element: getEl('#btnPrev'),
                func: runStep,
                options: ['prev']
            },
            {
                element: getEl('.plugin-sub-step-button'),
                func: runStep,
                options: ['substep']
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
                    device: 'desktop',
                    funcs: [normalizeAndPropagateRestStates],
                    callbacks: [incrementStep],
                    options: [],
                    name: 'Create Velocity Boards',
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
                    funcs: [revealAndPropagateToRestState],
                    callbacks: [incrementStep],
                    options: ['mobile'],
                    name: 'Reveal Mobile Rest States',
                    description: 'Reveal, Select, and Focus the Viewport on the Mobile Rest State Artboards'
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
                    device: 'mobile',
                    funcs: [normalizeAndPropagateRestStates],
                    callbacks: [incrementStep],
                    options: [],
                    name: 'Create Velocity Boards',
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
                    device: 'desktop',
                    funcs: [readyPositioningForIntros, propagateToIntro],
                    callbacks: [incrementStep, incrementSubStep],
                    options: ['desktop'],
                    name: 'Create Desktop Intro Board',
                    description: 'Clone the Desktop Expanded Artboard to Start a New Desktop Intro Artboard Sequence'
                },
            },
            {
                id: 3,
                name: "Design Desktop Intro Sequence",
                directions: "Now we'll create the desktop intro animation. It's best to storyboard this in reverse: from the expanded rest state. Click the plus button to the right to clone and add a descending artboard in this sequence.",
                ////THIS ACTION CAN RUN MULTIPLE TIMES WITHIN THIS BUILD STEP
                action: {
                    type: 'substep',
                    device: 'desktop',
                    funcs: [propagateToIntro],
                    callbacks: [incrementSubStep],
                    options: ['desktop'],
                    name: 'Create Desktop Intro Board',
                    description: 'Clone the Last Intro Board Created, and Reorder the Numbering of the Artboards So This New Board is #1'
                },
                ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
                nextAction: {
                    type: 'next',
                    device: 'mobile',
                    funcs: [propagateToIntro],
                    callbacks: [incrementStep, incrementSubStep],
                    options: ['mobile'],
                    name: 'Create Mobile Intro Board',
                    description: 'Clone the Mobile Expanded Artboard to Start a New Mobile Intro Artboard Sequence'
                }
            },
            {
                id: 4,
                name: "Design Mobile Intro Sequence",
                directions: "Now we'll do the same for the mobile size.  Click the plus button to the right to clone and add a descending artboard in this sequence.  When you're done, hit next and we'll finalize this project for animating.",
                ////THIS ACTION CAN RUN MULTIPLE TIMES WITHIN THIS BUILD STEP
                action: {
                    type: 'substep',
                    device: 'mobile',
                    funcs: [propagateToIntro],
                    callbacks: [incrementSubStep],
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
                id: 5,
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

    //////everything here needs to be sorted into the plugin object eventually
    const buildState = {
        introSteps: {
            desktop: 0,
            mobile: 0,
        }
    }   

    const getIntroSteps = (device) => {
        ///these are temporary until i'm properly pushing created intro boards into the config above, then i can use length of those arrays rather than a separate number 
        return buildState.introSteps[device];
    }
    
    const setIntroSteps = (device, step) => {
        ///these are temporary until i'm properly pushing created intro boards into the config above, then i can use length of those arrays rather than a separate number 
        console.log('setIntroSteps', device, step);
        return buildState.introSteps[device] = step;
    }

    const setBuildStep = (step) => {
        return builder.currentStep = step;
    }

    const getBuildStep = () => {
        return builder.currentStep;
    }
   //////////////////////////////////////
    ////////////BUILD ACTIONS/////////////
    //////////////////////////////////////
    async function runStep(type = 'next') {  
        const currentStep = getBuildStep();
        const buildStep = builder.buildSteps[currentStep];
        const action = type === 'next' ? buildStep.nextAction : buildStep.action;
        try {
            const results = await executeStepAction(action);
            console.log('results', results);
            if(results.every(result => result.success)) {
                action.callbacks?.forEach(callback => callback(action));
            } else {
                // await core.showAlert(results.find(result => !result.success).message);
            }
        } catch (error) {
            console.error('Error executing step action:', error);
            // await core.showAlert(`Error ${builder.buildSteps[currentStep].name}: ${error}`);
        }
    }

    async function executeStepAction(action) {
        const {name, type, funcs, description, device} = action;
        action.step = getIntroSteps(device);
        console.log(`DEBUG: On ${type === 'substep' ? 'Substep' : 'Step'}: ${action.step+1}. User click initiated: ${name}, which will: ${description}`);
        try {
            console.log(`DEBUG: Action Payload:`, action);
            const results =[];
            await funcs?.forEach(async func => {
                const result = await func(action); 
                results.push(result);
                if (!result.success && result.message) { 
                    // await core.showAlert(result.message);
                } 
            });
            restoreFocus();
            return results;
        } catch (err) {
            console.error(`Error calling ${name} action:`, err);
            const errorMessage = err.message || err.toString() || "Unknown error.";
            // await core.showAlert(`Error ${name}: ${errorMessage}`);
        }    
    }


    function incrementSubStep(action) {
        // buildStep.options[1] = setIntroSteps(buildStep.device, getIntroSteps(buildStep.device)+1);
        const introSteps = setIntroSteps(action.device, getIntroSteps(action.device)+1);
        console.log(`DEBUG:${action.device} Intro Sequence Now Has ${introSteps} Steps`);
    } 

    function incrementStep(action) {   
        const currentStep = setBuildStep(Math.min(getBuildStep()+1, builder.buildSteps.length-1));
        console.log('currentStep', currentStep);
        const buildStep = builder.buildSteps[currentStep];
        console.log(`DEBUG: Incrementing To Main Step: ${currentStep+1}, named: ${buildStep.name}`); 
        updateBuildInterface(buildStep);
    }

    function updateBuildInterface(buildStep) {
        const currentStep = getBuildStep();
        builder.infoElements.stepNumber.textContent = `Step ${currentStep+1}:`;
        builder.infoElements.stepName.textContent = buildStep.name;
        builder.infoElements.stepText.textContent = buildStep.directions;
        const progressWidth = Math.max(5, currentStep/(builder.buildSteps.length-1)*100);
        builder.infoElements.progressBarFill.style.width = `${progressWidth}%`;  
        if (currentStep === 4) {
        builder.infoElements.nextButton.textContent = 'Finish';
        }
        if(buildStep.action !== null) {
            builder.infoElements.subUi.classList.add('-show');
        } else {
            builder.infoElements.subUi.classList.remove('-show');
        }
    }

   const initializeSection = () => {
        builder.stepButtons.forEach(button => {
            button.element.addEventListener('click', async (event) => { await button.func(button.options[0]); });
        }) 
    }
    return { initializeSection };
})();

export default Builder;
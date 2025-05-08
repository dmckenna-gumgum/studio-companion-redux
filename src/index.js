// Import CSS
import './css/styles.css';

// Import Spectrum components
import '@swc-uxp-wrappers/utils';
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/src/themes.js';
import '@spectrum-web-components/icons-ui/src/index.js';
import '@spectrum-web-components/styles/src/spectrum-base.css';
import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons/sp-icons-medium.js';
import '@swc-uxp-wrappers/button/sp-button.js';
import '@swc-uxp-wrappers/button-group/sp-button-group.js';
import '@swc-uxp-wrappers/checkbox/sp-checkbox.js';
import '@swc-uxp-wrappers/action-bar/sp-action-bar.js';
import '@swc-uxp-wrappers/action-button/sp-action-button.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-heading.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-item.js';
import '@swc-uxp-wrappers/switch/sp-switch.js';
import '@swc-uxp-wrappers/field-group/sp-field-group.js';
import '@swc-uxp-wrappers/field-label/sp-field-label.js';
import '@swc-uxp-wrappers/textfield/sp-textfield.js';
import '@swc-uxp-wrappers/dialog/sp-dialog.js';
import '@swc-uxp-wrappers/divider/sp-divider.js';

// Core Actions
import { selectLayersByName } from "./js/actions/selectLayersByName.js";
import { linkLayersByName } from "./js/actions/linkLayersByName.js";
import { unlinkLayersByName } from "./js/actions/unlinkLayersByName.js";
import { deleteLayersByName } from "./js/actions/deleteLayersByName.js";
import { propagateLayers } from "./js/actions/propagateLayers.js";
import { transformLayersIndividually } from "./js/actions/transformLayersIndividually.js";

// Assistant Step Actions
import { normalizeAndPropagateRestStates } from "./js/buildActions/propagateRestState.js";
import { propagateToIntro } from "./js/buildActions/propagateToIntro.js";
import { revealAndPropagateToRestState } from "./js/buildActions/revealAndPropagateToRestState.js";

// UXP modules
const { app, core, action, constants } = require("photoshop");

async function finalize() {
  await console.log('all done!');    
}

let buildElements;
const pluginState = {
  currentMode: 'build',
  sections: {
    build: {
      currentStep: 0,
      introSteps: {
        desktop: 0,
        mobile: 0,
      }
    },
    editor: {
      behaviors: null,
      elements: []
    },
    production: {
    }
  }
}


const getIntroSteps = (device) => {
    return pluginState.sections.build.introSteps[device];
}
  
const setIntroSteps = (device, step) => {
    return pluginState.sections.build.introSteps[device] = step;
}

const setBuildStep = (step) => {
    return pluginState.sections.build.currentStep = step;
}

const getBuildStep = () => {
    return pluginState.sections.build.currentStep;
}
// Build Steps
const buildSteps = [
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
            func: normalizeAndPropagateRestStates,
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
            func: revealAndPropagateToRestState,
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
            func: normalizeAndPropagateRestStates,
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
            func:propagateToIntro,
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
            func:propagateToIntro,
            callbacks: [incrementSubStep],
            options: ['desktop'],
            name: 'Create Desktop Intro Board',
            description: 'Clone the Last Intro Board Created, and Reorder the Numbering of the Artboards So This New Board is #1'
        },
        ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
        nextAction: {
            type: 'next',
            device: 'mobile',
            func:propagateToIntro,
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
            func:propagateToIntro,
            callbacks: [incrementSubStep],
            options: ['mobile'],
            name: 'Create Mobile Intro Board',
            description: 'Clone the Mobile Expanded Artboard to Start a New Mobile Intro Artboard Sequence'
        },
        ///NEXT ACTION RUNS WHEN YOU PRESS "NEXT" BUTTON ON THIS STEP - THE STEP ONLY INCREMENTS IF THIS ACTION IS SUCCESSFUL
        nextAction: {
            type: 'next',
            device: 'both',
            func: null, ///this will be a convert and sanitization action,
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
            func: null, ///this will be a convert and sanitization action,
            options: ['mobile'],
            name: 'Move into Studio',
            description: 'Move the Project into Studio' //maybe one day this can be done via API?
        }
    }
];

// let currentStep = 0;
let actionBar;
let currentSelection = new Set();
let selectionPoll;
const checkBoxElements = [];
let feedbackElement;
let viableSelection = true;
let editorMenu;
let lastIds = null;

const setsAreEqual = (a, b) =>
  (a === b) ||
  (
    a instanceof Set &&
    b instanceof Set &&
    a.size === b.size &&
    [...a].every(item => b.has(item))
  );

function onSelect() {
  // grab the _current_ selection array
  const current = app.activeDocument.activeLayers;
  //if selection is empty, stop polling and hide action bar
  if(current.length === 0) {
    stopSelectionPoll();
    toggleActionBar();
    viableSelectionCheck(false);
    return;
  }  
  //create a set of the current selection ids
  const currentIds = new Set(current.map(l => l.id));
  //if selection is the same as last selection, do nothing further
  if(setsAreEqual(currentIds, currentSelection)) {
    console.log('Selection is the same as last selection');
    return;
  }    
  //check if selection is mixed types
  const mixedTypes = current.some(item => item.kind !== current[0].kind);
  // update our snapshot
  currentSelection = currentIds;
  //adjust UI to respond to selection
  viableSelectionCheck(mixedTypes);
  startSelectionPoll();
  toggleActionBar(mixedTypes, currentSelection);
}

function startSelectionPoll() {
  if(!selectionPoll) {
    console.log('Starting selection poll...');
    selectionPoll = setInterval(onSelect, 200);
  }
}

function stopSelectionPoll() {
  console.log('Stopping selection poll...');
  clearInterval(selectionPoll);
  selectionPoll = null;
}

function viableSelectionCheck(mixedTypes) {
  // if((!mixedTypes && !viableSelection) ) {
  //   viableSelection = !mixedTypes;
  //   //disable buttons
  //   toggleButtonDisable();
  // } else if(mixedTypes && viableSelection) {
  //   viableSelection = !mixedTypes;
  //   //enable buttons
  //   toggleButtonDisable();
  // }
  if(mixedTypes === viableSelection) {
    viableSelection = !mixedTypes;
    toggleButtonDisable();
  }
}

function toggleButtonDisable() {
  editorMenu.querySelectorAll('sp-button').forEach(button => {
    console.log('setting buttons to disabled:', !viableSelection);
    if (!viableSelection) {
      button.setAttribute('disabled', ''); // adds the flag
      button.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      button.style.color = 'rgba(255, 255, 255, 0.1)';
    } else {
      button.removeAttribute('disabled');  // clears the flag
      button.removeAttribute('style');
    }
  });
}

function toggleActionBar(mixedTypes = false, selection = null) {
  //if selection is null, hide action bar
  if(selection === null) {
    console.log('hide action bar');
    actionBar.removeAttribute('open');
    return;
  }

  //otherwise open the action bar, and then show the feedback message based on the selection and whether it is mixed types or not
  console.log('show action bar');
  actionBar.setAttribute('open', true);
  if(mixedTypes) {
    feedbackElement.textContent = `You've currently selected a mix of artboards and layers. Performing bulk actions on a mix of artboards and layers is not supported`;
    actionBar.removeAttribute('emphasized');
    actionBar.querySelectorAll('sp-action-button').forEach(button => {
      button.setAttribute('disabled', true);
      button.style.color = 'rgba(255, 255, 255, 0.1)';
    });
  } else {
    feedbackElement.textContent = `${selection.size} layers selected`;
    actionBar.setAttribute('emphasized', true);
    actionBar.querySelectorAll('sp-action-button').forEach(button => {
      button.removeAttribute('disabled');  // clears the flag
      button.removeAttribute('style');
    });
  }
}

// --- Helper Function to Get Options ---
function getValidTypes() {
    const validTypes = [];
    const anyChecked = checkBoxElements.some(checkbox => checkbox.checked);
    //if none are checked, default to all, otherwise only add values of checked boxes. 
    checkBoxElements.forEach(element => {
        if (element.checked || !anyChecked) validTypes.push(element.dataset.filter);
    });
    return validTypes;
}


// --- Update Step Function ---
async function runStep(type = 'next') {  
    const currentStep = getBuildStep();
    const buildStep = buildSteps[currentStep];
    const action = type === 'next' ? buildStep.nextAction : buildStep.action;
    try {
        const result = await executeStepAction(action);
        if(result.success) {
            action.callbacks?.forEach(callback => callback(action));
        } else {
            await core.showAlert(result.message);
        }
    } catch (error) {
        console.error('Error executing step action:', error);
        await core.showAlert(`Error ${buildSteps[currentStep].name}: ${error}`);
    }
}

async function executeStepAction(action) {
    const {name, type, func, description, device} = action;
    action.step = getIntroSteps(device);
    console.log(`DEBUG: On ${type === 'substep' ? 'Substep' : 'Step'}: ${action.step+1}. User click initiated: ${name}, which will: ${description}`);
    try {
        console.log(`DEBUG: Action Payload:`, action);
        const result = await func(action); 
        restoreFocus();
        if (!result.success && result.message) { 
            await core.showAlert(result.message);
        } 
        return result;
    } catch (err) {
        console.error(`Error calling ${name} action:`, err);
        const errorMessage = err.message || err.toString() || "Unknown error.";
        await core.showAlert(`Error ${name}: ${errorMessage}`);
    }    
}


function incrementSubStep(action) {
    // buildStep.options[1] = setIntroSteps(buildStep.device, getIntroSteps(buildStep.device)+1);
    const introSteps = setIntroSteps(action.device, getIntroSteps(action.device)+1);
    console.log(`DEBUG:${action.device} Intro Sequence Now Has ${introSteps} Steps`);
} 

function incrementStep(action) {   
    const currentStep = setBuildStep(Math.min(getBuildStep()+1, buildSteps.length-1));//setBuildStep(type === 'next' ? Math.min(getBuildStep()+1, buildSteps.length-1) : Math.max(getBuildStep()-1, 0));
    const buildStep = buildSteps[currentStep];
    console.log(`DEBUG: Incrementing To Main Step: ${currentStep+1}, named: ${buildStep.name}`); 
    updateBuildInterface(buildStep);
}

function updateBuildInterface(buildStep) {
    const currentStep = getBuildStep();
    buildElements.stepNumber.textContent = `Step ${currentStep+1}:`;
    buildElements.stepName.textContent = buildStep.name;
    buildElements.stepText.textContent = buildStep.directions;
    const progressWidth = Math.max(5, currentStep/(buildSteps.length-1)*100);
    buildElements.progressBarFill.style.width = `${progressWidth}%`;  
    if (currentStep === 4) {
      buildElements.nextButton.textContent = 'Finish';
    }
    //add substep button as-needed
    if(buildStep.action !== null) {
        buildElements.subUi.classList.add('-show');
    } else {
        buildElements.subUi.classList.remove('-show');
    }
}

// --- Event Handlers --- 
function buttonClickHandler(behavior) {
    console.log(`executing ${behavior.name} action...`);
    setTimeout(async () => {
        try {
            console.log(`Starting awaited ${behavior.name} action...`);
            const validTypes = getValidTypes();
            console.log(validTypes)
            const result = await behavior.action(validTypes, ...behavior.options); 
            console.log(`DEBUG: Result from ${behavior.name} action:`, result);
            // Use a more descriptive message if possible
            //feedbackElement.textContent = result.message || (result.success ? `${behavior.name} finished. ${behavior.description} affected ${result.count} total instances.` : `${behavior.name} failed.`);
            restoreFocus();
            behavior.callback?.();
            // Optional: Alert only on unexpected failure 
            if (!result.success && result.message) { 
                await core.showAlert(result.message);
            } 
        } catch (err) {
            console.error(`DEBUG: Error calling ${behavior.name} action:`, err);
            const errorMessage = err.message || err.toString() || "Unknown error.";
            feedbackElement.textContent = `Error: ${errorMessage}`;
            await core.showAlert(`Error ${behavior.name}: ${errorMessage}`);
        }    
    }, 1);
}


//Per this thread: https://forums.creativeclouddeveloper.com/t/clicking-any-button-on-any-uxp-panel-inactivates-keyboard-shortcuts-for-tools-and-brush-sizes/2379/11 
//This stupid workaround is needed to ensure keyboard shortcuts work after any action is run. Fuck you adobe!
function restoreFocus() {
    //get OS platform 
    const os = require('os').platform();
    if (os.includes('win')) {
        //for PC
        core.performMenuCommand({
            commandID: 1208,
            kcanDispatchWhileModal: true,
            _isCommand: false
        });
    } else {
        //for Mac
        const cmds = [2982,2986,2986];
        cmds.map(cmd => core.performMenuCommand({
            commandID: cmd,
            kcanDispatchWhileModal: true,
            _isCommand: false
        }));
    }
}

function setActiveMenu(event) {
  const activeMenu = event.target.value;
  document.querySelector('.plugin-content').setAttribute('data-active-menu', activeMenu);
}

// --- Initialization ---
function initializePanel() {
  console.log("DEBUG: Initializing panel...");

  checkBoxElements.push(
      document.querySelector('#chkDesktop'),
      document.querySelector('#chkMobile'),
  );

  // Import actions directly
  const behaviors = [
      {
          description: "Select All Layers With Name",
          name: "Select",
          action: selectLayersByName,
          buttonId: 'btnSelect',
          buttonElement: document.querySelector('#btnSelect'),
          options: [],
          callback: onSelect
      },
      {
          description: "Link All Layers With Name",
          name: "Link",
          action: linkLayersByName,
          buttonId: 'btnLink',
          buttonElement: document.querySelector('#btnLink'),
          options: []
      },
      {
          description: "Unlink All Layers With Name",
          name: "Unlink",
          action: unlinkLayersByName,
          buttonId: 'btnUnlink',
          buttonElement: document.querySelector('#btnUnlink'),
          options: []
      },
      {
          description: "Delete All Layers With Name",
          name: "Delete",
          action: deleteLayersByName,
          buttonId: 'btnDelete',
          buttonElement: document.querySelector('#btnDelete'),
          options: []
      },
      {
          description: "Propagate All Layers",
          name: "Propagate",
          action: propagateLayers,
          buttonId: 'btnDuplicate',
          buttonElement: document.querySelector('#btnDuplicate'),
          options: [false]
      },
      {
          description: "Propagate Missing Layers",
          name: "Propagate Missing",
          action: propagateLayers,
          buttonId: 'btnMissing',
          buttonElement: document.querySelector('#btnMissing'),
          options: [true]
      },
      {
          description: "Transform Layers Individually",
          name: "Transform Individually",
          action: transformLayersIndividually,
          buttonId: 'btnScale',
          buttonElement: document.querySelector('#btnScale'),
          options: ['scale'] // Pass validTypes and transformType
      },
      {
          description: "Transform Layers Individually",
          name: "Transform Individually",
          action: transformLayersIndividually,
          buttonId: 'btnRotate',
          buttonElement: document.querySelector('#btnRotate'),
          options: ['rotate'] // Pass validTypes and transformType
      }
  ];
  //temporary
  pluginState.sections.editor.behaviors = behaviors;

  buildElements = {
    nextButton: document.querySelector('#btnNext'),
    prevButton: document.querySelector('#btnPrev'),
    stepText: document.querySelector('.plugin-step-text'),
    progressBarFill: document.querySelector('.plugin-progress-bar-fill'),
    stepNumber: document.querySelector('.plugin-step-number'),
    stepNote: document.querySelector('.plugin-step-note'),
    stepName: document.querySelector('.plugin-step-name'),
    subUi: document.querySelector('.plugin-step-sub-ui'),
    subUiButton: document.querySelector('.plugin-sub-step-button')
  }

  pluginState.sections.build.elements = buildElements;

  buildElements.prevButton.addEventListener('click', async (event) => {
    event.preventDefault();
    console.log('no back capability yet.');
    //await runStep(pluginState.sections.build.elements, 'prev');
  });

  buildElements.nextButton.addEventListener('click', async (event) => {
    event.preventDefault();
    await runStep('next');
  });

  buildElements.subUiButton.addEventListener('click', async (event) => {
    event.preventDefault();
    await runStep('substep');
  });

  behaviors.forEach(behavior => {
      if (behavior.buttonElement) {
          behavior.buttonElement.addEventListener('click', () => buttonClickHandler(behavior));
      } else {
          console.error(`Button element not found for ${behavior.buttonId}`);
      }
  });

  

  const sideNav = document.querySelector('sp-sidenav');
  sideNav.addEventListener('change', setActiveMenu);
  editorMenu = document.getElementById('#editor-menu');
  actionBar = document.querySelector('.plugin-action-bar');
  feedbackElement = document.getElementById('feedback');
  editorMenu = document.getElementById('editor-menu');

  feedbackElement.textContent = 'Panel ready.';

  ///listen for layer selections and display action bar when a valid selection is made
  action.addNotificationListener(
    [ { event: 'select' } ], 
    onSelect
  );  
}

function genericActionHandler() {
  console.log('generic action handler')
}

action.addNotificationListener(
  [{ event: 'make' }],    // “make” is what BatchPlay uses for most tool commands
  genericActionHandler
);

// Handle proper loading sequence
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing");
    initializePanel();
});

console.log("DEBUG: Script execution started. Waiting for DOMContentLoaded.");
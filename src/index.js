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

// UXP modules
const { app, core, action, constants } = require("photoshop");

function finalize() {
  console.log('all done!');    
}

const introSteps = {
  desktop: 0,
  mobile: 0
}

// Build Steps
const buildSteps = [
    {
        id: 0,
        name: "Design Rest States",
        directions: "Start by building the designs for the rest state of your Velocity. Velocity Ads have two sizes, and each size has two rest states. Once you've completed these four boards click next and I'll convert any remaining raster or text layers to smart objects and move to the next step.",
        action: {
          main: normalizeAndPropagateRestStates
        },
        callback: null,
    },
    {
        id: 1,
        name: "Design Velocity States",
        directions: "Now let's design how your add will look when it reacts to user scroll behavior. The top boards represent how your ad will look when the user is scrolling downwards. The boards on the bottom represent how your add will look when the user is scrolling upwards. Once you're done click next.",
        action: {
          main: propagateToIntro,
          subStep: {
            button: '#buttonId',
            subAction: propagateToIntro
          }
        },
        options:['desktop', introSteps.desktop],
        callback: null,
    },
    {
        id: 2,
        name: "Design Desktop Intro Sequence",
        directions: "Now we’ll create the desktop intro animation. It’s best to storyboard this in reverse: from the expanded rest state. Click the plus button to the right to clone and add a descending artboard in this sequence.",
        action: {
          main: propagateToIntro,
          subStep: {
            button: '#buttonId',
            subAction: propagateToIntro
          }
        },
        options:['mobile', introSteps.mobile],
        callback: null,
    },
    {
        id: 3,
        name: "Design Mobile Intro Sequence",
        directions: "Now we'll do the same for the mobile size.  Click the plus button to the right to clone and add a descending artboard in this sequence.  When you're done, hit next and we'll finalize this project for animating.",
        action: null,
        callback: finalize,
    },
    {
        id: 4,
        name: "Prepare for Production",
        directions: "You're almost done! Click finish and Studio Companion will do its best to prep your file for Studio. If you'd prefer to do this manually, click on the Production tab on the left and we'll provide some tools to make that process easier.",
        action: null,
        callback: null,
    }
];

let currentStep = 0;
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
async function runStep(elements, direction = 'next') {  
  console.log('running step:', buildSteps[currentStep].name);
  try {
    await executeStepAction(buildSteps[currentStep].action.main, buildSteps[currentStep], elements, direction);
  } catch (error) {
    console.error('Error executing step action:', error);
    await core.showAlert(`Error ${buildSteps[currentStep].name}: ${error}`);
  }
}

function executeStepAction(actionFunc, buildStep, elements, type = 'next') {
  feedbackElement.textContent = `executing ${buildStep.name} action...`;
  setTimeout(async () => {
      try {
          console.log(`Starting awaited ${buildStep.name} action...`);
          const result = await actionFunc(); 
          console.log(`DEBUG: Result from ${buildStep.name} action:`, result);
          restoreFocus();
          if (!result.success && result.message) { 
              await core.showAlert(result.message);
          } else {
              type === 'next' && incrementStep(elements, type, buildStep);
          }
      } catch (err) {
          console.error(`DEBUG: Error calling ${buildStep.name} action:`, err);
          const errorMessage = err.message || err.toString() || "Unknown error.";
          await core.showAlert(`Error ${buildStep.name}: ${errorMessage}`);
      }    
  }, 1);
}

function incrementStep(elements, direction = 'next', buildStep) {    
  currentStep = direction === 'next' ? Math.min(currentStep+1, buildSteps.length-1) : Math.max(currentStep-1, 0);
  const step = buildSteps[currentStep];
  elements.stepNumber.textContent = `Step ${currentStep+1}:`;
  elements.stepName.textContent = step.name;
  elements.stepText.textContent = step.directions;
  const progressWidth = Math.max(5, currentStep/(buildSteps.length-1)*100);
  elements.progressBarFill.style.width = `${progressWidth}%`;
  console.log('updating step:', step.name);
  if (currentStep === 4) {
    elements.nextButton.textContent = 'Finish';
  }

  //add substep button as-needed
  if(buildStep.subStep) {
    console.log('setup substep listener')
    elements.subUi.classList.add('-show');
    elements.subUi.querySelector('.plugin-sub-step-button').addEventListener('click', () => executeStepAction(buildStep.subStep.subAction, buildStep, elements, 'substep'));

  }
}

// --- Event Handlers --- 
function buttonClickHandler(behavior) {
    feedbackElement.textContent = `executing ${behavior.name} action...`;
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

  
  const assistantElements = {
    nextButton: document.querySelector('#btnNext'),
    prevButton: document.querySelector('#btnPrev'),
    stepText: document.querySelector('.plugin-step-text'),
    progressBarFill: document.querySelector('.plugin-progress-bar-fill'),
    stepNumber: document.querySelector('.plugin-step-number'),
    stepNote: document.querySelector('.plugin-step-note'),
    stepName: document.querySelector('.plugin-step-name'),
    subUi: document.querySelector('.plugin-step-sub-ui')
  }

  assistantElements.prevButton.addEventListener('click', (event) => {
    event.preventDefault();
    runStep(assistantElements, 'prev');
  });

  assistantElements.nextButton.addEventListener('click', (event) => {
    event.preventDefault();
    runStep(assistantElements, 'next');
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
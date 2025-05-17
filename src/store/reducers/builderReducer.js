// src/store/reducers/builderReducer.js
import * as types from '../actions/actionTypes.js';

/**
 * Default build steps structure
 */
const defaultBuildSteps = [
  {
    id: 0,
    name: "Plan Your Design",
    directions: "Select a format and plan your design. The build process will help you create artboards and propagate content across them.",
    action: null,
    nextAction: {
      type: 'next',
      functions: [],
      name: 'Setup Format',
      description: 'Set up the creative format and initialize the document'
    }
  },
  {
    id: 1,
    name: "Design Main Artboard",
    directions: "Create your main content area. This is your primary canvas for your design.",
    action: null,
    nextAction: {
      type: 'next',
      name: 'Propagate Layouts',
      description: 'Propagate layouts across all artboards'
    }
  },
  {
    id: 2,
    name: "Propagate Design",
    directions: "Now let's propagate your design to other variants and states. We'll help you maintain consistency across formats and sizes.",
    action: null,
    nextAction: {
      type: 'next',
      name: 'Review Layout',
      description: 'Finalize the layout'
    }
  },
  {
    id: 3,
    name: "Finalize and Review",
    directions: "Review your work and make any final adjustments. When you're ready, move to production.",
    action: null,
    nextAction: {
      type: 'next',
      name: 'Prepare for Production',
      description: 'Convert layers and prepare for production'
    }
  }
];

/**
 * Initial state for builder
 */
const initialState = {
  currentStep: 0,
  buildSteps: defaultBuildSteps,
  creative: {
    format: 'default',
    devices: {
      desktop: { width: 1280, height: 720 },
      mobile: { width: 320, height: 480 }
    }
  },
  history: [],
  introSteps: {
    desktop: 0,
    mobile: 0
  }
};

/**
 * Reducer for builder-related state
 */
export default function builderReducer(state = initialState, action) {
  switch (action.type) {
    case types.SET_BUILD_STEP:
      return {
        ...state,
        currentStep: action.payload
      };
      
    case types.INCREMENT_STEP:
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, state.buildSteps.length - 1)
      };
      
    case types.DECREMENT_STEP:
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 0)
      };
      
    case types.UPDATE_CREATIVE:
      return {
        ...state,
        creative: {
          ...state.creative,
          ...action.payload
        }
      };
      
    case types.ADD_TO_HISTORY:
      return {
        ...state,
        history: [
          ...state.history,
          {
            name: action.payload.name,
            step: action.payload.step,
            state: action.payload.state,
            timestamp: Date.now()
          }
        ]
      };
      
    case types.RESTORE_HISTORY_STATE:
      // Check if the index is valid
      if (action.payload >= 0 && action.payload < state.history.length) {
        return {
          ...state,
          currentStep: state.history[action.payload].step
          // Additional state restoration can be done here as needed
        };
      }
      return state;
      
    case types.CLEAR_HISTORY:
      return {
        ...state,
        history: []
      };
      
    default:
      return state;
  }
}

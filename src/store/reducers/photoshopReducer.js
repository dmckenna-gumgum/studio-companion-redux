// src/store/reducers/photoshopReducer.js
import * as types from '../actions/actionTypes.js';

const initialState = {
  // Document state
  document: null,
  isDocumentOpen: false,
  
  // Theme
  theme: 'light',
  
  // Operation tracking
  pendingOperations: [],
  lastOperation: null,
  operationError: null,
  
  // History of operations (for potential undo functionality)
  operationHistory: []
};

/**
 * Reducer for handling Photoshop document and operation state
 */
export default function photoshopReducer(state = initialState, action) {
  switch (action.type) {
    case types.DOCUMENT_LOADED:
      return {
        ...state,
        document: action.payload,
        isDocumentOpen: true,
        operationError: null
      };
      
    case types.DOCUMENT_CLOSED:
      return {
        ...state,
        document: null,
        isDocumentOpen: false
      };
      
    case types.SET_THEME:
      return {
        ...state,
        theme: action.payload
      };
      
    case types.PS_ACTION_START:
      return {
        ...state,
        pendingOperations: [
          ...state.pendingOperations, 
          action.payload.commandName
        ],
        operationError: null
      };
      
    case types.PS_ACTION_SUCCESS: {
      const updatedPendingOps = state.pendingOperations.filter(
        op => op !== action.payload.commandName
      );
      
      return {
        ...state,
        pendingOperations: updatedPendingOps,
        lastOperation: {
          name: action.payload.commandName,
          result: action.payload.result,
          timestamp: Date.now(),
          status: 'success'
        },
        operationHistory: [
          ...state.operationHistory.slice(-9), // Keep last 10 operations
          {
            name: action.payload.commandName,
            status: 'success',
            timestamp: Date.now()
          }
        ]
      };
    }
    
    case types.PS_ACTION_FAILURE: {
      const updatedPendingOps = state.pendingOperations.filter(
        op => op !== action.payload.commandName
      );
      
      return {
        ...state,
        pendingOperations: updatedPendingOps,
        operationError: action.payload.error,
        lastOperation: {
          name: action.payload.commandName,
          error: action.payload.error,
          timestamp: Date.now(),
          status: 'error'
        },
        operationHistory: [
          ...state.operationHistory.slice(-9), // Keep last 10 operations
          {
            name: action.payload.commandName,
            status: 'error',
            timestamp: Date.now()
          }
        ]
      };
    }
    
    default:
      return state;
  }
}

// src/store/reducers/documentReducer.js
import * as types from '../actions/actionTypes.js';

/**
 * Initial state for document-related data
 */
const initialState = {
  activeDocument: null,
  documentInfo: {
    name: '',
    path: '',
    width: 0,
    height: 0,
    resolution: 0,
    colorMode: ''
  },
  status: {
    isOpen: false,
    isDirty: false
  }
};

/**
 * Reducer for document-related state
 */
export default function documentReducer(state = initialState, action) {
  switch (action.type) {
    case types.SET_ACTIVE_DOCUMENT:
      return {
        ...state,
        activeDocument: action.payload,
        status: {
          ...state.status,
          isOpen: !!action.payload
        }
      };
      
    case types.UPDATE_DOCUMENT_INFO:
      return {
        ...state,
        documentInfo: {
          ...state.documentInfo,
          ...action.payload
        }
      };
      
    case types.SET_DOCUMENT_STATUS:
      return {
        ...state,
        status: {
          ...state.status,
          ...action.payload
        }
      };
      
    default:
      return state;
  }
}

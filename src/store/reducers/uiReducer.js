// src/store/reducers/uiReducer.js
import * as types from '../actions/actionTypes.js';

/**
 * Initial state for UI
 */
const initialState = {
  activeMode: 'builder', // 'builder', 'editor', or 'production'
  panels: {
    // Panel visibility states
  },
  notifications: []
};

/**
 * Reducer for UI-related state
 */
export default function uiReducer(state = initialState, action) {
  switch (action.type) {
    case types.SET_ACTIVE_MODE:
      return {
        ...state,
        activeMode: action.payload
      };
      
    case types.TOGGLE_PANEL:
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.payload.panelId]: action.payload.isVisible
        }
      };
      
    case types.SHOW_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
      
    case types.HIDE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(
          notification => notification.id !== action.payload
        )
      };
      
    default:
      return state;
  }
}

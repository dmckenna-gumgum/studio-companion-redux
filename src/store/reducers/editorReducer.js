// src/store/reducers/editorReducer.js
import * as types from '../actions/actionTypes.js';

/**
 * Initial state for the editor
 */
const initialState = {
  currentSelection: {
    layers: [],
    identical: false,
    viable: false,
    sameGroup: true
  },
  filterRegex: /^.*$/,
  scopeFilters: [],
  autoLink: {
    enabled: false
  },
  linkedLayers: []
};

/**
 * Reducer for editor-related state
 */
export default function editorReducer(state = initialState, action) {
  switch (action.type) {
    // New selection actions (replacing SELECT_LAYERS and UPDATE_SELECTION)
    case types.SELECTION_CHANGED:
      return {
        ...state,
        currentSelection: {
          ...state.currentSelection,
          layers: action.payload,
          // The selection middleware will compute these properties and dispatch SELECTION_PROCESSED
          // This is just an initial update with the raw selection data
        }
      };
      
    case types.SELECTION_PROCESSED:
      return {
        ...state,
        currentSelection: {
          ...state.currentSelection,
          ...action.payload
        }
      };
      
    // Legacy actions - keeping for backward compatibility
    case types.SELECT_LAYERS:
      return {
        ...state,
        currentSelection: {
          ...state.currentSelection,
          layers: action.payload,
          viable: action.payload.length > 0,
          identical: false
        }
      };
      
    case types.UPDATE_SELECTION:
      return {
        ...state,
        currentSelection: {
          ...state.currentSelection,
          ...action.payload
        }
      };
      
    case types.SET_FILTER:
      return {
        ...state,
        filterRegex: action.payload
      };
      
    case types.UPDATE_SCOPE_FILTER:
      const { filter, add } = action.payload;
      let newScopeFilters;
      
      if (add) {
        // Add filter if it doesn't already exist
        const exists = state.scopeFilters.some(f => f.name === filter.name);
        newScopeFilters = exists
          ? state.scopeFilters
          : [...state.scopeFilters, { ...filter, active: true }];
      } else {
        // Remove filter if it exists
        newScopeFilters = state.scopeFilters.filter(f => f.name !== filter.name);
      }
      
      // Build new regex from filters
      const regexPatterns = newScopeFilters.length > 0
        ? newScopeFilters.map(f => f.filter || f.name)
        : ['^.*$']; // Default regex matches everything
      
      const newRegex = new RegExp(regexPatterns.join('|'));
      
      return {
        ...state,
        scopeFilters: newScopeFilters,
        filterRegex: newRegex
      };
      
    case types.TOGGLE_AUTO_LINK:
      return {
        ...state,
        autoLink: {
          ...state.autoLink,
          enabled: action.payload
        }
      };
      
    // New linking actions
    case types.LAYERS_LINKED:
      return {
        ...state,
        linkedLayers: [...state.linkedLayers, ...action.payload]
      };
      
    case types.LAYERS_UNLINKED:
      const unlinkedLayerIds = action.payload.map(layer => layer.id);
      return {
        ...state,
        linkedLayers: state.linkedLayers.filter(layer => 
          !unlinkedLayerIds.includes(layer.id))
      };
    
    // Legacy actions - keeping for backward compatibility  
    case types.LINK_LAYERS:
      return {
        ...state,
        linkedLayers: [...state.linkedLayers, ...action.payload]
      };
      
    case types.UNLINK_LAYERS:
      const layerIdsToUnlink = action.payload.map(layer => layer.id);
      return {
        ...state,
        linkedLayers: state.linkedLayers.filter(layer => 
          !layerIdsToUnlink.includes(layer.id))
      };
      
    default:
      return state;
  }
}

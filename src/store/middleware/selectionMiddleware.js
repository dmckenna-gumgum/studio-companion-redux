// src/store/middleware/selectionMiddleware.js
import { app } from 'photoshop';
import * as types from '../actions/actionTypes.js';
import { 
  selectionProcessed, 
  layersLinked, 
  layersUnlinked 
} from '../actions/selectionActions.js';
import { createLogger } from '../../js/helpers/logger.js';
import { 
  sameIdSet, 
  parentGroupCount, 
  getSelectionViability, 
  diffArraysByIds 
} from "../../js/helpers/utils.js";
import { showNotification } from '../actions/uiActions.js';

// Initialize logger
const logger = createLogger({ prefix: 'SelectionMiddleware', initialLevel: 'DEBUG' });

// Keep track of the last selection for comparison
let lastSelection = [];

/**
 * Selection processing middleware
 * Handles selection analysis and auto-linking functionality
 */
export const selectionMiddleware = store => next => action => {
  // Always pass the action to the next middleware in the chain first
  const result = next(action);
  
  switch (action.type) {
    case types.SELECTION_CHANGED: {
      const layers = action.payload;
      const state = store.getState();
      const autoLinkEnabled = state.editor?.autoLink?.enabled || false;
      
      try {
        if (!layers || layers.length === 0) {
          // Handle deselection case
          const processedSelection = {
            layers: [],
            viable: false,
            identical: false,
            sameGroup: true,
            parentGroupCount: 0,
            type: 'layer'
          };
          
          store.dispatch(selectionProcessed(processedSelection));
          
          // If autoLink is enabled, handle unlinking
          if (autoLinkEnabled && lastSelection.length > 0) {
            // This would trigger LinkProcessor via photoshopMiddleware
            store.dispatch({
              type: types.UNLINK_LAYERS,
              payload: lastSelection,
              meta: {
                photoshop: true
              }
            });
          }
          
          // Update last selection
          lastSelection = [];
          
        } else {
          // Process selection data
          const { viable, type } = getSelectionViability(layers);
          const identical = lastSelection.length > 0 ? sameIdSet(layers, lastSelection) : false;
          const groupCount = parentGroupCount(layers);
          
          const processedSelection = {
            layers,
            viable,
            identical,
            sameGroup: groupCount === 1,
            parentGroupCount: groupCount,
            type
          };
          
          // Dispatch processed selection data to update Redux state
          store.dispatch(selectionProcessed(processedSelection));
          
          // Handle auto-linking if enabled and selection is viable
          if (autoLinkEnabled && viable && !identical) {
            const { onlyA: newLayers, onlyB: unselectedLayers, both: existingLayers } = 
              diffArraysByIds(layers, lastSelection);
            
            // This would trigger LinkProcessor via photoshopMiddleware
            store.dispatch({
              type: types.LINK_LAYERS,
              payload: {
                newLayers,
                unselectedLayers,
                existingLayers,
                selectionFilters: state.editor?.filterRegex
              },
              meta: {
                photoshop: true
              }
            });
          }
          
          // Update last selection
          lastSelection = [...layers];
        }
      } catch (error) {
        logger.error('Error processing selection', error);
        store.dispatch(showNotification({
          message: `Error processing selection: ${error.message}`,
          type: 'error',
          duration: 3000
        }));
      }
      break;
    }
    
    case types.TOGGLE_AUTO_LINK: {
      const enabled = action.payload;
      const state = store.getState();
      const currentSelection = state.editor?.currentSelection;
      
      // If enabling auto-link and there's a viable current selection, 
      // trigger initial linking
      if (enabled && 
          currentSelection?.viable && 
          currentSelection?.layers && 
          currentSelection.layers.length > 0) {
        
        store.dispatch({
          type: types.LINK_LAYERS,
          payload: {
            newLayers: [],
            unselectedLayers: [],
            existingLayers: currentSelection.layers,
            selectionFilters: state.editor?.filterRegex
          },
          meta: {
            photoshop: true
          }
        });
      }
      // If disabling auto-link, unlink all linked layers
      else if (!enabled && state.editor?.linkedLayers?.length > 0) {
        store.dispatch({
          type: types.UNLINK_LAYERS,
          payload: state.editor.linkedLayers,
          meta: {
            photoshop: true
          }
        });
      }
      break;
    }
  }
  
  return result;
};

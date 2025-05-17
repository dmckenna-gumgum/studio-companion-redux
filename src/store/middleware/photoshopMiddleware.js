// src/store/middleware/photoshopMiddleware.js
import { app, core, action } from 'photoshop';
import * as types from '../actions/actionTypes.js';
import { showNotification } from '../actions/uiActions.js';
import { createLogger } from '../../js/helpers/logger.js';
import { selectLayersByName } from '../../js/actions/selectLayersByName.js';
import { selectLayers, updateSelection } from '../actions/editorActions.js';
import { layersLinked, layersUnlinked } from '../actions/selectionActions.js';
import { LinkByArrayOfLayers, UnlinkAllLayers } from '../../js/actions/LinkProcessor.js';

// Initialize logger
const logger = createLogger({ prefix: 'PhotoshopMiddleware', initialLevel: 'DEBUG' });

/**
 * Process and link layers with the Photoshop UXP API
 * @param {Object} payload - Payload containing layer data
 * @returns {Promise<Object>} - Result of the link operation
 */
const processLinkLayers = async (payload) => {
  try {
    logger.debug('Processing layer linking', payload);
    const { newLayers = [], unselectedLayers = [], existingLayers = [], selectionFilters } = payload;
    
    // Use the actual LinkProcessor implementation
    const result = await LinkByArrayOfLayers(
      newLayers, 
      unselectedLayers, 
      existingLayers, 
      selectionFilters
    );
    
    if (result && result.success) {
      // Get linked layers from the result
      const linkedLayers = result.linked || [];
      // Return success with linked layers
      return { 
        success: true, 
        message: `Linked ${linkedLayers.length} layers successfully`,
        layers: linkedLayers 
      };
    } else {
      return { 
        success: false, 
        message: result?.message || 'Failed to link layers',
        layers: [] 
      };
    }
  } catch (error) {
    logger.error('Error linking layers', error);
    return { 
      success: false, 
      message: error.message,
      layers: [] 
    };
  }
};

/**
 * Unlink layers with the Photoshop UXP API
 * @param {Array} layers - Layers to unlink
 * @returns {Promise<Object>} - Result of the unlink operation
 */
const processUnlinkLayers = async (layers) => {
  try {
    logger.debug('Unlinking layers', { layerCount: layers.length });
    // Use the actual LinkProcessor implementation
    const result = await UnlinkAllLayers(layers);
    
    return { 
      success: result && result.success, 
      message: result?.message || `Unlinked ${layers.length} layers successfully`,
      layers 
    };
  } catch (error) {
    logger.error('Error unlinking layers', error);
    return { 
      success: false, 
      message: error.message,
      layers: [] 
    };
  }
};

/**
 * Middleware for handling actions that require Photoshop UXP API operations
 * This middleware intercepts actions with photoshop: true in their meta field
 * and executes the appropriate Photoshop API calls
 */
export const photoshopMiddleware = store => next => action => {
  // Continue the middleware chain first to allow reducer to update state
  const result = next(action);
  
  // Process actions that need Photoshop API integration
  if (action.meta && action.meta.photoshop) {
    logger.debug('Handling Photoshop action', { type: action.type });
    
    // Dispatch start of Photoshop operation
    store.dispatch({
      type: types.PS_ACTION_START,
      payload: {
        originalAction: action.type,
        timestamp: Date.now()
      }
    });

    // Wrap Photoshop operations in executeAsModal
    (async () => {
      try {
        // Execute the Photoshop operation
        await core.executeAsModal(async () => {
          // Handle different action types
          switch (action.type) {
            // Handle linking actions
            case types.LINK_LAYERS:
              try {
                // Process linking with the new function
                const linkResult = await processLinkLayers(action.payload);
                logger.debug('Link layers result', linkResult);
                
                if (linkResult.success && linkResult.layers && linkResult.layers.length > 0) {
                  // Dispatch the new LAYERS_LINKED action with the linked layers
                  store.dispatch(layersLinked(linkResult.layers));
                  
                  // Show success message if needed
                  if (action.meta.showNotification) {
                    store.dispatch(showNotification({
                      message: linkResult.message,
                      type: 'success',
                      duration: 3000
                    }));
                  }
                }
              } catch (error) {
                logger.error('Error handling LINK_LAYERS', error);
              }
              break;

            // Handle unlinking actions
            case types.UNLINK_LAYERS:
              try {
                if (action.payload && action.payload.length > 0) {
                  // Process unlinking with the new function
                  const unlinkResult = await processUnlinkLayers(action.payload);
                  logger.debug('Unlink layers result', unlinkResult);
                  
                  if (unlinkResult.success) {
                    // Dispatch the new LAYERS_UNLINKED action with the unlinked layers
                    store.dispatch(layersUnlinked(action.payload));
                    
                    // Show success message if needed
                    if (action.meta.showNotification) {
                      store.dispatch(showNotification({
                        message: unlinkResult.message,
                        type: 'success',
                        duration: 3000
                      }));
                    }
                  }
                }
              } catch (error) {
                logger.error('Error handling UNLINK_LAYERS', error);
              }
              break;
              
            case types.SELECT_LAYERS_BY_NAME:
              try {
                // Call the selectLayersByName function with options
                const options = action.payload || {};
                const result = await selectLayersByName(options.filter, options);
                logger.debug('Select layers by name result', result);
                
                // If successful and we have layers, update Redux store with the selected layers
                if (result.success && result.layers) {
                  // First dispatch the regular select layers action
                  store.dispatch(selectLayers(result.layers));
                  
                  // Then update the selection information
                  store.dispatch(updateSelection({
                    layers: result.layers,
                    viable: result.layers.length > 0,
                    identical: result.identical || false,
                    sameGroup: result.sameGroup || true
                  }));
                  
                  // Also display feedback to the user
                  store.dispatch(showNotification({
                    message: result.message || `Selected ${result.layers.length} layers`,
                    type: 'success',
                    duration: 3000
                  }));
                } else {
                  // Show error message if the operation failed
                  store.dispatch(showNotification({
                    message: result.message || 'Failed to select layers',
                    type: 'error',
                    duration: 3000
                  }));
                }
              } catch (error) {
                logger.error('Error in SELECT_LAYERS_BY_NAME', error);
                store.dispatch(showNotification({
                  message: `Error: ${error.message || 'Unknown error selecting layers'}`,
                  type: 'error',
                  duration: 3000
                }));
              }
              break;

            // Add more Photoshop operations as needed
            // Generic operation case can be added here if needed
            // Example:
            // case types.SOME_OTHER_ACTION:
            //   // Handle the action
            //   break;

            default:
              logger.warn(`No Photoshop handler for action type: ${action.type}`);
          }
        }, {
          commandName: action.meta.commandName || 'Photoshop Operation'
        });

        // Dispatch success action
        store.dispatch({
          type: types.PS_ACTION_SUCCESS,
          payload: {
            originalAction: action.type,
            result: `${action.meta.commandName || 'Operation'} completed successfully`,
            timestamp: Date.now()
          }
        });

        // Show success notification if requested
        if (action.meta.showNotification) {
          store.dispatch(showNotification({
            message: action.meta.successMessage || `${action.meta.commandName || 'Operation'} completed successfully`,
            type: 'success',
            duration: 3000
          }));
        }
      } catch (error) {
        logger.error('Photoshop operation failed:', error);
        
        // Dispatch failure action
        store.dispatch({
          type: types.PS_ACTION_FAILURE,
          payload: {
            originalAction: action.type,
            error: error.message,
            timestamp: Date.now()
          }
        });

        // Show error notification
        store.dispatch(showNotification({
          message: `${action.meta.commandName || 'Operation'} failed: ${error.message}`,
          type: 'error',
          duration: 5000
        }));
      }
    })();
  }

  // Return the result of the middleware chain
  return result;
};

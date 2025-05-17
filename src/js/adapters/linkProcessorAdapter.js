// src/js/adapters/linkProcessorAdapter.js
import { LinkByArrayOfLayers, UnlinkAllLayers } from '../actions/LinkProcessor.js';
import { createLogger } from '../helpers/logger.js';
import store from '../../store/index.js';
import { linkLayers, unlinkLayers } from '../../store/actions/editorActions.js';
import { showNotification } from '../../store/actions/uiActions.js';

// Initialize logger
const logger = createLogger({ prefix: 'LinkProcessorAdapter', initialLevel: 'DEBUG' });

/**
 * Adapts the LinkProcessor module to work with Redux
 * This provides Redux-compatible functions that delegate to the original implementation
 * while ensuring that Redux state is updated appropriately
 */
export const createLinkProcessorAdapter = () => {
  // Redux state change handler to maintain synchronization
  const handleReduxStateChange = () => {
    // Could be implemented to react to Redux state changes that affect link status
    const state = store.getState();
    // Example: You could check if linked layers in Redux match Photoshop state
  };

  /**
   * Links layers using Redux actions and UXP API
   * @param {Array} newLayers - New layers to link
   * @param {Array} unselectedLayers - Layers that were unselected
   * @param {Array} existingLayers - Layers that were already selected
   * @param {Object} filters - Optional filters to apply
   * @returns {Promise} - Promise resolving with the link result
   */
  const linkLayersWithRedux = async (newLayers = [], unselectedLayers = [], existingLayers = [], filters = null) => {
    logger.debug('Linking layers through adapter', { 
      newLayersCount: newLayers.length, 
      unselectedCount: unselectedLayers.length,
      existingCount: existingLayers.length
    });
    
    try {
      // Update Redux state with the link request
      if (newLayers.length > 0) {
        // Dispatch Redux action to update UI state
        store.dispatch(linkLayers(newLayers));
      }
      
      // Call the UXP API for linking through original implementation
      const result = await LinkByArrayOfLayers(newLayers, unselectedLayers, existingLayers, filters);
      
      // Show notification of the result
      if (result.success) {
        store.dispatch(showNotification({
          message: `Linked ${newLayers.length} layers successfully`,
          type: 'success',
          duration: 3000
        }));
      } else {
        store.dispatch(showNotification({
          message: result.message || 'Error linking layers',
          type: 'error',
          duration: 5000
        }));
      }
      
      return result;
    } catch (error) {
      logger.error('Error linking layers', error);
      
      // Show error notification
      store.dispatch(showNotification({
        message: `Error linking layers: ${error.message || 'Unknown error'}`,
        type: 'error',
        duration: 5000
      }));
      
      throw error;
    }
  };
  
  /**
   * Unlinks all layers using Redux and the UXP API
   * @returns {Promise} - Promise resolving with the unlink result
   */
  const unlinkAllLayersWithRedux = async () => {
    logger.debug('Unlinking all layers through adapter');
    
    try {
      // Get current linked layers from Redux state
      const state = store.getState();
      const linkedLayers = state.editor.linkedLayers || [];
      
      // Dispatch Redux action to update UI state
      if (linkedLayers.length > 0) {
        store.dispatch(unlinkLayers(linkedLayers));
      }
      
      // Call the UXP API to actually perform the unlinking
      const result = await UnlinkAllLayers(linkedLayers);
      
      // Show notification of the result
      if (result.success) {
        store.dispatch(showNotification({
          message: result.message || `Unlinked layers successfully`,
          type: 'success',
          duration: 3000
        }));
      } else {
        store.dispatch(showNotification({
          message: result.message || 'Error unlinking layers',
          type: 'error',
          duration: 5000
        }));
      }
      
      return result;
    } catch (error) {
      logger.error('Error unlinking layers', error);
      
      // Show error notification
      store.dispatch(showNotification({
        message: `Error unlinking layers: ${error.message || 'Unknown error'}`,
        type: 'error',
        duration: 5000
      }));
      
      throw error;
    }
  };
  
  /**
   * Link selected layers based on current Redux state
   * This is the primary method that should be called from UI handlers
   */
  const linkSelectedLayers = async () => {
    const state = store.getState();
    const layers = state.editor.currentSelection?.layers || [];
    
    if (layers.length > 0) {
      logger.debug('Linking selected layers from Redux state', { layerCount: layers.length });
      return await linkLayersWithRedux(layers, [], [], null);
    } else {
      logger.debug('No layers selected to link');
      
      // Show notification for user feedback
      store.dispatch(showNotification({
        message: 'No layers selected to link',
        type: 'warning',
        duration: 3000
      }));
      
      return { success: false, message: 'No layers selected to link' };
    }
  };
  
  /**
   * Unlink selected layers based on current Redux state
   */
  const unlinkSelectedLayers = async () => {
    const state = store.getState();
    const layers = state.editor.currentSelection?.layers || [];
    
    if (layers.length > 0) {
      logger.debug('Unlinking selected layers from Redux state', { layerCount: layers.length });
      
      try {
        // Update Redux state
        store.dispatch(unlinkLayers(layers));
        
        // Perform the actual UXP operation
        // We'll reuse the LinkByArrayOfLayers with empty newLayers to just unlink
        const result = await LinkByArrayOfLayers([], layers, [], null);
        
        // Show notification
        if (result.success) {
          store.dispatch(showNotification({
            message: `Unlinked ${layers.length} layers successfully`,
            type: 'success', 
            duration: 3000
          }));
        }
        
        return result;
      } catch (error) {
        logger.error('Error unlinking selected layers', error);
        
        // Show error notification
        store.dispatch(showNotification({
          message: `Error unlinking layers: ${error.message || 'Unknown error'}`,
          type: 'error',
          duration: 5000
        }));
        
        throw error;
      }
    } else {
      logger.debug('No layers selected to unlink');
      
      // Show notification
      store.dispatch(showNotification({
        message: 'No layers selected to unlink',
        type: 'warning',
        duration: 3000
      }));
      
      return { success: false, message: 'No layers selected to unlink' };
    }
  };
  
  // Subscribe to Redux store changes
  const unsubscribe = store.subscribe(handleReduxStateChange);
  
  return {
    linkLayersWithRedux,
    unlinkAllLayersWithRedux,
    linkSelectedLayers,
    unlinkSelectedLayers,
    destroy: () => {
      // Clean up store subscription when adapter is no longer needed
      unsubscribe();
    }
  };
};

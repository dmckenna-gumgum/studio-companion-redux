// src/store/actions/photoshopActions.js
import * as types from './actionTypes.js';
import { createLogger } from '../../js/helpers/logger.js';

// Initialize logger
const logger = createLogger({ prefix: 'PhotoshopActions', initialLevel: 'DEBUG' });

/**
 * Action creator for when a Photoshop document is loaded or activated
 * @param {Object} document - Photoshop document object
 */
export const loadDocument = (document) => {
  logger.debug('Loading document', document.name);
  
  return {
    type: types.DOCUMENT_LOADED,
    payload: {
      name: document.name,
      id: document.id,
      width: document.width,
      height: document.height,
      resolution: document.resolution,
      layers: document.layers?.length || 0,
      mode: document.mode
    }
  };
};

/**
 * Action creator for when a Photoshop document is closed
 */
export const documentClosed = () => {
  logger.debug('Document closed');
  
  return {
    type: types.DOCUMENT_CLOSED
  };
};

/**
 * Execute a Photoshop operation inside a modal context
 * This is a thunk action creator that handles the asynchronous nature of Photoshop operations
 * 
 * @param {Function} operation - Function that performs the Photoshop operation
 * @param {String} commandName - Name of the command for Photoshop history
 * @param {Object} options - Additional options for the operation
 */
export const executePhotoshopOperation = (operation, commandName, options = {}) => {
  return async (dispatch) => {
    // Import Photoshop core module here to avoid circular dependencies
    const { core } = require('photoshop');
    
    dispatch({
      type: types.PS_ACTION_START,
      payload: { commandName }
    });
    
    try {
      // Execute operation inside a modal context
      const result = await core.executeAsModal(async () => {
        return await operation();
      }, { 
        commandName: commandName || 'Photoshop Operation'
      });
      
      dispatch({
        type: types.PS_ACTION_SUCCESS,
        payload: { 
          commandName,
          result
        }
      });
      
      return result;
    } catch (error) {
      logger.error(`Photoshop operation failed: ${commandName}`, error);
      
      dispatch({
        type: types.PS_ACTION_FAILURE,
        payload: {
          commandName,
          error: error.message
        }
      });
      
      throw error; // Re-throw so calling code can handle the error
    }
  };
};

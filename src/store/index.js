// src/store/index.js
import { createStore, applyMiddleware, combineReducers } from 'redux';
import { thunk } from 'redux-thunk';
import { createLogger } from 'redux-logger';
import editorReducer from './reducers/editorReducer.js';
import uiReducer from './reducers/uiReducer.js';
import builderReducer from './reducers/builderReducer.js';
import documentReducer from './reducers/documentReducer.js';
import photoshopReducer from './reducers/photoshopReducer.js';
import { photoshopMiddleware } from './middleware/photoshopMiddleware.js';
import { selectionMiddleware } from './middleware/selectionMiddleware.js';

// Combine all reducers
const rootReducer = combineReducers({
  editor: editorReducer,
  ui: uiReducer,
  builder: builderReducer,
  document: documentReducer,
  photoshop: photoshopReducer
});

// Configure middleware
const logger = createLogger({
  collapsed: true,
  predicate: (getState, action) => {
    // Filter out certain frequent actions from logging if needed
    // return action.type !== 'SOME_FREQUENT_ACTION';
    return true;
  }
});

/**
 * Initialize Redux store with middleware for UXP environment
 * Configured with:
 * - Redux Thunk for async actions
 * - Selection middleware for processing selection events
 * - Photoshop middleware for UXP API operations
 * - Redux Logger for development debugging (can be disabled in production)
 */
const store = createStore(
  rootReducer,
  applyMiddleware(
    thunk,
    selectionMiddleware, // Process selections first
    photoshopMiddleware, // Then handle Photoshop API calls
    logger // Log after all other middleware
  )
);

export default store;

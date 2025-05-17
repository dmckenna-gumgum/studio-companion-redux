// src/store/reducers/index.js
import { combineReducers } from 'redux';
import editorReducer from './editorReducer.js';
import builderReducer from './builderReducer.js';
import uiReducer from './uiReducer.js';
import photoshopReducer from './photoshopReducer.js';

/**
 * Root reducer combining all state slices
 */
const rootReducer = combineReducers({
  editor: editorReducer,
  builder: builderReducer,
  ui: uiReducer,
  photoshop: photoshopReducer
});

export default rootReducer;

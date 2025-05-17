// src/store/actions/actionTypes.js

/**
 * Editor action types
 */
export const SELECT_LAYERS = 'SELECT_LAYERS';
export const SELECT_LAYERS_BY_NAME = 'SELECT_LAYERS_BY_NAME';
export const SET_FILTER = 'SET_FILTER';
export const UPDATE_SCOPE_FILTER = 'UPDATE_SCOPE_FILTER';
export const TOGGLE_AUTO_LINK = 'TOGGLE_AUTO_LINK';
export const LINK_LAYERS = 'LINK_LAYERS';
export const UNLINK_LAYERS = 'UNLINK_LAYERS';
export const UPDATE_SELECTION = 'UPDATE_SELECTION';

/**
 * Selection action types
 */
export const SELECTION_CHANGED = 'SELECTION_CHANGED';
export const SELECTION_PROCESSED = 'SELECTION_PROCESSED';
export const LAYERS_LINKED = 'LAYERS_LINKED';
export const LAYERS_UNLINKED = 'LAYERS_UNLINKED';

/**
 * Builder action types
 */
export const SET_BUILD_STEP = 'SET_BUILD_STEP';
export const INCREMENT_STEP = 'INCREMENT_STEP';
export const DECREMENT_STEP = 'DECREMENT_STEP';
export const UPDATE_CREATIVE = 'UPDATE_CREATIVE';
export const ADD_TO_HISTORY = 'ADD_TO_HISTORY';
export const RESTORE_HISTORY_STATE = 'RESTORE_HISTORY_STATE';
export const CLEAR_HISTORY = 'CLEAR_HISTORY';

/**
 * UI action types
 */
export const SET_ACTIVE_MODE = 'SET_ACTIVE_MODE';
export const TOGGLE_PANEL = 'TOGGLE_PANEL';
export const SHOW_NOTIFICATION = 'SHOW_NOTIFICATION';
export const HIDE_NOTIFICATION = 'HIDE_NOTIFICATION';

/**
 * Photoshop UXP action types
 */
export const PS_ACTION_START = 'PS_ACTION_START';
export const PS_ACTION_SUCCESS = 'PS_ACTION_SUCCESS';
export const PS_ACTION_FAILURE = 'PS_ACTION_FAILURE';

/**
 * Document action types
 */
export const DOCUMENT_LOADED = 'DOCUMENT_LOADED';
export const DOCUMENT_CLOSED = 'DOCUMENT_CLOSED';
export const SET_ACTIVE_DOCUMENT = 'SET_ACTIVE_DOCUMENT';
export const UPDATE_DOCUMENT_INFO = 'UPDATE_DOCUMENT_INFO';
export const SET_DOCUMENT_STATUS = 'SET_DOCUMENT_STATUS';
export const SET_THEME = 'SET_THEME';

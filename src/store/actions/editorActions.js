// src/store/actions/editorActions.js
import * as types from './actionTypes.js';

/**
 * Updates the selected layers in the editor
 * @param {Array} layers - Array of layer objects
 */
export const selectLayers = (layers) => ({
  type: types.SELECT_LAYERS,
  payload: layers
});

/**
 * Sets the filter for layer visibility
 * @param {RegExp|String} filter - Filter regex or string
 */
export const setFilter = (filter) => ({
  type: types.SET_FILTER,
  payload: filter
});

/**
 * Updates scope filters
 * @param {Object} filter - Filter object with name and active properties
 * @param {Boolean} add - Whether to add or remove the filter
 */
export const updateScopeFilter = (filter, add) => ({
  type: types.UPDATE_SCOPE_FILTER,
  payload: { filter, add }
});

/**
 * Toggles the auto-link feature
 * @param {Boolean} enabled - Whether auto-link is enabled
 */
export const toggleAutoLink = (enabled) => ({
  type: types.TOGGLE_AUTO_LINK,
  payload: enabled
});

/**
 * Updates the current selection state
 * @param {Object} selection - Selection state object
 */
export const updateSelection = (selection) => ({
  type: types.UPDATE_SELECTION,
  payload: selection
});

/**
 * Links selected layers in Photoshop
 * @param {Array} layers - Array of layer objects to link
 */
export const linkLayers = (layers) => ({
  type: types.LINK_LAYERS,
  payload: layers,
  meta: {
    photoshop: true,
    operation: 'link'
  }
});

/**
 * Unlinks selected layers in Photoshop
 * @param {Array} layers - Array of layer objects to unlink
 */
export const unlinkLayers = (layers) => ({
  type: types.UNLINK_LAYERS,
  payload: layers,
  meta: {
    photoshop: true,
    commandName: 'Unlink Layers'
  }
});

/**
 * Selects all layers with names matching the currently selected layers
 * @param {Object} options - Options for layer selection
 * @param {RegExp} [options.filter] - Optional filter regexp
 */
export const selectLayersByName = (options = {}) => ({
  type: types.SELECT_LAYERS_BY_NAME,
  payload: options,
  meta: {
    photoshop: true,
    commandName: 'Select Layers By Name'
  }
});

// src/store/actions/selectionActions.js
import * as types from './actionTypes.js';

/**
 * Dispatched when the active layer selection changes in Photoshop
 * @param {Array} layers - The newly selected layers
 */
export const selectionChanged = (layers) => ({
  type: types.SELECTION_CHANGED,
  payload: layers
});

/**
 * Dispatched after raw selection is processed with viability, type, etc.
 * @param {Object} selectionData - Processed selection information
 * @param {Array} selectionData.layers - Selected layer objects
 * @param {Boolean} selectionData.viable - Is selection viable for operations
 * @param {Boolean} selectionData.identical - Is selection identical to previous
 * @param {Boolean} selectionData.sameGroup - Are all layers in same group
 * @param {Number} selectionData.parentGroupCount - Count of parent groups
 * @param {String} selectionData.type - Type of selection ('layer', 'group', 'mixed')
 */
export const selectionProcessed = (selectionData) => ({
  type: types.SELECTION_PROCESSED,
  payload: selectionData
});

/**
 * Dispatched when layers are linked successfully
 * @param {Array} layers - The linked layers
 */
export const layersLinked = (layers) => ({
  type: types.LAYERS_LINKED,
  payload: layers
});

/**
 * Dispatched when layers are unlinked successfully
 * @param {Array} layers - The unlinked layers
 */
export const layersUnlinked = (layers) => ({
  type: types.LAYERS_UNLINKED,
  payload: layers
});

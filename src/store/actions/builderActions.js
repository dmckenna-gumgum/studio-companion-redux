// src/store/actions/builderActions.js
import * as types from './actionTypes.js';

/**
 * Sets the current build step
 * @param {Number} stepNumber - Index of the step to set
 */
export const setBuildStep = (stepNumber) => ({
  type: types.SET_BUILD_STEP,
  payload: stepNumber
});

/**
 * Increments the build step by one
 */
export const incrementStep = () => ({
  type: types.INCREMENT_STEP
});

/**
 * Decrements the build step by one
 */
export const decrementStep = () => ({
  type: types.DECREMENT_STEP
});

/**
 * Updates the creative configuration
 * @param {Object} creativeData - Creative configuration data
 */
export const updateCreative = (creativeData) => ({
  type: types.UPDATE_CREATIVE,
  payload: creativeData
});

/**
 * Adds a snapshot to build history
 * @param {String} snapShotName - Name of the history snapshot
 * @param {Number} stepNumber - Build step number
 * @param {Object} historyState - State to save in history
 */
export const addToHistory = (snapShotName, stepNumber, historyState) => ({
  type: types.ADD_TO_HISTORY,
  payload: {
    name: snapShotName,
    step: stepNumber,
    state: historyState
  }
});

/**
 * Restores a state from history
 * @param {Number} historyIndex - Index in history to restore
 */
export const restoreHistoryState = (historyIndex) => ({
  type: types.RESTORE_HISTORY_STATE,
  payload: historyIndex
});

/**
 * Clears all history entries
 */
export const clearHistory = () => ({
  type: types.CLEAR_HISTORY
});

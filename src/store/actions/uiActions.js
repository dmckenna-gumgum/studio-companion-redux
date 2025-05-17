// src/store/actions/uiActions.js
import * as types from './actionTypes.js';

/**
 * Sets the active mode (editor/builder)
 * @param {String} mode - Mode to activate ('editor' or 'builder')
 */
export const setActiveMode = (mode) => ({
  type: types.SET_ACTIVE_MODE,
  payload: mode
});

/**
 * Toggles panel visibility
 * @param {String} panelId - ID of panel to toggle
 * @param {Boolean} isVisible - Panel visibility state
 */
export const togglePanel = (panelId, isVisible) => ({
  type: types.TOGGLE_PANEL,
  payload: {
    panelId,
    isVisible
  }
});

/**
 * Shows a notification to the user
 * @param {String} message - Notification message
 * @param {String} type - Notification type ('info', 'warning', 'error', 'success')
 * @param {Number} duration - Duration in ms to show notification (0 for persistent)
 */
export const showNotification = (message, type = 'info', duration = 3000) => ({
  type: types.SHOW_NOTIFICATION,
  payload: {
    id: Date.now(),
    message,
    type,
    duration
  }
});

/**
 * Hides a specific notification
 * @param {Number} notificationId - ID of notification to hide
 */
export const hideNotification = (notificationId) => ({
  type: types.HIDE_NOTIFICATION,
  payload: notificationId
});

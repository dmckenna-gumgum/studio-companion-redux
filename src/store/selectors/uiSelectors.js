// src/store/selectors/uiSelectors.js

/**
 * Basic selectors for UI state
 */
export const getUIState = state => state.ui;
export const getActiveMode = state => state.ui.activeMode;
export const getPanelVisibility = (state, panelId) => state.ui.panels[panelId];
export const getNotifications = state => state.ui.notifications;

/**
 * Computed selectors
 */
export const isEditorMode = state => getActiveMode(state) === 'editor';
export const isBuilderMode = state => getActiveMode(state) === 'builder';

export const getActiveNotifications = state => {
  const now = Date.now();
  
  return getNotifications(state).filter(notification => {
    // Filter out expired notifications (if they have a duration)
    return notification.duration === 0 || 
           (notification.timestamp + notification.duration > now);
  });
};

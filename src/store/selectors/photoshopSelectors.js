// src/store/selectors/photoshopSelectors.js

/**
 * Basic selectors for Photoshop state
 */
export const getPhotoshopState = state => state.photoshop;
export const getActiveDocument = state => state.photoshop.document;
export const isDocumentOpen = state => state.photoshop.isDocumentOpen;
export const getTheme = state => state.photoshop.theme;
export const getPendingOperations = state => state.photoshop.pendingOperations;
export const getOperationError = state => state.photoshop.operationError;
export const getLastOperation = state => state.photoshop.lastOperation;

/**
 * Computed selectors
 */
export const getDocumentName = state => {
  const document = getActiveDocument(state);
  return document ? document.name : null;
};

export const getDocumentDimensions = state => {
  const document = getActiveDocument(state);
  return document 
    ? { width: document.width, height: document.height } 
    : { width: 0, height: 0 };
};

export const isOperationInProgress = state => {
  return getPendingOperations(state).length > 0;
};

/**
 * Helper selectors for UI components
 */
export const getHeaderTitle = state => {
  // Get required state
  const document = getActiveDocument(state);
  const activeMode = state.ui.activeMode;
  
  // No document case
  if (!document) {
    return 'No document open';
  }
  
  // Generate title based on active mode
  switch (activeMode) {
    case 'editor':
      return `<span style="font-weight: bold">Editing:</span> ${document.name}`;
    case 'builder':
      const currentStep = state.builder.currentStep;
      return `<span style="font-weight: bold">Building:</span> Step ${currentStep + 1}`;
    case 'production':
      return `<span style="font-weight: bold">Finalizing:</span> ${document.name}`;
    default:
      return 'Studio Companion';
  }
};

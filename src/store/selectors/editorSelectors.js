// src/store/selectors/editorSelectors.js

/**
 * Basic selectors for editor state
 */
export const getEditorState = state => state.editor;
export const getCurrentSelection = state => state.editor.currentSelection;
export const getSelectedLayers = state => state.editor.currentSelection.layers;
export const getLinkedLayers = state => state.editor.linkedLayers;
export const getFilterRegex = state => state.editor.filterRegex;
export const getScopeFilters = state => state.editor.scopeFilters;
export const getAutoLinkEnabled = state => state.editor.autoLink.enabled;

/**
 * Computed selectors
 */
export const getSelectedLayerIds = state => 
  getSelectedLayers(state).map(layer => layer.id);

export const getSelectionIsViable = state => 
  getCurrentSelection(state).viable;

export const getSelectionIsIdentical = state => 
  getCurrentSelection(state).identical;

export const getSelectionHasSameGroup = state => 
  getCurrentSelection(state).sameGroup;

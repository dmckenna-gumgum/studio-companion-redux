// src/store/selectors/builderSelectors.js

/**
 * Basic selectors for builder state
 */
export const getBuilderState = state => state.builder;
export const getCurrentStep = state => state.builder.currentStep;
export const getBuildSteps = state => state.builder.buildSteps;
export const getCreativeState = state => state.builder.creative;
export const getBuildHistory = state => state.builder.buildHistory;
export const getCurrentHistoryIndex = state => state.builder.buildHistory.current;

/**
 * Computed selectors
 */
export const getCurrentBuildStep = state => {
  const steps = getBuildSteps(state);
  const currentIndex = getCurrentStep(state);
  return steps[currentIndex] || null;
};

export const getStepProgress = state => {
  const steps = getBuildSteps(state);
  const currentIndex = getCurrentStep(state);
  
  return {
    current: currentIndex + 1,
    total: steps.length,
    percentage: steps.length > 0 ? (currentIndex + 1) / steps.length * 100 : 0
  };
};

export const getCurrentHistoryEntry = state => {
  const history = getBuildHistory(state).history;
  const currentIndex = getCurrentHistoryIndex(state);
  
  return currentIndex >= 0 && currentIndex < history.length
    ? history[currentIndex]
    : null;
};

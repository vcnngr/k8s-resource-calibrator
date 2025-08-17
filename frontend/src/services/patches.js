import { apiClient } from './api';

export const getPatches = (params = {}) => {
  return apiClient.get('/patches', params);
};

export const generatePatches = (recommendation_ids, strategy, is_cumulative = false) => {
  return apiClient.post('/patches/generate', {
    recommendation_ids,
    strategy,
    is_cumulative
  });
};

export const applyPatches = (patches, options = {}) => {
  return apiClient.post('/patches/apply', {
    patches,
    ...options
  });
};

export const rollbackPatch = (patchId) => {
  return apiClient.post(`/patches/${patchId}/rollback`);
};

export const getPatchStrategies = () => {
  return apiClient.get('/patches/strategies');
};
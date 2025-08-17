import { apiClient } from './api';

export const getRecommendations = (params = {}) => {
  return apiClient.get('/recommendations', params);
};

export const getRecommendation = (id) => {
  return apiClient.get(`/recommendations/${id}`);
};

export const getRecommendationsOverview = (params = {}) => {
  return apiClient.get('/recommendations/stats/overview', params);
};

export const bulkSelectRecommendations = (filters, operation) => {
  return apiClient.post('/recommendations/bulk-select', { filters, operation });
};
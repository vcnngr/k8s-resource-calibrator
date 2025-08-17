import { apiClient } from './api';

export const getScans = (params = {}) => {
  return apiClient.get('/scans', params);
};

export const getScan = (id) => {
  return apiClient.get(`/scans/${id}`);
};

export const uploadScan = (file, metadata) => {
  return apiClient.uploadFile('/scans/upload', file, metadata);
};

export const deleteScan = (id) => {
  return apiClient.delete(`/scans/${id}`);
};

export const getScanSummary = (id) => {
  return apiClient.get(`/scans/${id}/summary`);
};
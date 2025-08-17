import { useState, useCallback } from 'react';
import { getScans, uploadScan, deleteScan } from '../services/scans';
import { useApp } from '../context/AppContext';

export const useScans = () => {
const { scans, setScans, setLoading, setError, showSuccess, showError } = useApp();
const [refreshing, setRefreshing] = useState(false);

const fetchScans = useCallback(async (params = {}) => {
try {
setLoading(true);
const response = await getScans(params);
setScans(response);
} catch (error) {
setError(error.message);
} finally {
setLoading(false);
}
}, [setScans, setLoading, setError]);

const refreshScans = useCallback(async (params = {}) => {
try {
setRefreshing(true);
const response = await getScans(params);
setScans(response);
} catch (error) {
showError('Failed to refresh scans');
} finally {
setRefreshing(false);
}
}, [setScans, showError]);

const uploadNewScan = useCallback(async (file, metadata) => {
try {
setLoading(true);
const response = await uploadScan(file, metadata);

if (response.success) {
showSuccess(`Scan uploaded successfully! ${response.data.recommendations_count} recommendations processed.`);
// Refresh scans list
await refreshScans();
return response;
} else {
throw new Error(response.error);
}
} catch (error) {
showError(`Upload failed: ${error.message}`);
throw error;
} finally {
setLoading(false);
}
}, [setLoading, showSuccess, showError, refreshScans]);

const removeScan = useCallback(async (scanId) => {
try {
setLoading(true);
await deleteScan(scanId);
showSuccess('Scan deleted successfully');
await refreshScans();
} catch (error) {
showError(`Failed to delete scan: ${error.message}`);
} finally {
setLoading(false);
}
}, [setLoading, showSuccess, showError, refreshScans]);

return {
scans,
refreshing,
fetchScans,
refreshScans,
uploadNewScan,
removeScan
};
};
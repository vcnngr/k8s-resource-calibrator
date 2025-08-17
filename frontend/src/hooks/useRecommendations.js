import { useState, useEffect, useCallback } from 'react';
import {
getRecommendations,
getRecommendationsOverview,
bulkSelectRecommendations
} from '../services/recommendations';
import { useApp } from '../context/AppContext';

export const useRecommendations = () => {
const {
recommendations,
selectedRecommendations,
filters,
pagination,
setRecommendations,
selectRecommendation,
deselectRecommendation,
clearSelectedRecommendations,
setFilters,
setPagination,
setLoading,
setError,
showError
} = useApp();

const [overview, setOverview] = useState(null);

const fetchRecommendations = useCallback(async (params = {}) => {
try {
setLoading(true);
const queryParams = {
...filters,
...pagination,
...params
};
const response = await getRecommendations(queryParams);
setRecommendations(response);

if (response.pagination) {
setPagination(response.pagination);
}
} catch (error) {
setError(error.message);
} finally {
setLoading(false);
}
}, [filters, pagination, setRecommendations, setPagination, setLoading, setError]);

const fetchOverview = useCallback(async (params = {}) => {
try {
const response = await getRecommendationsOverview(params);
setOverview(response.data);
} catch (error) {
showError('Failed to load overview data');
}
}, [showError]);

const applyFilters = useCallback((newFilters) => {
setFilters(newFilters);
setPagination({ ...pagination, page: 1 }); // Reset to first page
}, [setFilters, setPagination, pagination]);

const changePage = useCallback((page) => {
setPagination({ ...pagination, page });
}, [setPagination, pagination]);

const toggleRecommendationSelection = useCallback((recommendation) => {
const isSelected = selectedRecommendations.some(r => r.id === recommendation.id);

if (isSelected) {
deselectRecommendation(recommendation);
} else {
selectRecommendation(recommendation);
}
}, [selectedRecommendations, selectRecommendation, deselectRecommendation]);

const selectAllVisible = useCallback(() => {
recommendations.forEach(rec => {
if (!selectedRecommendations.some(r => r.id === rec.id)) {
selectRecommendation(rec);
}
});
}, [recommendations, selectedRecommendations, selectRecommendation]);

const bulkSelect = useCallback(async (bulkFilters, operation) => {
try {
setLoading(true);
const response = await bulkSelectRecommendations(bulkFilters, operation);

// Add all returned recommendations to selection
response.data.recommendations.forEach(rec => {
if (!selectedRecommendations.some(r => r.id === rec.id)) {
selectRecommendation(rec);
}
});

return response.data;
} catch (error) {
showError(`Bulk selection failed: ${error.message}`);
throw error;
} finally {
setLoading(false);
}
}, [selectedRecommendations, selectRecommendation, setLoading, showError]);

// Automatically fetch recommendations when filters or pagination change
useEffect(() => {
fetchRecommendations();
}, [fetchRecommendations]);

return {
recommendations,
selectedRecommendations,
overview,
filters,
pagination,
fetchRecommendations,
fetchOverview,
applyFilters,
changePage,
toggleRecommendationSelection,
selectAllVisible,
clearSelectedRecommendations,
bulkSelect
};
};
import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Initial state
const initialState = {
// UI state
loading: false,
error: null,
notifications: [],

// Data state
scans: [],
recommendations: [],
patches: [],
selectedRecommendations: [],

// Filters
filters: {
cluster_id: '',
namespace: '',
priority: '',
resource_type: ''
},

// Pagination
pagination: {
page: 1,
limit: 50,
total: 0
},

// User preferences
preferences: {
theme: 'light',
autoRefresh: false,
refreshInterval: 30000
}
};

// Action types
const ActionTypes = {
SET_LOADING: 'SET_LOADING',
SET_ERROR: 'SET_ERROR',
CLEAR_ERROR: 'CLEAR_ERROR',
ADD_NOTIFICATION: 'ADD_NOTIFICATION',
REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',

SET_SCANS: 'SET_SCANS',
ADD_SCAN: 'ADD_SCAN',
UPDATE_SCAN: 'UPDATE_SCAN',
DELETE_SCAN: 'DELETE_SCAN',

SET_RECOMMENDATIONS: 'SET_RECOMMENDATIONS',
SELECT_RECOMMENDATION: 'SELECT_RECOMMENDATION',
DESELECT_RECOMMENDATION: 'DESELECT_RECOMMENDATION',
CLEAR_SELECTED_RECOMMENDATIONS: 'CLEAR_SELECTED_RECOMMENDATIONS',

SET_PATCHES: 'SET_PATCHES',
ADD_PATCH: 'ADD_PATCH',
UPDATE_PATCH: 'UPDATE_PATCH',

SET_FILTERS: 'SET_FILTERS',
SET_PAGINATION: 'SET_PAGINATION',
SET_PREFERENCES: 'SET_PREFERENCES'
};

// Reducer function
const appReducer = (state, action) => {
switch (action.type) {
case ActionTypes.SET_LOADING:
return {
...state,
loading: action.payload
};

case ActionTypes.SET_ERROR:
return {
...state,
error: action.payload,
loading: false
};

case ActionTypes.CLEAR_ERROR:
return {
...state,
error: null
};

case ActionTypes.ADD_NOTIFICATION:
return {
...state,
notifications: [...state.notifications, {
id: Date.now(),
...action.payload
}]
};

case ActionTypes.REMOVE_NOTIFICATION:
return {
...state,
notifications: state.notifications.filter(n => n.id !== action.payload)
};

case ActionTypes.SET_SCANS:
return {
...state,
scans: action.payload.data || [],
pagination: {
...state.pagination,
total: action.payload.total || 0
}
};

case ActionTypes.ADD_SCAN:
return {
...state,
scans: [action.payload, ...state.scans]
};

case ActionTypes.UPDATE_SCAN:
return {
...state,
scans: state.scans.map(scan =>
scan.id === action.payload.id ? action.payload : scan
)
};

case ActionTypes.DELETE_SCAN:
return {
...state,
scans: state.scans.filter(scan => scan.id !== action.payload)
};

case ActionTypes.SET_RECOMMENDATIONS:
return {
...state,
recommendations: action.payload.data || [],
pagination: {
...state.pagination,
total: action.payload.total || 0
}
};

case ActionTypes.SELECT_RECOMMENDATION:
return {
...state,
selectedRecommendations: [...state.selectedRecommendations, action.payload]
};

case ActionTypes.DESELECT_RECOMMENDATION:
return {
...state,
selectedRecommendations: state.selectedRecommendations.filter(
rec => rec.id !== action.payload.id
)
};

case ActionTypes.CLEAR_SELECTED_RECOMMENDATIONS:
return {
...state,
selectedRecommendations: []
};

case ActionTypes.SET_PATCHES:
return {
...state,
patches: action.payload.data || []
};

case ActionTypes.ADD_PATCH:
return {
...state,
patches: [action.payload, ...state.patches]
};

case ActionTypes.UPDATE_PATCH:
return {
...state,
patches: state.patches.map(patch =>
patch.id === action.payload.id ? action.payload : patch
)
};

case ActionTypes.SET_FILTERS:
return {
...state,
filters: {
...state.filters,
...action.payload
}
};

case ActionTypes.SET_PAGINATION:
return {
...state,
pagination: {
...state.pagination,
...action.payload
}
};

case ActionTypes.SET_PREFERENCES:
return {
...state,
preferences: {
...state.preferences,
...action.payload
}
};

default:
return state;
}
};

// Create context
const AppContext = createContext();

// Provider component
export const AppProvider = ({ children }) => {
const [state, dispatch] = useReducer(appReducer, initialState);

// Load preferences from localStorage on mount
useEffect(() => {
const savedPreferences = localStorage.getItem('krr-preferences');
if (savedPreferences) {
try {
const preferences = JSON.parse(savedPreferences);
dispatch({
type: ActionTypes.SET_PREFERENCES,
payload: preferences
});
} catch (error) {
console.warn('Failed to load preferences:', error);
}
}
}, []);

// Save preferences to localStorage when they change
useEffect(() => {
localStorage.setItem('krr-preferences', JSON.stringify(state.preferences));
}, [state.preferences]);

// Auto-refresh functionality
useEffect(() => {
if (!state.preferences.autoRefresh) return;

const interval = setInterval(() => {
// Refresh current data based on current route
// This would be implemented based on your routing logic
console.log('Auto-refreshing data...');
}, state.preferences.refreshInterval);

return () => clearInterval(interval);
}, [state.preferences.autoRefresh, state.preferences.refreshInterval]);

// Action creators
const actions = {
setLoading: (loading) => dispatch({
type: ActionTypes.SET_LOADING,
payload: loading
}),

setError: (error) => dispatch({
type: ActionTypes.SET_ERROR,
payload: error
}),

clearError: () => dispatch({
type: ActionTypes.CLEAR_ERROR
}),

addNotification: (notification) => dispatch({
type: ActionTypes.ADD_NOTIFICATION,
payload: notification
}),

removeNotification: (id) => dispatch({
type: ActionTypes.REMOVE_NOTIFICATION,
payload: id
}),

showSuccess: (message) => dispatch({
type: ActionTypes.ADD_NOTIFICATION,
payload: { type: 'success', message }
}),

showError: (message) => dispatch({
type: ActionTypes.ADD_NOTIFICATION,
payload: { type: 'error', message }
}),

showWarning: (message) => dispatch({
type: ActionTypes.ADD_NOTIFICATION,
payload: { type: 'warning', message }
}),

setScans: (scans) => dispatch({
type: ActionTypes.SET_SCANS,
payload: scans
}),

addScan: (scan) => dispatch({
type: ActionTypes.ADD_SCAN,
payload: scan
}),

setRecommendations: (recommendations) => dispatch({
type: ActionTypes.SET_RECOMMENDATIONS,
payload: recommendations
}),

selectRecommendation: (recommendation) => dispatch({
type: ActionTypes.SELECT_RECOMMENDATION,
payload: recommendation
}),

deselectRecommendation: (recommendation) => dispatch({
type: ActionTypes.DESELECT_RECOMMENDATION,
payload: recommendation
}),

clearSelectedRecommendations: () => dispatch({
type: ActionTypes.CLEAR_SELECTED_RECOMMENDATIONS
}),

setFilters: (filters) => dispatch({
type: ActionTypes.SET_FILTERS,
payload: filters
}),

setPagination: (pagination) => dispatch({
type: ActionTypes.SET_PAGINATION,
payload: pagination
}),

setPreferences: (preferences) => dispatch({
type: ActionTypes.SET_PREFERENCES,
payload: preferences
})
};

const value = {
...state,
...actions
};

return (
<AppContext.Provider value={value}>
  {children}
</AppContext.Provider>
);
};

// Custom hook to use the context
export const useApp = () => {
const context = useContext(AppContext);
if (!context) {
throw new Error('useApp must be used within an AppProvider');
}
return context;
};
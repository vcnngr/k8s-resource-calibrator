import { useState, useCallback } from 'react';
import {
generatePatches,
applyPatches,
rollbackPatch,
getPatchStrategies
} from '../services/patches';
import { useApp } from '../context/AppContext';

export const usePatches = () => {
const { showSuccess, showError, setLoading } = useApp();
const [generatedPatches, setGeneratedPatches] = useState([]);
const [strategies, setStrategies] = useState([]);

const fetchStrategies = useCallback(async () => {
try {
const response = await getPatchStrategies();
setStrategies(response.data);
} catch (error) {
showError('Failed to load patch strategies');
}
}, [showError]);

const generatePatchesForRecommendations = useCallback(async (
recommendationIds,
strategy = 'conservative',
isCumulative = false
) => {
try {
setLoading(true);
const response = await generatePatches(recommendationIds, strategy, isCumulative);

if (response.success) {
setGeneratedPatches(response.data.patches);
showSuccess(`Generated ${response.data.patches.length} patches successfully`);
return response.data;
} else {
throw new Error(response.error);
}
} catch (error) {
showError(`Patch generation failed: ${error.message}`);
throw error;
} finally {
setLoading(false);
}
}, [setLoading, showSuccess, showError]);

const applyGeneratedPatches = useCallback(async (patches, options = {}) => {
try {
setLoading(true);
const response = await applyPatches(patches, options);

if (response.success) {
const { successful_patches, total_patches, dry_run } = response.data;
const message = dry_run
? `Dry run completed: ${successful_patches}/${total_patches} patches would succeed`
: `Applied ${successful_patches}/${total_patches} patches successfully`;

showSuccess(message);

// Clear generated patches if real application was successful
if (!dry_run && successful_patches === total_patches) {
setGeneratedPatches([]);
}

return response.data;
} else {
throw new Error(response.error);
}
} catch (error) {
showError(`Patch application failed: ${error.message}`);
throw error;
} finally {
setLoading(false);
}
}, [setLoading, showSuccess, showError]);

const rollbackSinglePatch = useCallback(async (patchId) => {
try {
setLoading(true);
const response = await rollbackPatch(patchId);

if (response.success) {
showSuccess('Patch rolled back successfully');
return response.data;
} else {
throw new Error(response.error);
}
} catch (error) {
showError(`Rollback failed: ${error.message}`);
throw error;
} finally {
setLoading(false);
}
}, [setLoading, showSuccess, showError]);

const clearGeneratedPatches = useCallback(() => {
setGeneratedPatches([]);
}, []);

return {
generatedPatches,
strategies,
fetchStrategies,
generatePatchesForRecommendations,
applyGeneratedPatches,
rollbackSinglePatch,
clearGeneratedPatches
};
};
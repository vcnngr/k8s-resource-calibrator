import React, { useEffect, useState } from 'react';
import { useRecommendations } from '../../hooks/useRecommendations';
import RecommendationCard from './RecommendationCard';
import LoadingSpinner from '../common/Loading';

const RecommendationsList = () => {
const {
recommendations,
selectedRecommendations,
filters,
pagination,
fetchRecommendations,
applyFilters,
toggleRecommendationSelection,
clearSelectedRecommendations
} = useRecommendations();

const [loading, setLoading] = useState(true);

useEffect(() => {
const loadRecommendations = async () => {
setLoading(true);
await fetchRecommendations();
setLoading(false);
};

loadRecommendations();
}, [fetchRecommendations]);

const handleFilterChange = (key, value) => {
applyFilters({ ...filters, [key]: value });
};

if (loading) {
return (
<div className="flex justify-center items-center h-64">
  <LoadingSpinner size="lg" />
</div>
);
}

return (
<div className="space-y-6">
  {/* Header */}
  <div className="flex justify-between items-center">
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Raccomandazioni</h1>
      <p className="mt-2 text-gray-600">
        Ottimizzazioni suggerite per le risorse Kubernetes
      </p>
    </div>

    {selectedRecommendations.length > 0 && (
    <div className="flex space-x-4">
      <span className="text-sm text-gray-600">
        {selectedRecommendations.length} selezionate
      </span>
      <button onClick={clearSelectedRecommendations} className="text-sm text-blue-600 hover:text-blue-800">
        Deseleziona tutte
      </button>
    </div>
    )}
  </div>

  {/* Filters */}
  <div className="bg-white p-4 rounded-lg shadow space-y-4 md:space-y-0 md:flex md:space-x-4">
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Priorità
      </label>
      <select value={filters.priority} onChange={(e)=> handleFilterChange('priority', e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2
        focus:ring-blue-500"
        >
        <option value="">Tutte le priorità</option>
        <option value="CRITICAL">Critica</option>
        <option value="HIGH">Alta</option>
        <option value="MEDIUM">Media</option>
        <option value="LOW">Bassa</option>
      </select>
    </div>

    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Namespace
      </label>
      <input type="text" value={filters.namespace} onChange={(e)=> handleFilterChange('namespace', e.target.value)}
      placeholder="Filtra per namespace..."
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>

    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tipo Risorsa
      </label>
      <select value={filters.resource_type} onChange={(e)=> handleFilterChange('resource_type', e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2
        focus:ring-blue-500"
        >
        <option value="">Tutti i tipi</option>
        <option value="Deployment">Deployment</option>
        <option value="StatefulSet">StatefulSet</option>
        <option value="DaemonSet">DaemonSet</option>
        <option value="Job">Job</option>
        <option value="CronJob">CronJob</option>
      </select>
    </div>
  </div>

  {/* Recommendations */}
  <div className="space-y-4">
    {recommendations.length === 0 ? (
    <div className="text-center py-12 bg-white rounded-lg shadow">
      <p className="text-gray-500">Nessuna raccomandazione trovata</p>
    </div>
    ) : (
    recommendations.map((recommendation) => (
    <RecommendationCard key={recommendation.id} recommendation={recommendation} onSelect={toggleRecommendationSelection}
      selected={selectedRecommendations.some(r=> r.id === recommendation.id)}
      />
      ))
      )}
  </div>

  {/* Pagination */}
  {pagination.total > pagination.limit && (
  <div className="flex justify-center">
    <div className="text-sm text-gray-600">
      Mostrando {recommendations.length} di {pagination.total} raccomandazioni
    </div>
  </div>
  )}
</div>
);
};

export default RecommendationsList;
import React, { useEffect, useState } from 'react';
import { getPatches } from '../../services/patches';
import LoadingSpinner from '../common/Loading';

const PatchHistory = () => {
const [patches, setPatches] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
const loadPatches = async () => {
try {
setLoading(true);
const response = await getPatches();
setPatches(response.data || []);
} catch (err) {
setError(err.message);
} finally {
setLoading(false);
}
};

loadPatches();
}, []);

const getStatusColor = (status) => {
switch (status) {
case 'applied': return 'text-green-600 bg-green-100';
case 'failed': return 'text-red-600 bg-red-100';
case 'rolled_back': return 'text-yellow-600 bg-yellow-100';
default: return 'text-gray-600 bg-gray-100';
}
};

if (loading) {
return (
<div className="flex justify-center items-center h-64">
  <LoadingSpinner size="lg" />
</div>
);
}

if (error) {
return (
<div className="text-center text-red-600">
  Error loading patches: {error}
</div>
);
}

return (
<div className="space-y-6">
  {/* Header */}
  <div>
    <h1 className="text-3xl font-bold text-gray-900">Cronologia Patch</h1>
    <p className="mt-2 text-gray-600">
      Storico delle patch applicate alle risorse Kubernetes
    </p>
  </div>

  {/* Patches List */}
  <div className="bg-white shadow overflow-hidden rounded-lg">
    {patches.length === 0 ? (
    <div className="text-center py-12">
      <p className="text-gray-500">Nessuna patch applicata</p>
    </div>
    ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risorsa
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Container
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Stato
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Applicata il
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Applicata da
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {patches.map((patch) => (
          <tr key={patch.id} className="hover:bg-gray-50">
            <td className="px-6 py-4 whitespace-nowrap">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {patch.namespace}/{patch.resource_name}
                </div>
                <div className="text-sm text-gray-500">
                  {patch.resource_type}
                </div>
              </div>
            </td>

            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {patch.container_name}
            </td>

            <td className="px-6 py-4 whitespace-nowrap">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
                ${getStatusColor(patch.status)}`}>
                {patch.status}
              </span>
            </td>

            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {patch.applied_at ? new Date(patch.applied_at).toLocaleString() : 'N/A'}
            </td>

            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {patch.applied_by || 'Sistema'}
            </td>
          </tr>
          ))}
        </tbody>
      </table>
    </div>
    )}
  </div>
</div>
);
};

export default PatchHistory;
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getScan, getScanSummary } from '../../services/scans';
import LoadingSpinner from '../common/Loading';

const ScanDetails = () => {
const { id } = useParams();
const [scan, setScan] = useState(null);
const [summary, setSummary] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
const loadScanDetails = async () => {
try {
setLoading(true);
const [scanResponse, summaryResponse] = await Promise.all([
getScan(id),
getScanSummary(id)
]);

setScan(scanResponse.data);
setSummary(summaryResponse.data);
} catch (err) {
setError(err.message);
} finally {
setLoading(false);
}
};

loadScanDetails();
}, [id]);

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
  Error loading scan: {error}
</div>
);
}

return (
<div className="space-y-6">
  {/* Header */}
  <div className="flex items-center space-x-4">
    <Link to="/scans" className="text-gray-500 hover:text-gray-700">
    <ArrowLeftIcon className="h-6 w-6" />
    </Link>
    <div>
      <h1 className="text-3xl font-bold text-gray-900">
        {scan?.scan_id}
      </h1>
      <p className="text-gray-600">
        Dettagli scansione KRR
      </p>
    </div>
  </div>

  {/* Scan Info */}
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">
      Informazioni Scansione
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <dt className="text-sm font-medium text-gray-500">Cluster ID</dt>
        <dd className="text-sm text-gray-900">{scan?.cluster_id}</dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-gray-500">Data Scansione</dt>
        <dd className="text-sm text-gray-900">
          {scan?.scan_date ? new Date(scan.scan_date).toLocaleString() : 'N/A'}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-gray-500">Stato</dt>
        <dd className="text-sm text-gray-900">{scan?.scan_status}</dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-gray-500">Prometheus URL</dt>
        <dd className="text-sm text-gray-900">{scan?.prometheus_url || 'N/A'}</dd>
      </div>
    </div>
  </div>

  {/* Summary */}
  {summary && (
  <div className="bg-white shadow rounded-lg p-6">
    <h2 className="text-lg font-medium text-gray-900 mb-4">
      Riassunto Raccomandazioni
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">
          {summary.scan_info?.total_recommendations || 0}
        </div>
        <div className="text-sm text-gray-500">Totale Raccomandazioni</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">
          {summary.potential_savings?.total_cpu_millicores || 0}m
        </div>
        <div className="text-sm text-gray-500">CPU Risparmio</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {Math.round((summary.potential_savings?.total_memory_bytes || 0) / 1024 / 1024)}MB
        </div>
        <div className="text-sm text-gray-500">Memory Risparmio</div>
      </div>
    </div>
  </div>
  )}

  {/* Actions */}
  <div className="flex space-x-4">
    <Link to={`/recommendations?scan_id=${id}`} className="btn-primary">
    Vedi Raccomandazioni
    </Link>
  </div>
</div>
);
};

export default ScanDetails;
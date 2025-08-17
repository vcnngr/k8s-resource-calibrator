import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DocumentTextIcon,
  LightBulbIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useRecommendations } from '../../hooks/useRecommendations';
import { useScans } from '../../hooks/useScans';
import LoadingSpinner from '../common/Loading';

const StatCard = ({ title, value, subtitle, icon: Icon, color, link }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    red: 'text-red-600 bg-red-100'
  };

  const content = (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className={`h-6 w-6 ${colorClasses[color]}`} />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value}
              </dd>
              {subtitle && (
                <dd className="text-sm text-gray-500">
                  {subtitle}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

const Dashboard = () => {
  const { overview, fetchOverview } = useRecommendations();
  const { scans, fetchScans } = useScans();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchOverview(),
          fetchScans({ limit: 5 })
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchOverview, fetchScans]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const formatCPU = (milliCores) => {
    if (!milliCores) return '0';
    return milliCores >= 1000 ? `${(milliCores / 1000).toFixed(1)} CPU` : `${milliCores}m`;
  };

  const formatMemory = (bytes) => {
    if (!bytes) return '0';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Panoramica delle raccomandazioni KRR e ottimizzazioni delle risorse
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Scansioni Totali"
          value={scans.length}
          subtitle="Scansioni caricate"
          icon={DocumentTextIcon}
          color="blue"
          link="/scans"
        />
        
        <StatCard
          title="Raccomandazioni"
          value={overview?.total_recommendations || 0}
          subtitle="Ottimizzazioni disponibili"
          icon={LightBulbIcon}
          color="yellow"
          link="/recommendations"
        />
        
        <StatCard
          title="Priorità Alta"
          value={overview?.by_priority?.HIGH || 0}
          subtitle="Richiedono attenzione"
          icon={ExclamationTriangleIcon}
          color="red"
          link="/recommendations?priority=HIGH"
        />
        
        <StatCard
          title="Patch Applicate"
          value="0" // TODO: Implement patch counting
          subtitle="Ottimizzazioni attive"
          icon={WrenchScrewdriverIcon}
          color="green"
          link="/patches"
        />
      </div>

      {/* Savings Overview */}
      {overview?.potential_savings && (
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Risparmi Potenziali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCPU(overview.potential_savings.total_cpu_millicores)}
                </div>
                <div className="text-sm text-gray-500">CPU Risparmio</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatMemory(overview.potential_savings.total_memory_bytes)}
                </div>
                <div className="text-sm text-gray-500">Memory Risparmio</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Scansioni Recenti
            </h3>
            <Link
              to="/scans"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Vedi tutte →
            </Link>
          </div>
        </div>
        
        {scans.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Nessuna scansione disponibile
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {scans.slice(0, 5).map((scan) => (
              <li key={scan.id}>
                <Link 
                  to={`/scans/${scan.id}`}
                  className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {scan.scan_id}
                        </p>
                        <p className="text-sm text-gray-500">
                          {scan.cluster_id} • {new Date(scan.scan_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {scan.Recommendations?.length || 0} raccomandazioni
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Priority Breakdown */}
      {overview?.by_priority && (
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Raccomandazioni per Priorità
            </h3>
            <div className="space-y-3">
              {Object.entries(overview.by_priority).map(([priority, count]) => {
                const colors = {
                  CRITICAL: 'bg-red-500',
                  HIGH: 'bg-orange-500',
                  MEDIUM: 'bg-yellow-500',
                  LOW: 'bg-blue-500'
                };
                
                const total = overview.total_recommendations;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={priority} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{priority}</span>
                        <span className="text-gray-500">{count}</span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colors[priority]}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
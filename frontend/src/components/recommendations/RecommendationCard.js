import React, { useState } from 'react';
import { 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon 
} from '@heroicons/react/24/outline';

const RecommendationCard = ({ recommendation, onSelect, selected = false }) => {
  const [expanded, setExpanded] = useState(false);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'CRITICAL':
      case 'HIGH':
        return ExclamationTriangleIcon;
      case 'MEDIUM':
        return InformationCircleIcon;
      case 'LOW':
        return CheckCircleIcon;
      default:
        return InformationCircleIcon;
    }
  };

  const formatCpu = (milliCores) => {
    if (!milliCores) return 'N/A';
    return milliCores >= 1000 ? `${(milliCores / 1000).toFixed(1)}` : `${milliCores}m`;
  };

  const formatMemory = (bytes) => {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  };

  const calculateSavings = (current, recommended) => {
    if (!current || !recommended) return null;
    const savings = current - recommended;
    const percentage = (savings / current) * 100;
    return { savings, percentage };
  };

  const cpuSavings = calculateSavings(recommendation.current_cpu_request, recommendation.recommended_cpu_request);
  const memorySavings = calculateSavings(recommendation.current_memory_request, recommendation.recommended_memory_request);
  
  const PriorityIcon = getPriorityIcon(recommendation.priority);

  return (
    <div className={`bg-white rounded-lg shadow border-l-4 transition-all duration-200 ${
      selected ? 'border-l-blue-500 ring-2 ring-blue-200' : 'border-l-gray-200 hover:shadow-md'
    }`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            {onSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect(recommendation)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
            
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {recommendation.resource_name}
                </h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}>
                  <PriorityIcon className="w-3 h-3 mr-1" />
                  {recommendation.priority}
                </span>
              </div>
              
              <div className="mt-1 text-sm text-gray-500">
                <span className="font-medium">{recommendation.namespace}</span> / {recommendation.resource_type}
              </div>
              
              <div className="mt-1 text-sm text-gray-600">
                Container: <span className="font-medium">{recommendation.container_name}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Chiudi' : 'Dettagli'}
          </button>
        </div>

        {/* Resource Summary */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">CPU Request</h4>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCpu(recommendation.current_cpu_request)} → {formatCpu(recommendation.recommended_cpu_request)}
                </div>
                {cpuSavings && cpuSavings.percentage > 0 && (
                  <div className="text-sm text-green-600">
                    -{formatCpu(cpuSavings.savings)} ({cpuSavings.percentage.toFixed(1)}% risparmio)
                  </div>
                )}
              </div>
              {cpuSavings && cpuSavings.percentage > 0 ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : cpuSavings && cpuSavings.percentage < 0 ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          {/* Memory */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Memory Request</h4>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatMemory(recommendation.current_memory_request)} → {formatMemory(recommendation.recommended_memory_request)}
                </div>
                {memorySavings && memorySavings.percentage > 0 && (
                  <div className="text-sm text-green-600">
                    -{formatMemory(memorySavings.savings)} ({memorySavings.percentage.toFixed(1)}% risparmio)
                  </div>
                )}
              </div>
              {memorySavings && memorySavings.percentage > 0 ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
              ) : memorySavings && memorySavings.percentage < 0 ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-6 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current Resources */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3">Risorse Attuali</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>CPU Request:</span>
                    <span className="font-medium">{formatCpu(recommendation.current_cpu_request)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CPU Limit:</span>
                    <span className="font-medium">{formatCpu(recommendation.current_cpu_limit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Request:</span>
                    <span className="font-medium">{formatMemory(recommendation.current_memory_request)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Limit:</span>
                    <span className="font-medium">{formatMemory(recommendation.current_memory_limit)}</span>
                  </div>
                </div>
              </div>

              {/* Recommended Resources */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-3">Risorse Raccomandate</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>CPU Request:</span>
                    <span className="font-medium">{formatCpu(recommendation.recommended_cpu_request)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CPU Limit:</span>
                    <span className="font-medium">{formatCpu(recommendation.recommended_cpu_limit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Request:</span>
                    <span className="font-medium">{formatMemory(recommendation.recommended_memory_request)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory Limit:</span>
                    <span className="font-medium">{formatMemory(recommendation.recommended_memory_limit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span>Pod Count: <span className="font-medium">{recommendation.pods_count}</span></span>
                {recommendation.Scan && (
                  <span>Scan Date: <span className="font-medium">
                    {new Date(recommendation.Scan.scan_date).toLocaleDateString()}
                  </span></span>
                )}
                {recommendation.Patches && recommendation.Patches.length > 0 && (
                  <span className="text-blue-600">
                    Patch Status: <span className="font-medium">{recommendation.Patches[0].status}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
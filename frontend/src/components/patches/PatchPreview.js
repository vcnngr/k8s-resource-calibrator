import React, { useState } from 'react';
import { 
  EyeIcon, 
  DocumentDuplicateIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';

const PatchPreview = ({ patches, onApply, onCancel, loading = false }) => {
  const [selectedStrategy, setSelectedStrategy] = useState('conservative');
  const [createBackup, setCreateBackup] = useState(true);
  const [dryRun, setDryRun] = useState(true);
  const [expandedPatch, setExpandedPatch] = useState(null);

  const strategies = {
    conservative: {
      name: 'Conservativo',
      description: 'Applica solo riduzioni significative (>20%) per ridurre il rischio',
      color: 'text-green-600 bg-green-100'
    },
    balanced: {
      name: 'Bilanciato',
      description: 'Bilancia risparmi e stabilità',
      color: 'text-blue-600 bg-blue-100'
    },
    aggressive: {
      name: 'Aggressivo',
      description: 'Applica tutte le raccomandazioni per massimizzare i risparmi',
      color: 'text-red-600 bg-red-100'
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('YAML copiato negli appunti!');
  };

  const formatYaml = (yamlString) => {
    // Basic YAML formatting for display
    return yamlString.split('\n').map((line, index) => (
      <div key={index} className="text-sm font-mono">
        {line.replace(/^(\s*)/, (match) => '\u00A0'.repeat(match.length))}
      </div>
    ));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Anteprima Patch - {patches.length} Risorse
        </h2>

        {/* Strategy Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Strategia di Applicazione
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(strategies).map(([key, strategy]) => (
              <label key={key} className="relative">
                <input
                  type="radio"
                  value={key}
                  checked={selectedStrategy === key}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="sr-only"
                />
                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedStrategy === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{strategy.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${strategy.color}`}>
                      {key.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{strategy.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-6 mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Crea backup prima dell'applicazione</span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Modalità simulazione (Dry Run)</span>
          </label>
        </div>

        {/* Warning for non-dry-run */}
        {!dryRun && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Attenzione: Applicazione Reale
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Le patch verranno applicate realmente al cluster Kubernetes. 
                  Assicurati di aver verificato attentamente le modifiche.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={() => onApply({
              strategy: selectedStrategy,
              createBackup,
              dryRun
            })}
            disabled={loading}
            className={`px-6 py-2 text-sm font-medium text-white rounded-md ${
              dryRun 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-red-600 hover:bg-red-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Applicazione...' : dryRun ? 'Simula Applicazione' : 'Applica Patch'}
          </button>
        </div>
      </div>

      {/* Patches List */}
      <div className="space-y-4">
        {patches.map((patch, index) => (
          <div key={index} className="bg-white rounded-lg shadow">
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedPatch(expandedPatch === index ? null : index)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {patch.is_cumulative ? (
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-600">{patch.container_count}</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">1</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {patch.namespace}/{patch.resource_name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {patch.resource_type}
                      {patch.is_cumulative && ` - ${patch.container_count} containers`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {patch.is_cumulative && (
                    <span className="px-2 py-1 text-xs font-medium text-purple-600 bg-purple-100 rounded">
                      CUMULATIVA
                    </span>
                  )}
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedPatch === index && (
              <div className="border-t border-gray-200 p-4">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">YAML Patch</h4>
                    <button
                      onClick={() => copyToClipboard(patch.patch_data.yaml)}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                      <span>Copia</span>
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-md p-4 max-h-64 overflow-y-auto">
                    <pre className="text-sm text-gray-800">
                      {patch.patch_data.yaml}
                    </pre>
                  </div>
                </div>

                {/* Patch Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Dettagli Patch</h5>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div>Strategia: <span className="font-medium">{selectedStrategy}</span></div>
                      <div>Tipo: <span className="font-medium">{patch.patch_data.type}</span></div>
                      {patch.is_cumulative && (
                        <div>Container: <span className="font-medium">{patch.container_count}</span></div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Stato</h5>
                    <div className="flex items-center space-x-2">
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">Pronta per l'applicazione</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatchPreview;
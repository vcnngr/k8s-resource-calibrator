import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { uploadScan } from '../../services/scans';

const ScanUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    cluster_id: '',
    prometheus_url: '',
    description: ''
  });
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const handleFileSelect = (selectedFile) => {
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
    } else {
      alert('Seleziona un file JSON valido');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert('Seleziona un file JSON da caricare');
      return;
    }

    setUploading(true);
    
    try {
      const result = await uploadScan(file, formData);
      
      if (result.success) {
        alert(`Scansione caricata con successo! ${result.data.recommendations_count} raccomandazioni processate.`);
        navigate(`/scans/${result.data.scan.id}`);
      } else {
        alert(`Errore: ${result.error}`);
      }
    } catch (error) {
      console.error('Errore upload:', error);
      alert('Errore durante il caricamento. Riprova.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Carica Scansione KRR</h1>
        <p className="mt-2 text-gray-600">
          Carica il file JSON generato da KRR per analizzare le raccomandazioni di ottimizzazione delle risorse.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Area */}
        <div className="bg-white p-6 rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            File JSON KRR *
          </label>
          
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : file
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {file ? (
              <div className="space-y-2">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-green-600" />
                <p className="text-sm font-medium text-green-600">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Rimuovi file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Trascina qui il file JSON o{' '}
                  <label className="text-blue-600 hover:text-blue-800 cursor-pointer">
                    sfoglia
                    <input
                      type="file"
                      className="hidden"
                      accept=".json"
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                    />
                  </label>
                </p>
                <p className="text-xs text-gray-500">Solo file JSON</p>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Form */}
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Informazioni Aggiuntive</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cluster ID *
            </label>
            <input
              type="text"
              value={formData.cluster_id}
              onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="es. production-cluster-01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL Prometheus
            </label>
            <input
              type="url"
              value={formData.prometheus_url}
              onChange={(e) => setFormData({ ...formData, prometheus_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://prometheus.monitoring.svc.cluster.local:9090"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Descrizione opzionale della scansione..."
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/scans')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={!file || uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Caricamento...' : 'Carica Scansione'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ScanUpload;
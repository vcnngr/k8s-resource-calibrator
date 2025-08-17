import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/common/Layout';
import Dashboard from './components/dashboard/Overview';
import ScansList from './components/scans/ScansList';
import ScanUpload from './components/scans/ScanUpload';
import ScanDetails from './components/scans/ScanDetails';
import RecommendationsList from './components/recommendations/RecommendationsList';
import PatchHistory from './components/patches/PatchHistory';
import ErrorBoundary from './components/common/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Scansioni */}
              <Route path="/scans" element={<ScansList />} />
              <Route path="/scans/upload" element={<ScanUpload />} />
              <Route path="/scans/:id" element={<ScanDetails />} />
              
              {/* Raccomandazioni */}
              <Route path="/recommendations" element={<RecommendationsList />} />
              
              {/* Patch */}
              <Route path="/patches" element={<PatchHistory />} />
              
              {/* 404 */}
              <Route path="*" element={<div className="p-8 text-center">Pagina non trovata</div>} />
            </Routes>
          </Layout>
        </Router>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { ScanningProgress } from './pages/ScanningProgress'
import { Dashboard } from './pages/Dashboard'
import { DetailedReport } from './pages/DetailedReport'
import { ScanHistory } from './pages/ScanHistory'
import { ExportShare } from './pages/ExportShare'
import { Settings } from './pages/Settings'

export const App: React.FC = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/scan/:scanId" element={<ScanningProgress />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/report" element={<DetailedReport />} />
        <Route path="/history" element={<ScanHistory />} />
        <Route path="/export" element={<ExportShare />} />
        <Route path="/settings" element={<Settings />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

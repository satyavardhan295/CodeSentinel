import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { Home } from './pages/Home'
import { ScanningProgress } from './pages/ScanningProgress'
import { Dashboard } from './pages/Dashboard'
import { DetailedReport } from './pages/DetailedReport'
import { ScanHistory } from './pages/ScanHistory'
import { ExportShare } from './pages/ExportShare'
import { Settings } from './pages/Settings'
import { Pricing } from './pages/Pricing'
import { About } from './pages/About'
import { Terms } from './pages/Terms'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'

const guard = (page: React.ReactElement) => <RequireAuth>{page}</RequireAuth>

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Account pages: full-screen, no sidebar */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<Layout />}>
        {/* Signed-in only */}
        <Route path="/" element={guard(<Home />)} />
        <Route path="/scan/:scanId" element={guard(<ScanningProgress />)} />
        <Route path="/dashboard" element={guard(<Dashboard />)} />
        <Route path="/report" element={guard(<DetailedReport />)} />
        <Route path="/history" element={guard(<ScanHistory />)} />
        <Route path="/export" element={guard(<ExportShare />)} />
        <Route path="/settings" element={guard(<Settings />)} />
        {/* Public */}
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms" element={<Terms />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  GitBranch,
  ArrowRight
} from 'lucide-react'
import { mockPastScans } from '../api/mockData'
import { SeverityBadge } from '../components/SeverityBadge'
import { StatRow } from '../components/StatRow'

export const ScanHistory: React.FC = () => {
  const scans = mockPastScans

  // State for comparison
  const [scanAId, setScanAId] = useState(scans[scans.length - 2].id) // Scan 4
  const [scanBId, setScanBId] = useState(scans[scans.length - 1].id) // Scan 5 (current)

  const scanA = scans.find(s => s.id === scanAId) || scans[0]
  const scanB = scans.find(s => s.id === scanBId) || scans[scans.length - 1]

  const scoreDelta = scanB.score - scanA.score
  const debtDelta = scanB.debtHours - scanA.debtHours

  // Realistic delta estimates based on scan improvements
  const resolvedCount = Math.max(0, Math.round((scanA.debtHours - scanB.debtHours) / 1.75))
  const newCount = Math.max(0, resolvedCount > 0 ? Math.floor(resolvedCount * 0.25) : 2)

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Page Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Scan history
        </h1>
        <p className="text-sm text-muted mt-1">
          Historical record of security assessments and delta analysis across revisions.
        </p>
      </div>

      {/* Compare Two Scans Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Compare two scans</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-6">
          {/* Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="base-scan-select" className="block text-xs font-medium text-muted mb-1.5">
                Baseline scan
              </label>
              <select
                id="base-scan-select"
                value={scanAId}
                onChange={e => setScanAId(e.target.value)}
                className="w-full bg-bg border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
              >
                {scans.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.repoName} ({new Date(s.startedAt).toLocaleDateString()}) — Score: {s.score}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="comparison-scan-select" className="block text-xs font-medium text-muted mb-1.5">
                Comparison scan
              </label>
              <select
                id="comparison-scan-select"
                value={scanBId}
                onChange={e => setScanBId(e.target.value)}
                className="w-full bg-bg border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
              >
                {scans.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.repoName} ({new Date(s.startedAt).toLocaleDateString()}) — Score: {s.score}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr className="border-t border-line/60" />

          {/* Metrics comparison grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 tabular-nums">
            {/* 1. Score delta */}
            <div>
              <div className="text-xs text-muted mb-1">Score change</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-heading font-semibold text-ink">
                  {scanB.score}
                </span>
                <span
                  className={`inline-flex items-center text-xs font-medium ${
                    scoreDelta >= 0
                      ? 'text-severity-fixed'
                      : 'text-severity-critical'
                  }`}
                >
                  {scoreDelta >= 0 ? (
                    <TrendingUp size={16} strokeWidth={1.5} className="mr-0.5" />
                  ) : (
                    <TrendingDown size={16} strokeWidth={1.5} className="mr-0.5" />
                  )}
                  {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts
                </span>
              </div>
            </div>

            {/* 2. Net debt change */}
            <div>
              <div className="text-xs text-muted mb-1">Net debt change</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-heading font-semibold text-ink">
                  {scanB.debtHours} h
                </span>
                <span
                  className={`text-xs font-medium ${
                    debtDelta <= 0
                      ? 'text-severity-fixed'
                      : 'text-severity-critical'
                  }`}
                >
                  {debtDelta <= 0 ? `${debtDelta} h` : `+${debtDelta} h`}
                </span>
              </div>
            </div>

            {/* 3. Issues resolved */}
            <div>
              <div className="text-xs text-muted mb-1">Issues resolved</div>
              <div className="text-xl font-heading font-semibold text-severity-fixed">
                {resolvedCount}
              </div>
            </div>

            {/* 4. New issues introduced */}
            <div>
              <div className="text-xs text-muted mb-1">New issues introduced</div>
              <div className="text-xl font-heading font-semibold text-severity-high">
                {newCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* List of Past Scans */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">All recorded scans</h2>
        <div className="border border-line rounded-sm overflow-hidden bg-surface divide-y divide-line/60 text-xs">
          {scans.slice().reverse().map(scan => {
            const minutes = Math.floor(scan.durationSeconds / 60)
            const seconds = scan.durationSeconds % 60
            return (
              <div
                key={scan.id}
                className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-bg/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 text-center">
                    <span className="font-heading font-semibold text-lg text-ink tabular-nums">
                      {scan.score}
                    </span>
                    <div className="text-[10px] text-muted -mt-1 font-medium">
                      Grade {scan.grade}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-ink text-sm">
                      {scan.repoName}
                    </div>
                    <div className="flex items-center gap-2 text-muted mt-0.5">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <GitBranch size={12} strokeWidth={1.5} />
                        {scan.branch}
                      </span>
                      <span>•</span>
                      <span className="tabular-nums">{scan.linesOfCode.toLocaleString()} lines</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-muted tabular-nums w-full md:w-auto justify-between md:justify-end">
                  <div>
                    <div className="text-[11px] text-muted">Debt hours</div>
                    <div className="font-medium text-ink">{scan.debtHours} h</div>
                  </div>

                  <div>
                    <div className="text-[11px] text-muted">Duration</div>
                    <div className="font-medium text-ink">
                      {minutes}m {seconds}s
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-muted">Date</div>
                    <div className="font-medium text-ink">
                      {new Date(scan.startedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1 text-brand font-medium hover:underline text-xs"
                  >
                    <span>View report</span>
                    <ArrowRight size={14} strokeWidth={1.5} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

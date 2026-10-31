import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts'
import { ArrowUpRight } from 'lucide-react'
import { GradeScaleBar } from '../components/GradeScaleBar'
import { DebtLedger } from '../components/DebtLedger'
import { SeverityBadge } from '../components/SeverityBadge'
import { FindingDrawer } from '../components/FindingDrawer'
import { Toast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { useReport } from '../hooks/useReport'
import {
  mockPastScans,
  mockFolderDebts,
  mockOwaspDistribution
} from '../api/mockData'
import { Finding } from '../types'

export const Dashboard: React.FC = () => {
  const { loading, scan, findings, updateFinding } = useReport()
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Animated score counter: counts up from 0 to 62 over 900ms ease-out
  const [displayedScore, setDisplayedScore] = useState(0)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  useEffect(() => {
    if (loading || !scan) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) {
      setDisplayedScore(scan.score)
      return
    }

    const duration = 900
    const target = scan.score
    const startTime = performance.now()

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic: 1 - pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayedScore(Math.round(easeOut * target))

      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  }, [loading, scan])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-8">
        <Skeleton height={120} />
        <Skeleton height={240} />
        <Skeleton height={200} />
      </div>
    )
  }

  // Top 5 issues ranked by score points gained per hour of effort
  const fixFirstIssues = [...findings]
    .sort((a, b) => {
      const ratioA = a.pointsGainedIfFixed / a.effortHours
      const ratioB = b.pointsGainedIfFixed / b.effortHours
      return ratioB - ratioA
    })
    .slice(0, 5)

  // Formatted past scans for Recharts
  const scoreTrendData = mockPastScans.map((s, idx) => ({
    scan: `Scan ${idx + 1}`,
    score: s.score,
    date: new Date(s.startedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }))

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-8">
      {/* 1. Score Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-baseline gap-3">
            <span className="font-heading font-semibold text-3xl text-ink tabular-nums leading-none">
              {displayedScore}
            </span>
            <span className="font-heading font-semibold text-xl text-muted leading-none">
              {scan?.grade || 'D'}
            </span>
          </div>
          <p className="text-base text-ink leading-relaxed">
            Your code carries about 41 hours of unpaid security debt. 3 critical
            issues can be exploited without authentication.
          </p>
        </div>

        {/* Right: Grade Scale Bar */}
        <GradeScaleBar
          score={scan?.score || 62}
          grade={scan?.grade || 'D'}
          animate={true}
        />
      </div>

      <hr className="border-t border-line" />

      {/* 2. Debt Ledger */}
      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">Debt ledger</h2>
        <DebtLedger
          secretsCount={4}
          secretsFileCount={3}
          depCount={6}
          depExploitCount={2}
        />
      </div>

      <hr className="border-t border-line" />

      {/* 3. Fix First */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Fix first</h2>
          <Link
            to="/report"
            className="text-xs text-brand hover:underline inline-flex items-center gap-1"
          >
            <span>View all 26 findings</span>
            <ArrowUpRight size={14} strokeWidth={1.5} />
          </Link>
        </div>

        <div className="border border-line rounded-sm overflow-hidden bg-surface divide-y divide-line/60 text-xs">
          {fixFirstIssues.map(issue => (
            <div
              key={issue.id}
              onClick={() => setSelectedFinding(issue)}
              className="p-3 flex items-center justify-between gap-4 hover:bg-bg/60 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 truncate">
                <SeverityBadge severity={issue.severity} />
                <span className="font-medium text-ink truncate hover:text-brand">
                  {issue.title}
                </span>
                <span className="text-[11px] text-muted font-mono hidden md:inline truncate">
                  {issue.filePath}
                </span>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-muted tabular-nums">
                <span className="text-severity-fixed font-medium">
                  +{issue.pointsGainedIfFixed} pts
                </span>
                <span>{issue.effortHours} h effort</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted pt-1">
          Fixing these 5 raises your score from 62 to 78 and eliminates all critical risk.
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 4. Charts Section (Intentionally different widths) */}
      <div className="space-y-6">
        <h2 className="text-sm font-semibold text-ink">Debt distribution and history</h2>

        {/* 1. Score Over Time — Wide Full-width Chart */}
        <div className="p-4 border border-line rounded-sm bg-surface">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-ink">Score over time</span>
            <span className="text-xs text-muted tabular-nums">5 scans recorded</span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--line)' }}
                />
                <YAxis
                  domain={[30, 100]}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                    borderRadius: '3px',
                    fontSize: '12px',
                    color: 'var(--ink)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--brand)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2 & 3. Asymmetric Two-Column Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart 2: Debt by folder (horizontal bar chart, top 8) - 7 cols */}
          <div className="lg:col-span-7 p-4 border border-line rounded-sm bg-surface">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-ink">Debt by folder (hours)</span>
              <span className="text-xs text-muted">Top 8 directories</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mockFolderDebts}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--line)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--line)' }}
                  />
                  <YAxis
                    dataKey="folder"
                    type="category"
                    width={110}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--line)',
                      borderRadius: '3px',
                      fontSize: '12px',
                      color: 'var(--ink)'
                    }}
                  />
                  <Bar dataKey="hours" fill="var(--brand)" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Findings by OWASP category (vertical bar chart) - 5 cols */}
          <div className="lg:col-span-5 p-4 border border-line rounded-sm bg-surface">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-ink">Findings by OWASP category</span>
              <span className="text-xs text-muted">Issue frequency</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mockOwaspDistribution}
                  margin={{ top: 10, right: 10, left: -25, bottom: 35 }}
                >
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 9, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--line)' }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--line)',
                      borderRadius: '3px',
                      fontSize: '12px',
                      color: 'var(--ink)'
                    }}
                  />
                  <Bar dataKey="count" fill="var(--muted)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 5. Repo Summary */}
      <div className="text-xs text-muted">
        express-api / branch: main / Node.js + JavaScript / 18,742 lines / Scanned 14 min ago in 2m 31s
      </div>

      {/* Slide-over Finding Drawer */}
      <FindingDrawer
        finding={selectedFinding}
        isOpen={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onUpdateFinding={updateFinding}
        onShowToast={showToast}
      />

      {/* Confirmation Toast */}
      <Toast message={toastMessage} />
    </div>
  )
}

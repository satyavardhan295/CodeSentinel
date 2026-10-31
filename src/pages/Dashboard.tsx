import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList
} from 'recharts'
import { ArrowUpRight, AlertTriangle, ScanSearch } from 'lucide-react'
import { GradeScaleBar } from '../components/GradeScaleBar'
import { ScoreRing } from '../components/ScoreRing'
import { DebtLedger } from '../components/DebtLedger'
import { SeverityBadge } from '../components/SeverityBadge'
import { FindingDrawer } from '../components/FindingDrawer'
import { Toast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useReport } from '../hooks/useReport'
import { scanLink } from '../hooks/useScans'
import {
  DangerRow,
  SEVERITIES,
  SEVERITY_WEIGHT,
  IssueSeverity,
  dangerByType,
  ledgerRows,
  openFindings,
  scoreFor
} from '../lib/reportStats'
import { Finding } from '../types'

const SEVERITY_FILL: Record<IssueSeverity, string> = {
  Critical: 'var(--sev-critical)',
  High: 'var(--sev-high)',
  Medium: 'var(--sev-medium)',
  Low: 'var(--sev-low)'
}

const DangerTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as DangerRow
  return (
    <div className="px-2.5 py-1.5 rounded-sm border border-line bg-surface text-xs text-ink shadow-sm min-w-[170px]">
      <div className="font-medium mb-1">{row.type}</div>
      {SEVERITIES.filter(sev => row[sev] > 0).map(sev => (
        <div key={sev} className="flex items-center justify-between gap-4 tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span className="w-2 h-2 rounded-[2px]" style={{ background: SEVERITY_FILL[sev] }} />
            {sev}
          </span>
          <span>{row[sev]}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-line tabular-nums">
        <span className="text-muted">Risk score</span>
        <span className="font-semibold">{row.riskScore}</span>
      </div>
    </div>
  )
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const {
    loading,
    error,
    noScans,
    scan,
    findings,
    dependencies,
    secrets,
    configurations,
    updateFinding
  } = useReport()
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const dangerData = useMemo(
    () => dangerByType(findings, dependencies, secrets, configurations),
    [findings, dependencies, secrets, configurations]
  )

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-8">
        <Skeleton height={120} />
        <Skeleton height={240} />
        <Skeleton height={200} />
      </div>
    )
  }

  if (error || noScans || !scan) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8">
        <EmptyState
          icon={error ? AlertTriangle : ScanSearch}
          title={error ? "Couldn't load this report" : 'No completed scans yet'}
          description={
            error ?? 'Run your first scan to see your security score, debt ledger and what to fix first.'
          }
          actionLabel="Start a scan"
          onAction={() => navigate('/')}
        />
      </div>
    )
  }

  // Top 5 open issues: most score points first, then most severe
  const severityRank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  const open = openFindings(findings)
  const fixFirstIssues = [...open]
    .sort(
      (a, b) =>
        b.pointsGainedIfFixed - a.pointsGainedIfFixed ||
        severityRank[a.severity] - severityRank[b.severity]
    )
    .slice(0, 5)
  const currentScore = scoreFor(open)
  const projectedScore = scoreFor(open.filter(f => !fixFirstIssues.includes(f)))
  const criticalCount = open.filter(f => f.severity === 'Critical').length
  const criticalLeftAfterFix = open.filter(
    f => f.severity === 'Critical' && !fixFirstIssues.includes(f)
  ).length

  const dangerChartHeight = Math.max(140, dangerData.length * 38 + 32)

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-8">
      {/* 1. Score Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-6 max-w-2xl">
          <ScoreRing score={scan.score} grade={scan.grade} />
          <p className="text-base text-ink leading-relaxed">
            {open.length === 0
              ? 'No open code findings. Nice work.'
              : `Your code has ${open.length} open security ${open.length === 1 ? 'issue' : 'issues'}.`}{' '}
            {criticalCount > 0 &&
              `${criticalCount} critical ${criticalCount === 1 ? 'issue needs' : 'issues need'} attention first.`}
          </p>
        </div>

        {/* Right: Grade Scale Bar */}
        <GradeScaleBar score={scan.score} grade={scan.grade} animate={true} />
      </div>

      <hr className="border-t border-line" />

      {/* 2. Debt Ledger */}
      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">Debt ledger</h2>
        <DebtLedger
          rows={ledgerRows(open)}
          secretsCount={secrets.length}
          secretsFileCount={new Set(secrets.map(s => s.filePath)).size}
          depCount={dependencies.length}
          depSevereCount={
            dependencies.filter(d => d.severity === 'Critical' || d.severity === 'High').length
          }
        />
      </div>

      <hr className="border-t border-line" />

      {/* 3. Fix First */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Fix first</h2>
          <Link
            to={scanLink('report', scan.id)}
            className="text-xs text-brand hover:underline inline-flex items-center gap-1"
          >
            <span>View all {findings.length} findings</span>
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
                <span className="hidden sm:inline">{issue.category}</span>
              </div>
            </div>
          ))}
        </div>

        {fixFirstIssues.length > 0 && (
          <div className="text-xs text-muted pt-1">
            Fixing {fixFirstIssues.length === 1 ? 'this' : `these ${fixFirstIssues.length}`} raises
            your score from {currentScore} to {projectedScore}
            {criticalCount > 0 && criticalLeftAfterFix === 0
              ? ' and eliminates all critical risk.'
              : '.'}
          </div>
        )}
      </div>

      <hr className="border-t border-line" />

      {/* 4. Most dangerous vulnerability types */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Risk distribution</h2>
        <div className="p-4 border border-line rounded-sm bg-surface">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
            <div>
              <div className="text-xs font-semibold text-ink">Most dangerous vulnerability types</div>
              <div className="text-[11px] text-muted mt-0.5">
                Bar length is the number of open issues; types are ranked by weighted risk
                (Critical ×{SEVERITY_WEIGHT.Critical}, High ×{SEVERITY_WEIGHT.High}, Medium ×
                {SEVERITY_WEIGHT.Medium}, Low ×{SEVERITY_WEIGHT.Low})
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
              {SEVERITIES.map(sev => (
                <span key={sev} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: SEVERITY_FILL[sev] }} />
                  {sev}
                </span>
              ))}
            </div>
          </div>

          {dangerData.length === 0 ? (
            <p className="text-xs text-muted py-8 text-center">No open vulnerabilities in this scan.</p>
          ) : (
            <div
              className="w-full"
              style={{ height: dangerChartHeight }}
              role="img"
              aria-label="Stacked bar chart of open issues per vulnerability type, ranked by weighted risk"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dangerData}
                  layout="vertical"
                  margin={{ top: 0, right: 56, left: 4, bottom: 0 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid stroke="var(--line)" strokeWidth={1} horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--line)' }}
                  />
                  <YAxis
                    dataKey="type"
                    type="category"
                    width={128}
                    interval={0}
                    tick={{ fontSize: 11, fill: 'var(--ink)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<DangerTooltip />}
                    cursor={{ fill: 'var(--bg)' }}
                    isAnimationActive={false}
                  />
                  {SEVERITIES.map((sev, idx) => (
                    <Bar
                      key={sev}
                      dataKey={sev}
                      stackId="severity"
                      fill={SEVERITY_FILL[sev]}
                      stroke="var(--surface)"
                      strokeWidth={1}
                      isAnimationActive={false}
                    >
                      {idx === SEVERITIES.length - 1 && (
                        <LabelList
                          dataKey="riskScore"
                          position="right"
                          formatter={(value: number) => `risk ${value}`}
                          style={{ fontSize: 11, fill: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
                        />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 5. Repo Summary */}
      <div className="text-xs text-muted">
        {scan.repoName} / branch: {scan.branch} /{' '}
        {scan.languages.length ? scan.languages.join(' + ') : 'Unknown languages'} /{' '}
        {(scan.linesOfCode ?? 0).toLocaleString()} lines
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

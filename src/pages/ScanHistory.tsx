import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  GitBranch,
  ArrowRight,
  History,
  Search,
  Trash2,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { deleteScan, getScanReport, listScans } from '../api/client'
import { scanLink } from '../hooks/useScans'
import { EmptyState } from '../components/EmptyState'
import { Skeleton } from '../components/Skeleton'
import { Toast } from '../components/Toast'
import { SeverityBadge } from '../components/SeverityBadge'
import { ComparedIssue, activeIssues, repoKeyOf, repoLabel } from '../lib/reportStats'
import { Scan } from '../types'

interface ScanDiff {
  resolved: ComparedIssue[]
  added: ComparedIssue[]
  persisting: number
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

export const ScanHistory: React.FC = () => {
  const navigate = useNavigate()
  const [scans, setScans] = useState<Scan[]>([]) // newest first, all statuses
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const load = useCallback(async () => {
    try {
      setError(null)
      setScans(await listScans())
    } catch (err: any) {
      setError(err?.message || 'Failed to load scans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Keep running scans' progress fresh
  useEffect(() => {
    if (!scans.some(s => s.status === 'queued' || s.status === 'scanning')) return
    const timer = setTimeout(load, 3000)
    return () => clearTimeout(timer)
  }, [scans, load])

  const visibleScans = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scans
    return scans.filter(
      s => repoLabel(s).toLowerCase().includes(q) || s.branch.toLowerCase().includes(q)
    )
  }, [scans, search])

  // ── Comparison: only scans of the same repository (same repo key) are comparable ──
  const completed = scans.filter(s => s.status === 'complete')
  const repoNames = new Map(completed.map(s => [repoKeyOf(s), repoLabel(s)]))
  const comparableRepos = Array.from(
    completed.reduce((m, s) => m.set(repoKeyOf(s), (m.get(repoKeyOf(s)) ?? 0) + 1), new Map<string, number>())
  )
    .filter(([, count]) => count >= 2)
    .map(([repo]) => repo)

  const [compareRepo, setCompareRepo] = useState('')
  const [scanAId, setScanAId] = useState('')
  const [scanBId, setScanBId] = useState('')
  const [diff, setDiff] = useState<ScanDiff | null>(null)

  const repoScans = completed.filter(s => repoKeyOf(s) === compareRepo) // newest first

  // Default to the most recently scanned comparable repo, latest two scans
  useEffect(() => {
    if (!comparableRepos.length) {
      setCompareRepo('')
      return
    }
    if (!comparableRepos.includes(compareRepo)) setCompareRepo(comparableRepos[0])
  }, [comparableRepos.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = repoScans.map(s => s.id)
    if (!ids.includes(scanBId)) setScanBId(ids[0] ?? '')
    if (!ids.includes(scanAId)) setScanAId(ids[1] ?? '')
  }, [compareRepo, repoScans.map(s => s.id).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scanAId || !scanBId || scanAId === scanBId) {
      setDiff(null)
      return
    }
    let cancelled = false
    setDiff(null)
    Promise.all([getScanReport(scanAId), getScanReport(scanBId)])
      .then(([a, b]) => {
        if (cancelled) return
        // Issue by issue, across code, dependencies, secrets and configuration
        const issuesA = activeIssues(a)
        const issuesB = activeIssues(b)
        setDiff({
          resolved: [...issuesA.values()].filter(i => !issuesB.has(i.key)),
          added: [...issuesB.values()].filter(i => !issuesA.has(i.key)),
          persisting: [...issuesB.keys()].filter(k => issuesA.has(k)).length
        })
      })
      .catch(() => !cancelled && setDiff(null))
    return () => {
      cancelled = true
    }
  }, [scanAId, scanBId])

  const handleDelete = async (scan: Scan) => {
    if (!window.confirm(`Delete the ${scan.repoName} scan from ${formatDate(scan.startedAt)}? This can't be undone.`)) {
      return
    }
    setDeletingId(scan.id)
    try {
      await deleteScan(scan.id)
      setScans(prev => prev.filter(s => s.id !== scan.id))
      showToast(`Deleted scan of ${scan.repoName}`)
    } catch (err: any) {
      showToast(err?.message || 'Could not delete the scan')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-6">
        <Skeleton height={40} width={250} />
        <Skeleton height={200} />
      </div>
    )
  }

  if (error || scans.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8">
        <EmptyState
          icon={History}
          title={error ? "Couldn't load scan history" : 'No scans yet'}
          description={error ?? 'Your scans will appear here so you can revisit and compare them over time.'}
          actionLabel="Start a scan"
          onAction={() => navigate('/')}
        />
        {/* Keeps the "Deleted…" confirmation visible after removing the last scan */}
        <Toast message={toastMessage} />
      </div>
    )
  }

  const scanA = repoScans.find(s => s.id === scanAId)
  const scanB = repoScans.find(s => s.id === scanBId)

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Page Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">Scan history</h1>
        <p className="text-sm text-muted mt-1">
          {scans.length} {scans.length === 1 ? 'scan' : 'scans'} across{' '}
          {new Set(scans.map(repoKeyOf)).size}{' '}
          {new Set(scans.map(repoKeyOf)).size === 1 ? 'repository' : 'repositories'}. Only scans
          of the same repository are compared, issue by issue.
        </p>
      </div>

      {/* Compare Two Scans Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Compare two scans of a repository</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-6">
          {comparableRepos.length === 0 ? (
            <p className="text-xs text-muted">
              Scan the same repository at least twice to see how its score and issues change
              between scans.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="compare-repo-select" className="block text-xs font-medium text-muted mb-1.5">
                    Repository
                  </label>
                  <select
                    id="compare-repo-select"
                    value={compareRepo}
                    onChange={e => setCompareRepo(e.target.value)}
                    className="w-full bg-bg border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
                  >
                    {comparableRepos.map(repo => (
                      <option key={repo} value={repo}>
                        {repoNames.get(repo) ?? repo}
                      </option>
                    ))}
                  </select>
                </div>
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
                    {repoScans.map(s => (
                      <option key={s.id} value={s.id}>
                        {formatDate(s.startedAt)} · {s.branch} · Score {s.score}
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
                    {repoScans.map(s => (
                      <option key={s.id} value={s.id}>
                        {formatDate(s.startedAt)} · {s.branch} · Score {s.score}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="border-t border-line/60" />

              {scanA && scanB && scanA.id !== scanB.id ? (
                <ComparisonMetrics scanA={scanA} scanB={scanB} diff={diff} />
              ) : (
                <p className="text-xs text-muted">Pick two different scans to compare.</p>
              )}
              {scanA && scanB && scanA.id !== scanB.id && diff ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <IssueList
                    title="Resolved since baseline"
                    issues={diff.resolved}
                    emptyText="No issues from the baseline were resolved."
                    tone="fixed"
                  />
                  <IssueList
                    title="New since baseline"
                    issues={diff.added}
                    emptyText="No new issues were introduced."
                    tone="high"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* List of Scans */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">All scans</h2>
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              strokeWidth={1.5}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search scans by repository or branch"
              className="w-full bg-surface border border-line rounded-sm pl-8 pr-3 py-1.5 text-xs text-ink"
            />
          </div>
        </div>

        {visibleScans.length === 0 ? (
          <p className="text-xs text-muted">No scans match “{search}”.</p>
        ) : (
          <div className="border border-line rounded-sm overflow-hidden bg-surface divide-y divide-line/60 text-xs">
            {visibleScans.map(scan => (
              <ScanRow
                key={scan.id}
                scan={scan}
                deleting={deletingId === scan.id}
                onDelete={() => handleDelete(scan)}
              />
            ))}
          </div>
        )}
      </div>

      <Toast message={toastMessage} />
    </div>
  )
}

const IssueList: React.FC<{
  title: string
  issues: ComparedIssue[]
  emptyText: string
  tone: 'fixed' | 'high'
}> = ({ title, issues, emptyText, tone }) => {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? issues : issues.slice(0, 6)
  return (
    <div className="border border-line rounded-sm bg-bg/40">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between text-xs">
        <span className="font-semibold text-ink">{title}</span>
        <span
          className={`tabular-nums font-medium ${
            tone === 'fixed' ? 'text-severity-fixed' : 'text-severity-high'
          }`}
        >
          {issues.length}
        </span>
      </div>
      {issues.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-line/60 text-xs">
          {visible.map(issue => (
            <li key={issue.key} className="px-3 py-2 flex items-start gap-2.5">
              <SeverityBadge severity={issue.severity} showIcon={false} className="shrink-0" />
              <div className="min-w-0">
                <div className="text-ink font-medium truncate">{issue.title}</div>
                <div className="text-[11px] text-muted font-mono truncate">
                  {issue.kind} · {issue.location}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {issues.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="w-full px-3 py-2 border-t border-line text-xs text-brand font-medium hover:underline text-left"
        >
          {expanded ? 'Show fewer' : `Show all ${issues.length}`}
        </button>
      )}
    </div>
  )
}

const ComparisonMetrics: React.FC<{
  scanA: Scan
  scanB: Scan
  diff: ScanDiff | null
}> = ({ scanA, scanB, diff }) => {
  const scoreDelta = scanB.score - scanA.score
  const gradeOrder = 'FDCBA'
  const gradeDelta = gradeOrder.indexOf(scanB.grade) - gradeOrder.indexOf(scanA.grade)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 tabular-nums">
      <div>
        <div className="text-xs text-muted mb-1">Score change</div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-heading font-semibold text-ink">{scanB.score}</span>
          <span
            className={`inline-flex items-center text-xs font-medium ${
              scoreDelta >= 0 ? 'text-severity-fixed' : 'text-severity-critical'
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

      <div>
        <div className="text-xs text-muted mb-1">Grade change</div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-heading font-semibold text-ink">{scanB.grade}</span>
          <span
            className={`text-xs font-medium ${
              gradeDelta > 0 ? 'text-severity-fixed' : gradeDelta < 0 ? 'text-severity-critical' : 'text-muted'
            }`}
          >
            {gradeDelta === 0 ? 'unchanged' : `from ${scanA.grade}`}
          </span>
        </div>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">Issues resolved</div>
        <div className="text-xl font-heading font-semibold text-severity-fixed">
          {diff ? diff.resolved.length : '…'}
        </div>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">New issues introduced</div>
        <div className="text-xl font-heading font-semibold text-severity-high">
          {diff ? diff.added.length : '…'}
        </div>
        {diff && (
          <div className="text-[11px] text-muted mt-0.5">{diff.persisting} carried over unchanged</div>
        )}
      </div>
    </div>
  )
}

const ScanRow: React.FC<{ scan: Scan; deleting: boolean; onDelete: () => void }> = ({
  scan,
  deleting,
  onDelete
}) => {
  const running = scan.status === 'queued' || scan.status === 'scanning'
  const failed = scan.status === 'failed'

  return (
    <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-bg/40 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 text-center shrink-0">
          {scan.status === 'complete' ? (
            <>
              <span className="font-heading font-semibold text-lg text-ink tabular-nums">
                {scan.score}
              </span>
              <div className="text-[10px] text-muted -mt-1 font-medium">Grade {scan.grade}</div>
            </>
          ) : running ? (
            <Loader2 size={18} strokeWidth={1.5} className="mx-auto animate-spin text-brand" />
          ) : (
            <AlertTriangle size={18} strokeWidth={1.5} className="mx-auto text-severity-critical" />
          )}
        </div>

        <div className="min-w-0">
          <div className="font-semibold text-ink text-sm truncate">{repoLabel(scan)}</div>
          <div className="flex flex-wrap items-center gap-2 text-muted mt-0.5">
            <span className="inline-flex items-center gap-1 font-mono text-[11px]">
              <GitBranch size={12} strokeWidth={1.5} />
              {scan.branch}
            </span>
            <span>•</span>
            <span>{scan.source === 'github' ? 'GitHub' : 'Upload'}</span>
            {scan.linesOfCode != null && (
              <>
                <span>•</span>
                <span className="tabular-nums">{scan.linesOfCode.toLocaleString()} lines</span>
              </>
            )}
          </div>
          {failed && (
            <div className="text-[11px] text-severity-critical mt-1 truncate" title={scan.errorMessage ?? ''}>
              Failed: {scan.errorMessage || 'unknown error'}
            </div>
          )}
          {running && (
            <div className="text-[11px] text-brand mt-1">
              {scan.progressStep || 'Queued'} · {scan.progressPct ?? 0}%
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 text-muted tabular-nums w-full md:w-auto justify-between md:justify-end">
        {scan.status === 'complete' && (
          <>
            <div>
              <div className="text-[11px] text-muted">Risk</div>
              <div className="font-medium text-ink">{scan.riskLevel}</div>
            </div>
          </>
        )}

        <div>
          <div className="text-[11px] text-muted">Started</div>
          <div className="font-medium text-ink">{formatDate(scan.startedAt)}</div>
        </div>

        {scan.status === 'complete' && (
          <Link
            to={scanLink('dashboard', scan.id)}
            className="inline-flex items-center gap-1 text-brand font-medium hover:underline text-xs"
          >
            <span>View report</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        )}
        {running && (
          <Link
            to={`/scan/${scan.id}`}
            className="inline-flex items-center gap-1 text-brand font-medium hover:underline text-xs"
          >
            <span>View progress</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        )}

        {!running && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete scan of ${scan.repoName}`}
            title="Delete scan"
            className="p-1.5 text-muted hover:text-severity-critical rounded-sm transition-colors disabled:opacity-40"
          >
            {deleting ? (
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Trash2 size={16} strokeWidth={1.5} />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

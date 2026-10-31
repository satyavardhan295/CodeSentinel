import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ExternalLink,
  AlertTriangle,
  RotateCw,
  FileCode,
  ShieldCheck,
  ScanSearch,
  ChevronDown
} from 'lucide-react'
import { useReport } from '../hooks/useReport'
import { EmptyState } from '../components/EmptyState'
import { useFindings } from '../hooks/useFindings'
import { FindingsTable } from '../components/FindingsTable'
import { FindingDrawer } from '../components/FindingDrawer'
import { SeverityBadge } from '../components/SeverityBadge'
import { Toast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { ConfigurationIssue, Finding } from '../types'

const CONFIG_STATUSES: ConfigurationIssue['status'][] = ['Open', 'Fixed', 'Ignored']

const configStatusStyle = (status: ConfigurationIssue['status']) =>
  status === 'Fixed'
    ? 'bg-severity-fixed/10 border-severity-fixed/40 text-ink'
    : status === 'Ignored'
      ? 'bg-bg border-line text-muted'
      : 'bg-surface border-line text-ink'

// OSV returns CVE IDs where one exists, otherwise GHSA/PYSEC IDs
const advisoryUrl = (id: string) =>
  id.startsWith('CVE-')
    ? `https://nvd.nist.gov/vuln/detail/${id}`
    : `https://osv.dev/vulnerability/${id}`

export const DetailedReport: React.FC = () => {
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
    updateFinding,
    updateConfiguration
  } = useReport()
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<
    'code' | 'dependencies' | 'secrets' | 'configurations'
  >('code')

  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const {
    filteredFindings,
    selectedIds,
    toggleSelect,
    selectAll,
    filters,
    setFilters,
    categories,
    bulkUpdateStatus
  } = useFindings(findings)

  const handleBulkStatus = async (status: Finding['status']) => {
    const ids = [...selectedIds]
    bulkUpdateStatus(status) // optimistic
    try {
      await Promise.all(ids.map(id => updateFinding(id, { status })))
      showToast(`Updated ${ids.length} findings to ${status}`)
    } catch (err: any) {
      showToast(err?.message || 'Some findings could not be updated')
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-6">
        <Skeleton height={40} width={250} />
        <Skeleton height={48} />
        <Skeleton height={400} />
      </div>
    )
  }

  if (error || noScans || !scan) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8">
        <EmptyState
          icon={error ? AlertTriangle : ScanSearch}
          title={error ? "Couldn't load this report" : 'No completed scans yet'}
          description={error ?? 'Run a scan to see its full vulnerability report here.'}
          actionLabel="Start a scan"
          onAction={() => navigate('/')}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Vulnerability report
        </h1>
        <p className="text-sm text-muted mt-1">
          {scan.repoName} ({scan.branch}): security debt, supply chain liabilities, and committed
          credentials.
        </p>
      </div>

      {/* Report Category Tabs */}
      <div className="flex border-b border-line gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`pb-2.5 transition-colors flex items-center gap-2 ${
            activeTab === 'code'
              ? 'border-b-2 border-brand text-brand font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Code vulnerabilities</span>
          <span className="text-xs px-1.5 py-0.2 rounded-sm bg-bg border border-line text-muted tabular-nums">
            {findings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dependencies')}
          className={`pb-2.5 transition-colors flex items-center gap-2 ${
            activeTab === 'dependencies'
              ? 'border-b-2 border-brand text-brand font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Dependencies</span>
          <span className="text-xs px-1.5 py-0.2 rounded-sm bg-bg border border-line text-muted tabular-nums">
            {dependencies.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('secrets')}
          className={`pb-2.5 transition-colors flex items-center gap-2 ${
            activeTab === 'secrets'
              ? 'border-b-2 border-brand text-brand font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Secrets</span>
          <span className="text-xs px-1.5 py-0.2 rounded-sm bg-severity-critical/15 text-severity-critical font-medium tabular-nums">
            {secrets.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('configurations')}
          className={`pb-2.5 transition-colors flex items-center gap-2 ${
            activeTab === 'configurations'
              ? 'border-b-2 border-brand text-brand font-semibold'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Configurations</span>
          <span className="text-xs px-1.5 py-0.2 rounded-sm bg-bg border border-line text-muted tabular-nums">
            {configurations.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Code Vulnerabilities */}
      {activeTab === 'code' && (
        <FindingsTable
          findings={filteredFindings}
          allFindingsCount={findings.length}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onSelectFinding={f => setSelectedFinding(f)}
          search={filters.search}
          onSearchChange={val => setFilters(prev => ({ ...prev, search: val }))}
          severityFilter={filters.severity}
          onSeverityFilterChange={val =>
            setFilters(prev => ({ ...prev, severity: val }))
          }
          categoryFilter={filters.category}
          onCategoryFilterChange={val =>
            setFilters(prev => ({ ...prev, category: val }))
          }
          statusFilter={filters.status}
          onStatusFilterChange={val =>
            setFilters(prev => ({ ...prev, status: val }))
          }
          categories={categories}
          onBulkStatusChange={handleBulkStatus}
        />
      )}

      {/* Tab 2: Dependencies */}
      {activeTab === 'dependencies' && (
        <div className="border border-line rounded-sm overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="bg-bg/60 border-b border-line text-muted font-medium">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Package</th>
                  <th className="py-2.5 px-4 font-medium">Installed</th>
                  <th className="py-2.5 px-4 font-medium">Fixed in</th>
                  <th className="py-2.5 px-4 font-medium">CVE ID</th>
                  <th className="py-2.5 px-4 font-medium">Severity</th>
                  <th className="py-2.5 px-4 font-medium text-right">Advisory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {dependencies.map(dep => (
                  <tr key={dep.id} className="h-11 hover:bg-bg/40 transition-colors">
                    <td className="py-2 px-4 font-medium text-ink">
                      {dep.package}
                    </td>
                    <td className="py-2 px-4 text-muted font-mono">
                      {dep.currentVersion}
                    </td>
                    <td className="py-2 px-4 text-severity-fixed font-mono font-medium">
                      {dep.fixedVersion}
                    </td>
                    <td className="py-2 px-4 text-muted font-mono">
                      {dep.cve}
                    </td>
                    <td className="py-2 px-4">
                      <SeverityBadge severity={dep.severity} />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <a
                        href={advisoryUrl(dep.cve)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                      >
                        <span>View advisory</span>
                        <ExternalLink size={14} strokeWidth={1.5} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Secrets */}
      {activeTab === 'secrets' && (
        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-sm bg-severity-critical/10 border border-severity-critical/30 flex items-start gap-2.5 text-xs text-ink">
            <AlertTriangle
              size={16}
              strokeWidth={1.5}
              className="text-severity-critical shrink-0 mt-0.5"
            />
            <span className="font-medium">
              Rotate these immediately. Committed secrets remain in git history even after deletion.
            </span>
          </div>

          <div className="border border-line rounded-sm overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-bg/60 border-b border-line text-muted font-medium">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Type</th>
                    <th className="py-2.5 px-4 font-medium">File path + line</th>
                    <th className="py-2.5 px-4 font-medium font-mono">Masked value</th>
                    <th className="py-2.5 px-4 font-medium">Severity</th>
                    <th className="py-2.5 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {secrets.map(sec => (
                    <tr key={sec.id} className="h-11 hover:bg-bg/40 transition-colors">
                      <td className="py-2 px-4 font-medium text-ink">
                        {sec.type}
                      </td>
                      <td className="py-2 px-4 text-muted font-mono">
                        {sec.filePath}:{sec.line}
                      </td>
                      <td className="py-2 px-4 font-mono text-ink tracking-wider">
                        {sec.maskedValue}
                      </td>
                      <td className="py-2 px-4">
                        <SeverityBadge severity={sec.severity} />
                      </td>
                      <td className="py-2 px-4 text-right">
                        {sec.rotateUrl ? (
                          <a
                            href={sec.rotateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                          >
                            <RotateCw size={14} strokeWidth={1.5} />
                            <span>How to rotate</span>
                          </a>
                        ) : (
                          // Passwords and generic secrets have no provider console to link to
                          <span className="text-muted">Change it where it&apos;s issued</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Configurations */}
      {activeTab === 'configurations' && (
        <div className="border border-line rounded-sm overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-bg/60 border-b border-line text-muted font-medium">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Issue</th>
                  <th className="py-2.5 px-4 font-medium">File</th>
                  <th className="py-2.5 px-4 font-medium">Rule</th>
                  <th className="py-2.5 px-4 font-medium">Severity</th>
                  <th className="py-2.5 px-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {configurations.map(cfg => (
                  <tr key={cfg.id} className="h-11 hover:bg-bg/40 transition-colors">
                    <td className="py-2 px-4 font-medium text-ink">
                      {cfg.issue}
                    </td>
                    <td className="py-2 px-4 text-muted font-mono">
                      {cfg.filePath}
                    </td>
                    <td className="py-2 px-4 text-muted font-mono">
                      {cfg.rule}
                    </td>
                    <td className="py-2 px-4">
                      <SeverityBadge severity={cfg.severity} />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="relative inline-flex items-center">
                        <select
                          value={cfg.status}
                          disabled={savingConfigId === cfg.id}
                          onChange={async e => {
                            const status = e.target.value as ConfigurationIssue['status']
                            setSavingConfigId(cfg.id)
                            try {
                              await updateConfiguration(cfg.id, { status })
                              showToast(`Configuration issue marked as ${status}`)
                            } catch (err: any) {
                              showToast(err?.message || 'Could not update the status')
                            } finally {
                              setSavingConfigId(null)
                            }
                          }}
                          aria-label={`Status for ${cfg.issue}`}
                          className={`appearance-none cursor-pointer pl-2 pr-6 py-0.5 rounded-sm text-[11px] font-medium border transition-colors hover:border-brand disabled:opacity-60 disabled:cursor-wait ${configStatusStyle(cfg.status)}`}
                        >
                          {CONFIG_STATUSES.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          strokeWidth={1.5}
                          className="absolute right-1.5 pointer-events-none text-muted"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

import React from 'react'
import { Search } from 'lucide-react'
import { Finding, SeverityLevel } from '../types'
import { SeverityBadge } from './SeverityBadge'

interface FindingsTableProps {
  findings: Finding[]
  allFindingsCount: number
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onSelectFinding: (finding: Finding) => void
  search: string
  onSearchChange: (value: string) => void
  severityFilter: SeverityLevel | 'All'
  onSeverityFilterChange: (value: SeverityLevel | 'All') => void
  categoryFilter: string | 'All'
  onCategoryFilterChange: (value: string | 'All') => void
  statusFilter: Finding['status'] | 'All'
  onStatusFilterChange: (value: Finding['status'] | 'All') => void
  categories: string[]
  onBulkStatusChange: (status: Finding['status']) => void
}

export const FindingsTable: React.FC<FindingsTableProps> = ({
  findings,
  allFindingsCount,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectFinding,
  search,
  onSearchChange,
  severityFilter,
  onSeverityFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  categories,
  onBulkStatusChange
}) => {
  const isAllSelected =
    findings.length > 0 && selectedIds.length === findings.length

  return (
    <div className="w-full space-y-3">
      {/* Table Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search
              size={16}
              strokeWidth={1.5}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search title, file path, or CWE..."
              className="w-full bg-surface border border-line rounded-sm pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={e => onSeverityFilterChange(e.target.value as any)}
            className="bg-surface border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
            aria-label="Filter by severity"
          >
            <option value="All">All severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => onCategoryFilterChange(e.target.value)}
            className="bg-surface border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value as any)}
            className="bg-surface border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            <option value="Open">Open</option>
            <option value="In progress">In progress</option>
            <option value="Fixed">Fixed</option>
            <option value="Ignored">Ignored</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted tabular-nums">
                {selectedIds.length} selected:
              </span>
              <button
                type="button"
                onClick={() => onBulkStatusChange('Fixed')}
                className="px-2.5 py-1 text-xs font-medium bg-surface border border-line rounded-md text-ink hover:border-brand transition-colors"
              >
                Mark as fixed
              </button>
              <button
                type="button"
                onClick={() => onBulkStatusChange('Ignored')}
                className="px-2.5 py-1 text-xs font-medium bg-surface border border-line rounded-md text-ink hover:border-brand transition-colors"
              >
                Mark as ignored
              </button>
            </div>
          )}
          <span className="text-xs text-muted tabular-nums hidden sm:inline">
            Showing {findings.length} of {allFindingsCount}
          </span>
        </div>
      </div>

      {/* Dense Sticky-Header Table */}
      <div className="border border-line rounded-sm overflow-hidden bg-surface">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-surface border-b border-line z-10 shadow-sm">
              <tr className="text-muted font-medium">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onSelectAll}
                    aria-label="Select all findings"
                    className="rounded-sm border-line text-brand focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 pr-4 w-28 font-medium">Severity</th>
                <th className="py-2.5 px-4 font-medium">Title & file path</th>
                <th className="py-2.5 px-4 font-medium hidden md:table-cell">Category</th>
                <th className="py-2.5 px-4 font-medium text-right w-20">Effort</th>
                <th className="py-2.5 pl-4 pr-3 font-medium w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {findings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No matching code vulnerabilities found.
                  </td>
                </tr>
              ) : (
                findings.map(finding => {
                  const isSelected = selectedIds.includes(finding.id)
                  return (
                    <tr
                      key={finding.id}
                      onClick={() => onSelectFinding(finding)}
                      className="h-11 hover:bg-bg/60 cursor-pointer transition-colors group"
                    >
                      <td
                        className="py-2 px-3 text-center"
                        onClick={e => {
                          e.stopPropagation()
                          onToggleSelect(finding.id)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          aria-label={`Select ${finding.title}`}
                          className="rounded-sm border-line text-brand focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="py-2 px-4 max-w-md">
                        <div className="font-medium text-ink truncate group-hover:text-brand transition-colors">
                          {finding.title}
                        </div>
                        <div className="text-[11px] text-muted font-mono truncate">
                          {finding.filePath}:{finding.lineStart}
                        </div>
                      </td>
                      <td className="py-2 px-4 text-muted hidden md:table-cell truncate">
                        {finding.category}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums text-muted font-medium">
                        {finding.effortHours} h
                      </td>
                      <td className="py-2 pl-4 pr-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-sm text-[11px] font-medium border ${
                            finding.status === 'Fixed'
                              ? 'bg-severity-fixed/10 border-severity-fixed/30 text-ink'
                              : finding.status === 'In progress'
                              ? 'bg-severity-high/10 border-severity-high/30 text-ink'
                              : finding.status === 'Ignored'
                              ? 'bg-line/40 border-line text-muted'
                              : 'bg-surface border-line text-ink'
                          }`}
                        >
                          {finding.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import {
  FileDown,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Code
} from 'lucide-react'
import { mockCurrentScan, mockFindings, mockDependencyIssues } from '../api/mockData'
import { Toast } from '../components/Toast'

export const ExportShare: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedBadge, setCopiedBadge] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const shareableUrl = `https://secdebt.internal/share/exp_8892?token=sc_live_f89b`
  const readmeBadgeMarkdown = `[![SecDebt Security Score](https://img.shields.io/badge/security__debt-62%2F100_%7C_Grade_D-d9702b)](https://secdebt.internal/express-api)`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl)
    setCopiedLink(true)
    showToast('Copied shareable link')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyBadge = () => {
    navigator.clipboard.writeText(readmeBadgeMarkdown)
    setCopiedBadge(true)
    showToast('Copied README badge markdown')
    setTimeout(() => setCopiedBadge(false), 2000)
  }

  const handleDownloadJson = () => {
    const reportData = {
      scan: mockCurrentScan,
      findings: mockFindings,
      dependencies: mockDependencyIssues,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `secdebt-report-${mockCurrentScan.repoName}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Downloaded JSON report')
  }

  const handleDownloadSarif = () => {
    const sarifPayload = {
      $schema:
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'SecDebt Scorer',
              version: '1.0.0',
              informationUri: 'https://secdebt.internal'
            }
          },
          results: mockFindings.map(f => ({
            ruleId: f.cwe,
            level:
              f.severity === 'Critical' || f.severity === 'High'
                ? 'error'
                : 'warning',
            message: { text: f.title },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.filePath },
                  region: {
                    startLine: f.lineStart,
                    endLine: f.lineEnd
                  }
                }
              }
            ]
          }))
        }
      ]
    }
    const blob = new Blob([JSON.stringify(sarifPayload, null, 2)], {
      type: 'application/sarif+json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `secdebt-${mockCurrentScan.repoName}.sarif`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Downloaded SARIF report')
  }

  const handleDownloadPdf = () => {
    window.print()
    showToast('Prepared print layout for PDF')
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Export and share
        </h1>
        <p className="text-sm text-muted mt-1">
          Distribute security findings via standardized formats, team reporting links, or repo badges.
        </p>
      </div>

      {/* 1. Export Formats */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Export formats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="p-4 border border-line rounded-sm bg-surface hover:border-brand text-left transition-colors flex flex-col justify-between h-32"
          >
            <div>
              <div className="font-semibold text-ink text-sm">Download PDF report</div>
              <div className="text-xs text-muted mt-1">
                Formatted executive summary and remediation ledger for stakeholders
              </div>
            </div>
            <span className="text-xs text-brand font-medium inline-flex items-center gap-1">
              <FileDown size={14} strokeWidth={1.5} />
              <span>Generate PDF</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="p-4 border border-line rounded-sm bg-surface hover:border-brand text-left transition-colors flex flex-col justify-between h-32"
          >
            <div>
              <div className="font-semibold text-ink text-sm">Download JSON</div>
              <div className="text-xs text-muted mt-1">
                Full structured data dump containing all 26 findings and metrics
              </div>
            </div>
            <span className="text-xs text-brand font-medium inline-flex items-center gap-1">
              <FileDown size={14} strokeWidth={1.5} />
              <span>Download JSON</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSarif}
            className="p-4 border border-line rounded-sm bg-surface hover:border-brand text-left transition-colors flex flex-col justify-between h-32"
          >
            <div>
              <div className="font-semibold text-ink text-sm">Download SARIF</div>
              <div className="text-xs text-muted mt-1">
                OASIS SARIF 2.1.0 standard for GitHub Advanced Security & CI pipelines
              </div>
            </div>
            <span className="text-xs text-brand font-medium inline-flex items-center gap-1">
              <FileDown size={14} strokeWidth={1.5} />
              <span>Download SARIF</span>
            </span>
          </button>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 2. Shareable Summary */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Shareable summary</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-4">
          <p className="text-xs text-muted">
            Generate an authenticated read-only link permitting external stakeholders to inspect the security debt ledger without modifying finding statuses.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareableUrl}
              className="flex-1 bg-bg border border-line rounded-sm px-3 py-1.5 text-xs text-muted font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover transition-colors inline-flex items-center gap-1.5 shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check size={14} strokeWidth={1.5} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} strokeWidth={1.5} />
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>

          {/* Read-only link preview card */}
          <div className="p-3 border border-line rounded-sm bg-bg/50 flex items-center justify-between text-xs">
            <div>
              <div className="font-medium text-ink">express-api Security Summary</div>
              <div className="text-muted text-[11px] mt-0.5">
                Score: 62 (Grade D) • 3 critical issues unaddressed
              </div>
            </div>
            <span className="text-[11px] font-mono text-muted">Read-only link</span>
          </div>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 3. README Badge */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">README badge</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-4">
          <p className="text-xs text-muted">
            Embed your codebase security score badge into your project README.md file.
          </p>

          <div className="flex items-center gap-3 p-3 bg-bg/50 border border-line rounded-sm">
            <span className="text-xs text-muted">Preview:</span>
            <div className="inline-flex items-center text-xs font-mono font-medium overflow-hidden rounded-[3px] border border-line">
              <span className="bg-ink text-white px-2 py-0.5 text-[11px]">security debt</span>
              <span className="bg-severity-high text-white px-2 py-0.5 text-[11px] font-bold">62 / Grade D</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="badge-markdown-textarea" className="block text-xs font-medium text-ink">
              Markdown snippet
            </label>
            <div className="relative">
              <textarea
                id="badge-markdown-textarea"
                readOnly
                rows={2}
                value={readmeBadgeMarkdown}
                className="w-full bg-bg border border-line rounded-sm p-2 text-xs font-mono text-ink"
              />
              <button
                type="button"
                onClick={handleCopyBadge}
                className="absolute right-2.5 top-2.5 px-2.5 py-1 text-xs font-medium bg-surface border border-line rounded-md text-ink hover:border-brand transition-colors inline-flex items-center gap-1"
              >
                {copiedBadge ? (
                  <>
                    <Check size={12} strokeWidth={1.5} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} strokeWidth={1.5} />
                    <span>Copy markdown</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Toast */}
      <Toast message={toastMessage} />
    </div>
  )
}

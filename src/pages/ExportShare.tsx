import React, { useState } from 'react'
import { FileDown, Copy, Check, Loader2, AlertTriangle, ScanSearch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useReport } from '../hooks/useReport'
import { scanLink } from '../hooks/useScans'
import { owaspLabel, safeFileName } from '../lib/reportStats'
import { Finding } from '../types'

const BADGE_COLORS: Record<string, string> = {
  A: '2e9e5b',
  B: '7fb43a',
  C: 'd9b42b',
  D: 'd9702b',
  F: 'c9372c'
}

// GitHub code scanning reads `security-severity` (0-10) to rank alerts
const SARIF_SEVERITY: Record<Finding['severity'], { level: string; score: string }> = {
  Critical: { level: 'error', score: '9.5' },
  High: { level: 'error', score: '7.5' },
  Medium: { level: 'warning', score: '5.0' },
  Low: { level: 'note', score: '2.0' }
}

/** shields.io static-badge path segment: '-' and '_' are syntax, so escape them. */
const shieldsText = (s: string) =>
  encodeURIComponent(s.replace(/-/g, '--').replace(/_/g, '__'))

function downloadFile(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Clipboard API needs HTTPS or localhost; fall back to a hidden textarea elsewhere. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

export const ExportShare: React.FC = () => {
  const navigate = useNavigate()
  const { loading, error, noScans, scan, findings, dependencies, secrets, configurations } =
    useReport()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedBadge, setCopiedBadge] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-6">
        <Skeleton height={40} width={250} />
        <Skeleton height={200} />
      </div>
    )
  }

  if (error || noScans || !scan) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 md:px-8">
        <EmptyState
          icon={error ? AlertTriangle : ScanSearch}
          title={error ? "Couldn't load this report" : 'Nothing to export yet'}
          description={error ?? 'Run a scan first, then export or share its report from here.'}
          actionLabel="Start a scan"
          onAction={() => navigate('/')}
        />
      </div>
    )
  }

  const criticalOpen = findings.filter(
    f => f.severity === 'Critical' && f.status !== 'Fixed' && f.status !== 'Ignored'
  ).length
  // A direct link to this scan; it opens for your account (scans are private)
  const shareableUrl = `${window.location.origin}${scanLink('dashboard', scan.id)}`
  const badgeColor = BADGE_COLORS[scan.grade] ?? 'd9702b'
  const badgeMessage = `${scan.score}/100 · grade ${scan.grade}`
  const badgeUrl = `https://img.shields.io/badge/${shieldsText('CodeSentinel')}-${shieldsText(badgeMessage)}-${badgeColor}`
  const readmeBadgeMarkdown = `![CodeSentinel security score](${badgeUrl})`
  const fileBase = `codesentinel-${safeFileName(scan.repoName)}-${scan.startedAt.slice(0, 10)}`

  const handleCopy = async (text: string, what: string, setCopied: (v: boolean) => void) => {
    if (await copyText(text)) {
      setCopied(true)
      showToast(`Copied ${what}`)
      setTimeout(() => setCopied(false), 2000)
    } else {
      showToast(`Couldn't copy automatically. Select the ${what} and copy it manually.`)
    }
  }

  const handleDownloadJson = () => {
    const reportData = {
      exportedAt: new Date().toISOString(),
      tool: 'CodeSentinel',
      scan,
      findings,
      dependencies,
      secrets,
      configurations
    }
    downloadFile(JSON.stringify(reportData, null, 2), 'application/json', `${fileBase}.json`)
    showToast('Downloaded JSON report')
  }

  const handleDownloadSarif = () => {
    // One rule per weakness (CWE, or the category when there's no CWE)
    const ruleId = (f: Finding) =>
      f.cwe || `CS-${(f.category || 'finding').replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()}`
    const rules = new Map<string, object>()
    for (const f of findings) {
      const id = ruleId(f)
      if (!rules.has(id)) {
        const cweNum = f.cwe.match(/CWE-(\d+)/)?.[1]
        rules.set(id, {
          id,
          name: f.category || id,
          shortDescription: { text: f.category || f.title },
          ...(cweNum ? { helpUri: `https://cwe.mitre.org/data/definitions/${cweNum}.html` } : {}),
          properties: {
            tags: ['security', owaspLabel(f)],
            'security-severity': SARIF_SEVERITY[f.severity].score
          }
        })
      }
    }
    const sarif = {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'CodeSentinel',
              version: '1.0.0',
              informationUri: window.location.origin,
              rules: [...rules.values()]
            }
          },
          results: findings.map(f => ({
            ruleId: ruleId(f),
            level: SARIF_SEVERITY[f.severity].level,
            message: {
              text: f.description ? `${f.title}: ${f.description}` : f.title
            },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.filePath, uriBaseId: '%SRCROOT%' },
                  region: {
                    // SARIF lines are 1-based
                    startLine: Math.max(1, f.lineStart),
                    endLine: Math.max(1, f.lineStart, f.lineEnd)
                  }
                }
              }
            ],
            ...(f.aiFix.explanation ? { properties: { fix: f.aiFix.explanation } } : {})
          }))
        }
      ]
    }
    downloadFile(JSON.stringify(sarif, null, 2), 'application/sarif+json', `${fileBase}.sarif`)
    showToast('Downloaded SARIF report')
  }

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true)
    try {
      // Loaded on demand: the PDF library is only needed here
      const { buildPdfReport } = await import('../lib/pdfReport')
      const doc = buildPdfReport({ scan, findings, dependencies, secrets, configurations })
      doc.save(`${fileBase}.pdf`)
      showToast('Downloaded PDF report')
    } catch (err) {
      console.error(err)
      showToast("Couldn't generate the PDF. Please try again.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Export and share
        </h1>
        <p className="text-sm text-muted mt-1">
          Download the {scan.repoName} report, link to it, or add a score badge to your README.
        </p>
      </div>

      {/* 1. Export Formats */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Export formats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="p-4 border border-line rounded-sm bg-surface hover:border-brand text-left transition-colors flex flex-col justify-between h-32 disabled:opacity-60 disabled:cursor-wait"
          >
            <div>
              <div className="font-semibold text-ink text-sm">Download PDF report</div>
              <div className="text-xs text-muted mt-1">
                Score summary, debt ledger, fix-first list, every finding with its fix, secrets and
                dependencies
              </div>
            </div>
            <span className="text-xs text-brand font-medium inline-flex items-center gap-1">
              {generatingPdf ? (
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <FileDown size={14} strokeWidth={1.5} />
              )}
              <span>{generatingPdf ? 'Generating…' : 'Download PDF'}</span>
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
                All raw data: score, {findings.length} findings, {dependencies.length} advisories,{' '}
                {secrets.length} secrets (masked) and {configurations.length} config issues
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
                SARIF 2.1.0 for GitHub code scanning and CI tools ({findings.length} code findings)
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

      {/* 2. Scan link */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Link to this scan</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-4">
          <p className="text-xs text-muted">
            A direct link to this scan&apos;s dashboard. Scans are private, so it opens only when
            you&apos;re signed in. To share results with others, send them the PDF report.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareableUrl}
              aria-label="Link to this scan"
              onFocus={e => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-bg border border-line rounded-sm px-3 py-1.5 text-xs text-muted font-mono"
            />
            <button
              type="button"
              onClick={() => handleCopy(shareableUrl, 'link', setCopiedLink)}
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

          {/* What the link points to */}
          <div className="p-3 border border-line rounded-sm bg-bg/50 text-xs">
            <div className="font-medium text-ink">{scan.repoName} security summary</div>
            <div className="text-muted text-[11px] mt-0.5">
              Score {scan.score} (grade {scan.grade}) • {criticalOpen} critical{' '}
              {criticalOpen === 1 ? 'issue' : 'issues'} unaddressed
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 3. README Badge */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">README badge</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-4">
          <p className="text-xs text-muted">
            Show this scan&apos;s score in your project&apos;s README.md. The badge is a static image of
            this score, so copy a new snippet after each scan.
          </p>

          <div className="flex items-center gap-3 p-3 bg-bg/50 border border-line rounded-sm">
            <span className="text-xs text-muted">Preview:</span>
            {/* Mirrors the shields.io image the snippet renders */}
            <div className="inline-flex items-center text-[11px] overflow-hidden rounded-[3px]">
              <span className="bg-[#555] text-white px-1.5 py-0.5">CodeSentinel</span>
              <span className="text-white px-1.5 py-0.5" style={{ backgroundColor: `#${badgeColor}` }}>
                {badgeMessage}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="badge-markdown-textarea" className="block text-xs font-medium text-ink">
              Markdown snippet
            </label>
            <textarea
              id="badge-markdown-textarea"
              readOnly
              rows={3}
              value={readmeBadgeMarkdown}
              onFocus={e => e.currentTarget.select()}
              className="w-full bg-bg border border-line rounded-sm p-2 text-xs font-mono text-ink resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleCopy(readmeBadgeMarkdown, 'badge markdown', setCopiedBadge)}
                className="px-2.5 py-1 text-xs font-medium bg-surface border border-line rounded-md text-ink hover:border-brand transition-colors inline-flex items-center gap-1"
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

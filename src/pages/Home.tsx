import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UploadCloud,
  FileArchive,
  Trash2,
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react'
import { useScan } from '../hooks/useScan'
import { useScans, scanLink } from '../hooks/useScans'
import { getGitHubConnection, listGitHubRepos } from '../api/client'
import { SeverityBadge } from '../components/SeverityBadge'
import { GitHubConnection, GitHubRepo } from '../types'

const COMMON_BRANCHES = ['main', 'master', 'develop', 'staging']

export const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'github'>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  // GitHub form state
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [isPrivate, setIsPrivate] = useState(false)
  const [token, setToken] = useState('')

  // Connected GitHub account (Settings) and its repositories
  const [github, setGithub] = useState<GitHubConnection | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [reposError, setReposError] = useState<string | null>(null)

  useEffect(() => {
    getGitHubConnection()
      .then(conn => {
        setGithub(conn)
        if (conn.connected) {
          return listGitHubRepos().then(setRepos)
        }
      })
      .catch(err => setReposError(err?.message || 'Could not load your GitHub repositories'))
  }, [])

  const selectedRepo = repos.find(
    r => repoUrl.replace(/\/$/, '').toLowerCase() === r.htmlUrl.toLowerCase()
  )
  const branchOptions = Array.from(
    new Set([...(selectedRepo ? [selectedRepo.defaultBranch] : []), ...COMMON_BRANCHES, branch])
  )

  const handlePickRepo = (fullName: string) => {
    const repo = repos.find(r => r.fullName === fullName)
    if (!repo) return
    setRepoUrl(repo.htmlUrl)
    setBranch(repo.defaultBranch)
  }

  // Scan options (all checked by default)
  const [scanOptions, setScanOptions] = useState({
    codeVulns: true,
    depCves: true,
    secrets: true,
    iacConfig: true,
    aiRisks: true
  })

  const { initiateScan, submitting, error: scanError } = useScan()
  const { scans: pastScans } = useScans()

  // 50 MB limit in bytes
  const MAX_FILE_SIZE = 50 * 1024 * 1024

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setUploadError(null)
    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      processFiles(selectedFiles)
    }
  }

  const processFiles = (newFiles: File[]) => {
    const oversized = newFiles.find(f => f.size > MAX_FILE_SIZE)
    if (oversized) {
      setUploadError(
        `File "${oversized.name}" exceeds the 50 MB limit. Please compress or remove large binary files.`
      )
      return
    }
    setFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const isValidInput =
    activeTab === 'upload' ? files.length > 0 : repoUrl.trim().length > 0

  const handleStartScan = () => {
    if (!isValidInput || submitting) return

    // Scan type IDs understood by POST /api/scans
    const selectedTypes: string[] = []
    if (scanOptions.codeVulns) selectedTypes.push('code')
    if (scanOptions.depCves) selectedTypes.push('dependencies')
    if (scanOptions.secrets) selectedTypes.push('secrets')
    if (scanOptions.iacConfig) selectedTypes.push('config')
    if (scanOptions.aiRisks) selectedTypes.push('ai-code')

    initiateScan({
      source: activeTab,
      files: activeTab === 'upload' ? files : undefined,
      repoUrl: activeTab === 'github' ? repoUrl : undefined,
      branch: activeTab === 'github' ? branch : undefined,
      // A connected account is used by the backend automatically
      token: activeTab === 'github' && isPrivate && !github?.connected ? token : undefined,
      scanTypes: selectedTypes
    })
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Page Title & Intro */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          New security debt scan
        </h1>
        <p className="text-sm text-muted mt-1 max-w-2xl">
          Submit your codebase via archive upload or GitHub repository URL to generate
          an unpaid debt statement and remediation plan.
        </p>
      </div>

      {/* Input Methods Navigation Tabs */}
      <div className="space-y-6">
        <div className="flex border-b border-line gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 transition-colors ${
              activeTab === 'upload'
                ? 'border-b-2 border-brand text-brand font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            Upload files or archive
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`pb-2.5 transition-colors ${
              activeTab === 'github'
                ? 'border-b-2 border-brand text-brand font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            GitHub repository
          </button>
        </div>

        {/* Tab 1: Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-line hover:border-brand/60 rounded-md p-8 text-center bg-surface transition-colors cursor-pointer"
              onClick={() => document.getElementById('archive-file-input')?.click()}
            >
              <input
                id="archive-file-input"
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="w-10 h-10 mx-auto rounded-sm bg-bg border border-line flex items-center justify-center text-muted mb-3">
                <UploadCloud size={20} strokeWidth={1.5} />
              </div>
              <div className="text-sm font-medium text-ink">
                Drag and drop your project repository or .zip archive
              </div>
              <div className="text-xs text-muted mt-1">
                Accepts .zip archives, source directories, or individual configuration files up to 50 MB
              </div>
            </div>

            {/* Inline Size Limit Error */}
            {uploadError && (
              <div className="p-3 rounded-sm bg-severity-critical/10 border border-severity-critical/30 flex items-start gap-2.5 text-xs text-ink">
                <AlertCircle size={16} strokeWidth={1.5} className="text-severity-critical shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* File list preview */}
            {files.length > 0 && (
              <div className="border border-line rounded-sm divide-y divide-line/60 bg-surface text-xs">
                {files.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileArchive size={16} strokeWidth={1.5} className="text-muted shrink-0" />
                      <span className="font-medium text-ink truncate">{file.name}</span>
                      <span className="text-muted tabular-nums">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        removeFile(idx)
                      }}
                      className="text-muted hover:text-severity-critical p-1 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: GitHub Tab */}
        {activeTab === 'github' && (
          <div className="space-y-4 max-w-xl">
            {github?.connected && repos.length > 0 && (
              <div>
                <label htmlFor="repo-picker" className="block text-xs font-medium text-ink mb-1.5">
                  Your repositories
                </label>
                <select
                  id="repo-picker"
                  value={selectedRepo?.fullName ?? ''}
                  onChange={e => handlePickRepo(e.target.value)}
                  className="w-full bg-surface border border-line rounded-sm px-2.5 py-2 text-xs text-ink"
                >
                  <option value="" disabled>
                    Choose a repository…
                  </option>
                  {repos.map(r => (
                    <option key={r.fullName} value={r.fullName}>
                      {r.fullName}
                      {r.private ? ' (private)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="repo-url-input" className="block text-xs font-medium text-ink mb-1.5">
                Repository URL
              </label>
              <div className="relative">
                <FolderGit2
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  id="repo-url-input"
                  type="text"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                  className="w-full bg-surface border border-line rounded-sm pl-9 pr-3 py-2 text-xs text-ink"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="branch-select" className="block text-xs font-medium text-ink mb-1.5">
                  Branch
                </label>
                <select
                  id="branch-select"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="w-full bg-surface border border-line rounded-sm px-2.5 py-2 text-xs text-ink"
                >
                  {branchOptions.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {!github?.connected && (
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-ink">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={e => setIsPrivate(e.target.checked)}
                      className="rounded-sm border-line text-brand focus:ring-0"
                    />
                    <span>Private repository</span>
                  </label>
                </div>
              )}
            </div>

            {github?.connected ? (
              <p className="text-[11px] text-muted">
                Using your connected GitHub account{' '}
                <span className="font-medium text-ink">@{github.username}</span> for access.{' '}
                <Link to="/settings" className="text-brand hover:underline">
                  Manage
                </Link>
              </p>
            ) : (
              <p className="text-[11px] text-muted">
                <Link to="/settings" className="text-brand hover:underline">
                  Connect your GitHub account
                </Link>{' '}
                to pick from your repositories and scan private ones.
              </p>
            )}

            {reposError && (
              <p role="alert" className="text-xs text-severity-critical">
                {reposError}
              </p>
            )}

            {/* Revealed token field if private repo */}
            {isPrivate && !github?.connected && (
              <div className="p-3 rounded-sm border border-line bg-surface space-y-2">
                <label htmlFor="github-token-input" className="block text-xs font-medium text-ink">
                  GitHub personal access token
                </label>
                <input
                  id="github-token-input"
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  className="w-full bg-bg border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink font-mono"
                />
                <p className="text-[11px] text-muted">
                  Your token is used only for this scan and never stored.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-t border-line" />

      {/* Scan Options (All checked by default) */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Scan options</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-ink">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.codeVulns}
              onChange={e =>
                setScanOptions(prev => ({ ...prev, codeVulns: e.target.checked }))
              }
              className="rounded-sm border-line text-brand focus:ring-0"
            />
            <span>Code vulnerabilities</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.depCves}
              onChange={e =>
                setScanOptions(prev => ({ ...prev, depCves: e.target.checked }))
              }
              className="rounded-sm border-line text-brand focus:ring-0"
            />
            <span>Dependency CVEs</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.secrets}
              onChange={e =>
                setScanOptions(prev => ({ ...prev, secrets: e.target.checked }))
              }
              className="rounded-sm border-line text-brand focus:ring-0"
            />
            <span>Hardcoded secrets</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.iacConfig}
              onChange={e =>
                setScanOptions(prev => ({ ...prev, iacConfig: e.target.checked }))
              }
              className="rounded-sm border-line text-brand focus:ring-0"
            />
            <span>IaC and configuration issues</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.aiRisks}
              onChange={e =>
                setScanOptions(prev => ({ ...prev, aiRisks: e.target.checked }))
              }
              className="rounded-sm border-line text-brand focus:ring-0"
            />
            <span>AI-generated code risks</span>
          </label>
        </div>
      </div>

      {/* Action and Privacy Notice */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleStartScan}
          disabled={!isValidInput || submitting}
          className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Initializing environment...' : 'Start scan'}
        </button>

        {scanError && (
          <p role="alert" className="text-xs text-severity-critical">
            {scanError}
          </p>
        )}

        <p className="text-xs text-muted">
          Your code is analysed in an isolated environment and deleted after the scan.
        </p>
      </div>

      <hr className="border-t border-line" />

      {/* Recent Scans List */}
      {pastScans.length > 0 && (
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-semibold text-ink">Recent scans</h2>
        <div className="border border-line rounded-sm overflow-hidden bg-surface divide-y divide-line/60 text-xs">
          {pastScans.slice(-3).reverse().map(s => (
            <div
              key={s.id}
              className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-bg/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <SeverityBadge
                  severity={s.score >= 80 ? 'Low' : s.score >= 60 ? 'Medium' : 'Critical'}
                  showIcon={false}
                />
                <div>
                  <div className="font-semibold text-ink">{s.repoName}</div>
                  <div className="text-[11px] text-muted">
                    Branch: {s.branch} • Score {s.score} (Grade {s.grade})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted w-full sm:w-auto justify-between sm:justify-end">
                <span className="tabular-nums">
                  {new Date(s.startedAt).toLocaleDateString()}
                </span>
                <Link
                  to={scanLink('dashboard', s.id)}
                  className="inline-flex items-center gap-1 text-brand font-medium hover:underline"
                >
                  <span>View report</span>
                  <ExternalLink size={14} strokeWidth={1.5} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  )
}

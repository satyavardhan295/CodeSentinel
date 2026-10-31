import React, { useState } from 'react'
import { AlertCircle, ExternalLink, FolderGit2, Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useGitHubConnection } from '../hooks/useGitHubConnection'
import { Toast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'
import { AccountSettings, DeleteAccount } from '../components/AccountSettings'

// Pre-fills a classic token with the `repo` scope (needed to clone private repos)
const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo&description=CodeSentinel'

export const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const github = useGitHubConnection()
  const [tokenInput, setTokenInput] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim()) return
    try {
      const conn = await github.connect(tokenInput.trim())
      setTokenInput('')
      showToast(`Connected GitHub as @${conn.username}`)
    } catch {
      // error is shown inline
    }
  }

  const handleDisconnect = async () => {
    try {
      await github.disconnect()
      showToast('Disconnected GitHub account')
    } catch {
      // error is shown inline
    }
  }

  const conn = github.connection
  // Classic tokens report scopes; fine-grained tokens report none
  const missingRepoScope =
    conn?.connected && conn.scopes.length > 0 && !conn.scopes.includes('repo')

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Manage your account, GitHub connection and how CodeSentinel looks.
        </p>
      </div>

      <AccountSettings onToast={showToast} />

      <hr className="border-t border-line" />

      {/* GitHub account */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">GitHub account</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-4 max-w-2xl">
          {github.loading ? (
            <Skeleton height={48} />
          ) : conn?.connected ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {conn.avatarUrl ? (
                  <img
                    src={conn.avatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-sm border border-line shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-sm bg-bg border border-line flex items-center justify-center text-ink shrink-0">
                    <FolderGit2 size={20} strokeWidth={1.5} />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-ink text-sm">
                    {conn.name || conn.username}
                  </div>
                  <div className="text-xs text-muted">
                    Connected as{' '}
                    <a
                      href={conn.profileUrl ?? `https://github.com/${conn.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:underline"
                    >
                      @{conn.username}
                    </a>
                    . Scans of private repositories use this account.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={github.busy}
                className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-line bg-surface text-ink hover:border-severity-critical hover:text-severity-critical transition-colors shrink-0 disabled:opacity-50"
              >
                {github.busy ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-bg border border-line flex items-center justify-center text-ink shrink-0">
                  <FolderGit2 size={20} strokeWidth={1.5} />
                </div>
                <div className="text-xs text-muted">
                  Connect GitHub to pick repositories from a list and scan private repositories
                  without entering a token each time.
                </div>
              </div>

              <div>
                <label htmlFor="github-token" className="block text-xs font-medium text-ink mb-1.5">
                  Personal access token
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="github-token"
                    type="password"
                    autoComplete="off"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    className="flex-1 bg-bg border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!tokenInput.trim() || github.busy}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {github.busy ? 'Connecting…' : 'Connect GitHub'}
                  </button>
                </div>
                <p className="text-[11px] text-muted mt-1.5">
                  <a
                    href={NEW_TOKEN_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    Create a token on GitHub
                    <ExternalLink size={11} strokeWidth={1.5} />
                  </a>{' '}
                  with the <code className="font-mono">repo</code> scope (or a fine-grained token
                  with read access to Contents and Metadata). It is checked with GitHub, then stored
                  on your CodeSentinel server and never shown again.
                </p>
              </div>
            </form>
          )}

          {missingRepoScope && (
            <div className="p-3 rounded-sm bg-severity-high/10 border border-severity-high/30 flex items-start gap-2.5 text-xs text-ink">
              <AlertCircle size={16} strokeWidth={1.5} className="text-severity-high shrink-0 mt-0.5" />
              <span>
                This token doesn't have the <code className="font-mono">repo</code> scope, so
                private repositories can't be scanned. Disconnect and connect a token with that scope.
              </span>
            </div>
          )}

          {github.error && (
            <p role="alert" className="text-xs text-severity-critical">
              {github.error}
            </p>
          )}
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* Appearance / Theme */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Appearance</h2>
        <div className="p-5 border border-line rounded-sm bg-surface flex items-center justify-between gap-4 max-w-xl">
          <div>
            <div className="font-semibold text-ink text-sm">Theme selection</div>
            <div className="text-xs text-muted mt-0.5">
              Current active theme: <span className="font-medium text-ink capitalize">{theme}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              toggleTheme()
              showToast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} mode`)
            }}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-line bg-surface hover:bg-bg transition-colors inline-flex items-center gap-2 text-ink"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={16} strokeWidth={1.5} />
                <span>Switch to light mode</span>
              </>
            ) : (
              <>
                <Moon size={16} strokeWidth={1.5} />
                <span>Switch to dark mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* Danger zone last */}
      <DeleteAccount />

      {/* Confirmation Toast */}
      <Toast message={toastMessage} />
    </div>
  )
}

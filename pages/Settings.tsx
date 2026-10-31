import React, { useState } from 'react'
import { FolderGit2, Check, Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { Toast } from '../components/Toast'

export const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // GitHub connection status
  const [isConnected, setIsConnected] = useState(true)
  const [threshold, setThreshold] = useState('70')

  // Notification preferences
  const [notifications, setNotifications] = useState({
    onCriticalFound: true,
    onScoreDrop: true,
    weeklyReport: false,
    prSecurityGate: true
  })

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleToggleGitHub = () => {
    setIsConnected(prev => {
      const next = !prev
      showToast(next ? 'Connected GitHub account' : 'Disconnected GitHub account')
      return next
    })
  }

  const handleThresholdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setThreshold(e.target.value)
    showToast(`CI failure threshold set to ${e.target.value}`)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-8 space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Manage integrations, pipeline failure gates, alerts, and visual appearance.
        </p>
      </div>

      {/* 1. Connect GitHub */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Version control integration</h2>
        <div className="p-5 border border-line rounded-sm bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-bg border border-line flex items-center justify-center text-ink shrink-0">
              <FolderGit2 size={20} strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-semibold text-ink text-sm">GitHub integration</div>
              <div className="text-xs text-muted">
                {isConnected
                  ? 'Connected as @octodev (authorized for private and public repositories)'
                  : 'Connect your GitHub organization to run automatic pull request checks'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleGitHub}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors shrink-0 ${
              isConnected
                ? 'bg-surface border-line text-ink hover:border-severity-critical hover:text-severity-critical'
                : 'bg-brand text-white border-brand hover:bg-brand-hover'
            }`}
          >
            {isConnected ? 'Disconnect GitHub' : 'Connect GitHub'}
          </button>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 2. CI Failure Threshold */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Continuous integration gate</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-4 max-w-xl">
          <div>
            <label htmlFor="ci-threshold-select" className="block text-xs font-medium text-ink mb-1.5">
              Minimum security score required to pass pipeline
            </label>
            <select
              id="ci-threshold-select"
              value={threshold}
              onChange={handleThresholdChange}
              className="w-full bg-bg border border-line rounded-sm px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="50">Score &ge; 50 (Allow Grade D or higher)</option>
              <option value="65">Score &ge; 65 (Require Grade C or higher)</option>
              <option value="70">Score &ge; 70 (Recommended baseline)</option>
              <option value="80">Score &ge; 80 (Strict — Grade B or higher)</option>
              <option value="90">Score &ge; 90 (Grade A only)</option>
            </select>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Pull requests introducing new debt or falling below this threshold will return a non-zero exit code during CI steps (`secdebt check`).
          </p>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 3. Notification Preferences */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Notification preferences</h2>
        <div className="p-5 border border-line rounded-sm bg-surface space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink">
            <input
              type="checkbox"
              checked={notifications.onCriticalFound}
              onChange={e =>
                setNotifications(prev => ({
                  ...prev,
                  onCriticalFound: e.target.checked
                }))
              }
              className="rounded-sm border-line text-brand focus:ring-0 mt-0.5"
            />
            <div>
              <div className="font-medium">Critical vulnerability alert</div>
              <div className="text-muted text-[11px]">
                Immediately notify on unauthenticated remote exploits or committed secrets
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink">
            <input
              type="checkbox"
              checked={notifications.onScoreDrop}
              onChange={e =>
                setNotifications(prev => ({
                  ...prev,
                  onScoreDrop: e.target.checked
                }))
              }
              className="rounded-sm border-line text-brand focus:ring-0 mt-0.5"
            />
            <div>
              <div className="font-medium">Score degradation warning</div>
              <div className="text-muted text-[11px]">
                Send an alert if a merged commit reduces repo security score by 5 or more points
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink">
            <input
              type="checkbox"
              checked={notifications.weeklyReport}
              onChange={e =>
                setNotifications(prev => ({
                  ...prev,
                  weeklyReport: e.target.checked
                }))
              }
              className="rounded-sm border-line text-brand focus:ring-0 mt-0.5"
            />
            <div>
              <div className="font-medium">Weekly security debt summary</div>
              <div className="text-muted text-[11px]">
                Weekly email dispatch detailing unpaid hours and team burn-down rates
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink">
            <input
              type="checkbox"
              checked={notifications.prSecurityGate}
              onChange={e =>
                setNotifications(prev => ({
                  ...prev,
                  prSecurityGate: e.target.checked
                }))
              }
              className="rounded-sm border-line text-brand focus:ring-0 mt-0.5"
            />
            <div>
              <div className="font-medium">Pull request status comments</div>
              <div className="text-muted text-[11px]">
                Post automated debt ledger diff table on open pull requests
              </div>
            </div>
          </label>
        </div>
      </div>

      <hr className="border-t border-line" />

      {/* 4. Appearance / Theme */}
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

      {/* Confirmation Toast */}
      <Toast message={toastMessage} />
    </div>
  )
}

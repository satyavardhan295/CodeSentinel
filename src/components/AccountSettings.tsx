import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, UserRound } from 'lucide-react'
import { changePassword } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { passwordProblem } from '../pages/Signup'
import { Field, FormError, PasswordInput } from './AuthShell'

const card = 'p-5 border border-line rounded-sm bg-surface space-y-4 max-w-2xl'
const button =
  'px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

/** Profile and change-password sections of the Settings page (DeleteAccount goes last). */
export const AccountSettings: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const { user } = useAuth()
  if (!user) return null

  return (
    <>
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-ink">Account</h2>
        <div className={card}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-bg border border-line flex items-center justify-center text-ink shrink-0">
              <UserRound size={20} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-ink text-sm truncate">{user.name}</div>
              <div className="text-xs text-muted truncate">
                {user.email} · member since{' '}
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t border-line" />
      <ChangePassword onToast={onToast} />
    </>
  )
}

const ChangePassword: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problem = next ? passwordProblem(next) : null
  const mismatch = confirm.length > 0 && confirm !== next
  const canSubmit = current && next && !problem && confirm === next

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      onToast('Password changed. Other browsers have been signed out.')
    } catch (err: any) {
      setError(err?.message || 'Could not change your password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-ink">Change password</h2>
      <form onSubmit={handleSubmit} className={card} noValidate>
        <Field id="current-password" label="Current password">
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="new-password"
            label="New password"
            hint={problem ?? 'At least 8 characters, mixing letters with numbers or symbols.'}
          >
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={next}
              onChange={e => setNext(e.target.value)}
            />
          </Field>
          <Field id="confirm-new-password" label="Confirm new password" hint={mismatch ? "Passwords don't match." : undefined}>
            <PasswordInput
              id="confirm-new-password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </Field>
        </div>
        <FormError message={error} />
        <button type="submit" disabled={!canSubmit || busy} className={`${button} bg-brand text-white hover:bg-brand-hover`}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}

export const DeleteAccount: React.FC = () => {
  const { deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !understood) return
    setBusy(true)
    setError(null)
    try {
      await deleteAccount(password)
      navigate('/signup', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Could not delete your account')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-severity-critical">Delete account</h2>
      <div className={`${card} border-severity-critical/40`}>
        <p className="text-xs text-muted">
          Permanently deletes your account, every scan and its results, and your GitHub
          connection. This can&apos;t be undone.
        </p>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${button} border border-severity-critical/50 text-severity-critical hover:bg-severity-critical/10`}
          >
            Delete my account…
          </button>
        ) : (
          <form onSubmit={handleDelete} className="space-y-3" noValidate>
            <Field id="delete-password" label="Enter your password to confirm">
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </Field>
            <label className="flex items-start gap-2 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={understood}
                onChange={e => setUnderstood(e.target.checked)}
                className="mt-0.5 rounded-sm border-line"
              />
              <span>I understand my account and all my scans will be deleted forever.</span>
            </label>
            <FormError message={error} />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!password || !understood || busy}
                className={`${button} bg-severity-critical text-white inline-flex items-center gap-1.5`}
              >
                <AlertTriangle size={14} strokeWidth={1.5} />
                {busy ? 'Deleting…' : 'Permanently delete account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setPassword('')
                  setUnderstood(false)
                  setError(null)
                }}
                className={`${button} border border-line text-ink hover:bg-bg`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

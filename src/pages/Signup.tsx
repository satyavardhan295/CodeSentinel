import React, { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthConfig } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import {
  AuthShell,
  Field,
  FormError,
  PasswordInput,
  SubmitButton,
  inputClass,
  safeNext
} from '../components/AuthShell'

// Mirrors the server's rules (app/schemas/auth.py) for instant feedback
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.'
  if (/^\d+$/.test(pw) || /^[A-Za-z]+$/.test(pw)) return 'Mix letters with numbers or symbols.'
  return null
}

export const Signup: React.FC = () => {
  const { user, loading, signup } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowSignups, setAllowSignups] = useState(true)

  useEffect(() => {
    getAuthConfig()
      .then(c => setAllowSignups(c.allowSignups))
      .catch(() => {})
  }, [])

  if (!loading && user) return <Navigate to={next} replace />

  const pwProblem = password ? passwordProblem(password) : null
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit =
    name.trim() && email.trim() && password && !pwProblem && confirm === password && agreed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await signup(name.trim(), email, password)
      navigate(next, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Could not create your account')
    } finally {
      setBusy(false)
    }
  }

  if (!allowSignups) {
    return (
      <AuthShell
        title="Sign-ups are closed"
        subtitle="This CodeSentinel server isn't accepting new accounts."
        footer={
          <>
            Already have an account?{' '}
            <Link to="/login" className="text-brand font-medium hover:underline">Sign in</Link>
          </>
        }
      >
        <p className="text-sm text-muted">Ask the person who runs this server to create an account for you.</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Scan your code for security debt and track it over time."
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${params.toString() ? `?${params}` : ''}`} className="text-brand font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="signup-name" label="Name">
          <input
            id="signup-name"
            autoComplete="name"
            required
            autoFocus
            maxLength={100}
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="signup-email" label="Email">
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          id="signup-password"
          label="Password"
          hint={pwProblem ?? 'At least 8 characters, mixing letters with numbers or symbols.'}
        >
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-invalid={!!pwProblem}
          />
        </Field>
        <Field id="signup-confirm" label="Confirm password" hint={mismatch ? "Passwords don't match." : undefined}>
          <PasswordInput
            id="signup-confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            aria-invalid={mismatch}
          />
        </Field>

        <label className="flex items-start gap-2 text-xs text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-0.5 rounded-sm border-line"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-brand hover:underline">
              Terms &amp; Conditions
            </Link>
          </span>
        </label>

        <FormError message={error} />
        <SubmitButton busy={busy} label="Create account" busyLabel="Creating account…" disabled={!canSubmit} />
      </form>
    </AuthShell>
  )
}

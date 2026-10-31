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

export const Login: React.FC = () => {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowSignups, setAllowSignups] = useState(true)

  useEffect(() => {
    getAuthConfig()
      .then(c => setAllowSignups(c.allowSignups))
      .catch(() => {})
  }, [])

  if (!loading && user) return <Navigate to={next} replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate(next, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to see your scans."
      footer={
        allowSignups ? (
          <>
            New to CodeSentinel?{' '}
            <Link to={`/signup${params.toString() ? `?${params}` : ''}`} className="text-brand font-medium hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          'New sign-ups are closed on this server. Ask its administrator for access.'
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="login-email" label="Email">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="login-password" label="Password">
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </Field>
        <FormError message={error} />
        <SubmitButton
          busy={busy}
          label="Sign in"
          busyLabel="Signing in…"
          disabled={!email.trim() || !password}
        />
      </form>
    </AuthShell>
  )
}

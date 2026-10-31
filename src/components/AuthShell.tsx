import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

/** Centered card layout shared by the sign-in and create-account pages. */
export const AuthShell: React.FC<{
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}> = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-10">
    <Link to="/login" className="flex items-center gap-2.5 mb-6" aria-label="CodeSentinel">
      <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center text-white">
        <ShieldCheck size={20} strokeWidth={1.5} />
      </div>
      <div>
        <div className="font-heading font-semibold text-ink text-lg leading-none">CodeSentinel</div>
        <div className="text-[11px] text-muted mt-0.5">Security debt scorer</div>
      </div>
    </Link>

    <div className="w-full max-w-sm p-6 border border-line rounded-md bg-surface space-y-5">
      <div>
        <h1 className="text-lg font-heading font-semibold text-ink">{title}</h1>
        <p className="text-xs text-muted mt-1">{subtitle}</p>
      </div>
      {children}
    </div>

    <div className="mt-5 text-xs text-muted text-center">{footer}</div>
    <div className="mt-6 flex gap-4 text-[11px] text-muted">
      <Link to="/about" className="hover:text-ink">About us</Link>
      <Link to="/terms" className="hover:text-ink">Terms &amp; Conditions</Link>
    </div>
  </div>
)

export const Field: React.FC<{
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}> = ({ id, label, hint, children }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-ink mb-1.5">
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
  </div>
)

export const inputClass =
  'w-full bg-bg border border-line rounded-sm px-2.5 py-2 text-sm text-ink focus:outline-none focus:border-brand'

/** Password input with a show/hide toggle. */
export const PasswordInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { id: string }
> = props => {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${inputClass} pr-9`} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink"
      >
        {visible ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
      </button>
    </div>
  )
}

export const FormError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <p role="alert" className="text-xs text-severity-critical">
      {message}
    </p>
  ) : null

export const SubmitButton: React.FC<{ busy: boolean; label: string; busyLabel: string; disabled?: boolean }> = ({
  busy,
  label,
  busyLabel,
  disabled
}) => (
  <button
    type="submit"
    disabled={busy || disabled}
    className="w-full py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {busy ? busyLabel : label}
  </button>
)

/** Only follow `?next=` to a path on this site (no open redirects). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

import React from 'react'
import { Check, Info } from 'lucide-react'

interface Plan {
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  cta: string
  highlighted?: boolean
  current?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    tagline: 'For individuals checking a project now and then.',
    features: [
      'Upload scans and GitHub repos (public and private)',
      'AI code review, secrets, dependency and config checks',
      'Security score, grade and debt ledger',
      'JSON and SARIF export'
    ],
    cta: 'Current plan',
    current: true
  },
  {
    name: 'Pro',
    price: '₹499',
    period: 'per user / month',
    tagline: 'For developers who scan every week.',
    features: [
      'Everything in Free',
      'Team-wide private repository access',
      'Larger repos and uploads',
      'Unlimited scan history and comparisons',
      'Priority AI analysis'
    ],
    cta: 'Upgrade to Pro',
    highlighted: true
  },
  {
    name: 'Max',
    price: '₹1,499',
    period: 'per user / month',
    tagline: 'For teams shipping security-sensitive code.',
    features: [
      'Everything in Pro',
      'Team workspaces and shared findings',
      'CI pipeline gate and pull request checks',
      'Alerts on new critical findings',
      'Priority support'
    ],
    cta: 'Upgrade to Max'
  }
]

export const Pricing: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 md:px-8 space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Choose your plan
        </h1>
        <p className="text-sm text-muted mt-1">
          Start free, then upgrade when you need private repos, bigger scans and team features.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={`p-5 rounded-sm bg-surface flex flex-col ${
              plan.highlighted ? 'border-2 border-brand' : 'border border-line'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">{plan.name}</h2>
              {plan.highlighted && (
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-sm bg-brand text-white">
                  Most popular
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-heading font-semibold text-3xl text-ink tabular-nums whitespace-nowrap">
                {plan.price}
              </span>
              <span className="text-xs text-muted whitespace-nowrap">{plan.period}</span>
            </div>
            <p className="text-xs text-muted mt-2">{plan.tagline}</p>

            <ul className="mt-4 space-y-2 text-xs text-ink flex-1">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-start gap-2">
                  <Check size={14} strokeWidth={1.5} className="text-severity-fixed shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Payments aren't live yet, so plan buttons are disabled */}
            <button
              type="button"
              disabled
              className={`mt-5 w-full py-2 text-xs font-medium rounded-md cursor-not-allowed ${
                plan.highlighted && !plan.current
                  ? 'bg-brand text-white opacity-60'
                  : 'bg-bg border border-line text-muted'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      <div
        role="note"
        className="p-3.5 rounded-sm border border-line bg-surface flex items-start gap-2.5 text-xs text-ink"
      >
        <Info size={16} strokeWidth={1.5} className="text-brand shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">This feature is not available yet.</span> Paid plans and
          payments are coming soon. Until then, everything in CodeSentinel is free to use.
        </span>
      </div>
    </div>
  )
}

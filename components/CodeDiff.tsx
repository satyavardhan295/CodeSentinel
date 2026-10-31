import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeDiffProps {
  before: string
  after: string
  onCopy?: () => void
}

export const CodeDiff: React.FC<CodeDiffProps> = ({ before, after, onCopy }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(after)
    setCopied(true)
    onCopy?.()
    setTimeout(() => setCopied(false), 2000)
  }

  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  return (
    <div className="rounded-sm border border-line overflow-hidden font-mono text-xs bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-bg/50">
        <span className="text-muted font-sans text-xs">Vulnerability patch diff</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-surface border border-line rounded-md text-ink hover:border-brand transition-colors"
        >
          {copied ? (
            <>
              <Check size={16} strokeWidth={1.5} className="text-severity-fixed" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={16} strokeWidth={1.5} className="text-muted" />
              <span>Copy fix</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
        {/* Before (Original Vulnerable Code) */}
        <div className="overflow-x-auto p-3 bg-severity-critical/[0.03]">
          <div className="text-[11px] font-sans font-medium text-severity-critical mb-2">
            Before (Vulnerable)
          </div>
          <div className="space-y-0.5">
            {beforeLines.map((line, idx) => (
              <div key={idx} className="flex gap-3 leading-5">
                <span className="text-muted/60 select-none w-6 text-right tabular-nums">
                  {idx + 1}
                </span>
                <span className="text-severity-critical select-none">-</span>
                <span className="text-ink whitespace-pre">{line || ' '}</span>
              </div>
            ))}
          </div>
        </div>

        {/* After (Remediated Code) */}
        <div className="overflow-x-auto p-3 bg-severity-fixed/[0.03]">
          <div className="text-[11px] font-sans font-medium text-severity-fixed mb-2">
            After (Remediated)
          </div>
          <div className="space-y-0.5">
            {afterLines.map((line, idx) => (
              <div key={idx} className="flex gap-3 leading-5">
                <span className="text-muted/60 select-none w-6 text-right tabular-nums">
                  {idx + 1}
                </span>
                <span className="text-severity-fixed select-none">+</span>
                <span className="text-ink whitespace-pre">{line || ' '}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

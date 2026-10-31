import React from 'react'
import { Check, Loader2 } from 'lucide-react'

export interface ScanStage {
  number: number
  title: string
  description?: string
}

const STAGES: ScanStage[] = [
  { number: 1, title: 'Fetching code' },
  { number: 2, title: 'Parsing files' },
  { number: 3, title: 'Scanning dependencies' },
  { number: 4, title: 'Running AI analysis' },
  { number: 5, title: 'Building report' }
]

interface ScanStepperProps {
  currentStage: number // 1 to 5
  filesScanned: number
  issuesFound: number
  estimatedSecondsRemaining: number
  onCancel: () => void
}

export const ScanStepper: React.FC<ScanStepperProps> = ({
  currentStage,
  filesScanned,
  issuesFound,
  estimatedSecondsRemaining,
  onCancel
}) => {
  return (
    <div className="w-full max-w-md">
      {/* Vertical Stepper 1-5 */}
      <div className="space-y-4">
        {STAGES.map(stage => {
          const isCompleted = stage.number < currentStage
          const isCurrent = stage.number === currentStage
          const isPending = stage.number > currentStage

          return (
            <div key={stage.number} className="flex items-start gap-3.5">
              {/* Step indicator */}
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-sm border text-xs font-semibold tabular-nums shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-severity-fixed/15 border-severity-fixed text-severity-fixed'
                    : isCurrent
                    ? 'bg-brand text-white border-brand'
                    : 'bg-surface border-line text-muted'
                }`}
              >
                {isCompleted ? (
                  <Check size={16} strokeWidth={1.5} />
                ) : isCurrent ? (
                  <span>{stage.number}</span>
                ) : (
                  <span>{stage.number}</span>
                )}
              </div>

              {/* Title and status */}
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${
                      isCurrent
                        ? 'font-semibold text-ink'
                        : isCompleted
                        ? 'font-medium text-ink'
                        : 'text-muted'
                    }`}
                  >
                    {stage.title}
                  </span>
                  {isCurrent && (
                    <Loader2
                      size={16}
                      strokeWidth={1.5}
                      className="animate-spin text-brand"
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <hr className="my-6 border-t border-line" />

      {/* Live counters */}
      <div className="grid grid-cols-2 gap-4 text-sm tabular-nums">
        <div>
          <div className="text-xs text-muted mb-0.5">Files scanned</div>
          <div className="text-lg font-semibold text-ink">{filesScanned}</div>
        </div>
        <div>
          <div className="text-xs text-muted mb-0.5">Issues found so far</div>
          <div className="text-lg font-semibold text-ink">{issuesFound}</div>
        </div>
      </div>

      {/* Estimated time remaining */}
      <div className="mt-4 text-xs text-muted">
        Estimated time remaining: <span className="tabular-nums font-medium text-ink">{estimatedSecondsRemaining}s</span>
      </div>

      {/* Cancel scan */}
      <div className="mt-6 pt-4 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted hover:text-ink transition-colors underline"
        >
          Cancel scan
        </button>
      </div>
    </div>
  )
}

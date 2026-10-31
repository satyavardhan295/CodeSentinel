import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { ScanStepper } from '../components/ScanStepper'
import { EmptyState } from '../components/EmptyState'
import { getScanStatus } from '../api/client'
import { scanLink } from '../hooks/useScans'
import { Scan } from '../types'

const POLL_MS = 2000

// Backend progress (see app/services/scanner.py) → stepper stage 1–5
function stageFor(status: Scan | null): number {
  if (!status || status.status === 'queued') return 1
  const pct = status.progressPct ?? 0
  if (pct < 25) return 2
  if (pct < 55) return 3
  if (pct < 90) return 4
  return 5
}

export const ScanningProgress: React.FC = () => {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()

  const [status, setStatus] = useState<Scan | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!scanId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const s = await getScanStatus(scanId)
        if (cancelled) return
        setStatus(s)
        if (s.status === 'complete') {
          navigate(scanLink('dashboard', scanId), { replace: true })
          return
        }
        if (s.status === 'failed') {
          setError(s.errorMessage || 'The scan failed.')
          return
        }
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || 'Lost contact with the scan.')
        return
      }
      timer = setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [scanId, navigate])


  return (
    <div className="max-w-2xl mx-auto py-12 px-4 md:px-8 space-y-8">
      <div>
        <div className="text-xs font-mono text-muted mb-1">
          Scan ID: {scanId}
        </div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          {error ? 'Scan failed' : 'Analyzing security posture'}
        </h1>
        <p className="text-sm text-muted mt-1">
          {status?.repoName ? `${status.repoName} · ` : ''}
          {status?.progressStep || 'Waiting for the scanner to start'}
        </p>
      </div>

      <div className="p-6 border border-line rounded-sm bg-surface">
        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="We couldn't finish this scan"
            description={error}
            actionLabel="Start a new scan"
            onAction={() => navigate('/')}
          />
        ) : (
          <ScanStepper
            currentStage={stageFor(status)}
            linesOfCode={status?.linesOfCode ?? null}
            progressPct={status?.progressPct ?? 0}
            onCancel={() => navigate('/')}
          />
        )}
      </div>
    </div>
  )
}

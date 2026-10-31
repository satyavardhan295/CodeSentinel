import { useState, useEffect } from 'react'
import { listScans } from '../api/client'
import { Scan } from '../types'

/** Completed scans, oldest first (handy for trend charts). Refetches when `refreshKey` changes. */
export function useScans(refreshKey?: unknown) {
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listScans()
      .then(all => {
        if (!cancelled) setScans(all.filter(s => s.status === 'complete').reverse())
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Failed to load scans')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return { scans, loading, error }
}

/** Link to a scan's dashboard or report page. */
export const scanLink = (page: 'dashboard' | 'report' | 'export', scanId?: string) =>
  scanId ? `/${page}?scan=${encodeURIComponent(scanId)}` : `/${page}`

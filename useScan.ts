import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startScan, StartScanPayload } from '../api/client'

export function useScan() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const initiateScan = async (payload: StartScanPayload) => {
    try {
      setSubmitting(true)
      setError(null)
      const { scanId } = await startScan(payload)
      navigate(`/scan/${scanId}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to start scan')
    } finally {
      setSubmitting(false)
    }
  }

  return { initiateScan, submitting, error }
}

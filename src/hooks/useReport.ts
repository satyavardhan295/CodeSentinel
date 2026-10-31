import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getScanReport, listScans, updateConfiguration, updateFinding } from '../api/client'
import {
  Scan,
  Finding,
  DependencyIssue,
  SecretFinding,
  ConfigurationIssue
} from '../types'

/**
 * Loads a scan report. The scan comes from the `scanId` argument, else the
 * `?scan=` query param, else the most recent completed scan.
 */
export function useReport(scanIdArg?: string) {
  const [searchParams] = useSearchParams()
  const requestedId = scanIdArg ?? searchParams.get('scan') ?? undefined

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noScans, setNoScans] = useState(false)
  const [scan, setScan] = useState<Scan | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [dependencies, setDependencies] = useState<DependencyIssue[]>([])
  const [secrets, setSecrets] = useState<SecretFinding[]>([])
  const [configurations, setConfigurations] = useState<ConfigurationIssue[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setNoScans(false)

      let scanId = requestedId
      if (!scanId) {
        const latest = (await listScans()).find(s => s.status === 'complete')
        if (!latest) {
          setNoScans(true)
          setScan(null)
          return
        }
        scanId = latest.id
      }

      const data = await getScanReport(scanId)
      setScan(data.scan)
      setFindings(data.findings)
      setDependencies(data.dependencies)
      setSecrets(data.secrets)
      setConfigurations(data.configurations)
    } catch (err: any) {
      setError(err?.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [requestedId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateFinding = async (
    findingId: string,
    patch: Partial<Pick<Finding, 'status' | 'notes'>>
  ) => {
    // Errors go to the caller (shown as a toast); they shouldn't blank the whole page
    const updated = await updateFinding(findingId, patch)
    setFindings(prev => prev.map(f => (f.id === findingId ? updated : f)))
    return updated
  }

  const handleUpdateConfiguration = async (
    configurationId: string,
    patch: Pick<ConfigurationIssue, 'status'>
  ) => {
    const updated = await updateConfiguration(configurationId, patch)
    setConfigurations(prev => prev.map(c => (c.id === configurationId ? updated : c)))
    return updated
  }

  return {
    loading,
    error,
    noScans,
    scan,
    findings,
    dependencies,
    secrets,
    configurations,
    refresh: loadData,
    updateFinding: handleUpdateFinding,
    updateConfiguration: handleUpdateConfiguration
  }
}

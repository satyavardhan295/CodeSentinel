import { useState, useEffect, useCallback } from 'react'
import { getScanReport, updateFinding } from '../api/client'
import {
  Scan,
  Finding,
  DependencyIssue,
  SecretFinding,
  ConfigurationIssue
} from '../types'

export function useReport(scanId: string = 'scan_exp_8892') {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState<Scan | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [dependencies, setDependencies] = useState<DependencyIssue[]>([])
  const [secrets, setSecrets] = useState<SecretFinding[]>([])
  const [configurations, setConfigurations] = useState<ConfigurationIssue[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
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
  }, [scanId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUpdateFinding = async (
    findingId: string,
    patch: Partial<Pick<Finding, 'status' | 'notes'>>
  ) => {
    try {
      const updated = await updateFinding(findingId, patch)
      setFindings(prev => prev.map(f => (f.id === findingId ? updated : f)))
      return updated
    } catch (err: any) {
      setError(err?.message || 'Failed to update finding')
      throw err
    }
  }

  return {
    loading,
    error,
    scan,
    findings,
    dependencies,
    secrets,
    configurations,
    refresh: loadData,
    updateFinding: handleUpdateFinding
  }
}

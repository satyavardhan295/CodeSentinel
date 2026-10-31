import { useState, useEffect, useCallback } from 'react'
import { connectGitHub, disconnectGitHub, getGitHubConnection } from '../api/client'
import { GitHubConnection } from '../types'

export function useGitHubConnection() {
  const [connection, setConnection] = useState<GitHubConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getGitHubConnection()
      .then(setConnection)
      .catch(err => setError(err?.message || 'Failed to load GitHub connection'))
      .finally(() => setLoading(false))
  }, [])

  const connect = useCallback(async (token: string) => {
    setBusy(true)
    setError(null)
    try {
      const conn = await connectGitHub(token)
      setConnection(conn)
      return conn
    } catch (err: any) {
      setError(err?.message || 'Failed to connect GitHub')
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setConnection(await disconnectGitHub())
    } catch (err: any) {
      setError(err?.message || 'Failed to disconnect GitHub')
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  return { connection, loading, busy, error, connect, disconnect }
}

import { useState, useMemo } from 'react'
import { Finding, SeverityLevel } from '../types'

export interface FindingFilters {
  search: string
  severity: SeverityLevel | 'All'
  category: string | 'All'
  status: Finding['status'] | 'All'
}

export function useFindings(initialFindings: Finding[] = []) {
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filters, setFilters] = useState<FindingFilters>({
    search: '',
    severity: 'All',
    category: 'All',
    status: 'All'
  })

  // Synchronize when initial findings change
  useMemo(() => {
    setFindings(initialFindings)
  }, [initialFindings])

  const categories = useMemo(() => {
    const set = new Set(initialFindings.map(f => f.category))
    return Array.from(set).sort()
  }, [initialFindings])

  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (filters.severity !== 'All' && f.severity !== filters.severity) {
        return false
      }
      if (filters.category !== 'All' && f.category !== filters.category) {
        return false
      }
      if (filters.status !== 'All' && f.status !== filters.status) {
        return false
      }
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase()
        const matchTitle = f.title.toLowerCase().includes(q)
        const matchFile = f.filePath.toLowerCase().includes(q)
        const matchCwe = f.cwe.toLowerCase().includes(q)
        const matchCategory = f.category.toLowerCase().includes(q)
        if (!matchTitle && !matchFile && !matchCwe && !matchCategory) return false
      }
      return true
    })
  }, [findings, filters])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedIds.length === filteredFindings.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredFindings.map(f => f.id))
    }
  }

  const bulkUpdateStatus = (newStatus: Finding['status']) => {
    setFindings(prev =>
      prev.map(f => (selectedIds.includes(f.id) ? { ...f, status: newStatus } : f))
    )
    setSelectedIds([])
  }

  return {
    findings,
    setFindings,
    filteredFindings,
    selectedIds,
    setSelectedIds,
    filters,
    setFilters,
    categories,
    toggleSelect,
    selectAll,
    bulkUpdateStatus
  }
}

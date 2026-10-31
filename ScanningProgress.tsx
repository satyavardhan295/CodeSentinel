import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ScanStepper } from '../components/ScanStepper'

export const ScanningProgress: React.FC = () => {
  const { scanId } = useParams<{ scanId: string }>()
  const navigate = useNavigate()

  const [currentStage, setCurrentStage] = useState(1)
  const [filesScanned, setFilesScanned] = useState(14)
  const [issuesFound, setIssuesFound] = useState(2)
  const [estimatedSecondsRemaining, setEstimatedSecondsRemaining] = useState(18)

  useEffect(() => {
    // Stage progression timer
    const interval = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < 5) {
          return prev + 1
        }
        return prev
      })
    }, 2200)

    // Counters update
    const counterInterval = setInterval(() => {
      setFilesScanned(prev => (prev < 248 ? prev + Math.floor(Math.random() * 25 + 10) : 248))
      setIssuesFound(prev => (prev < 26 ? prev + Math.floor(Math.random() * 3 + 1) : 26))
      setEstimatedSecondsRemaining(prev => (prev > 0 ? prev - 1 : 0))
    }, 900)

    // Completion navigation
    const completionTimer = setTimeout(() => {
      navigate('/dashboard')
    }, 11500)

    return () => {
      clearInterval(interval)
      clearInterval(counterInterval)
      clearTimeout(completionTimer)
    }
  }, [navigate])

  const handleCancel = () => {
    navigate('/')
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 md:px-8 space-y-8">
      <div>
        <div className="text-xs font-mono text-muted mb-1">
          Scan ID: {scanId || 'scan_active'}
        </div>
        <h1 className="text-xl md:text-2xl font-heading font-semibold text-ink">
          Analyzing security posture
        </h1>
        <p className="text-sm text-muted mt-1">
          Evaluating AST syntax trees, dependency supply chain advisories, and committed secrets.
        </p>
      </div>

      <div className="p-6 border border-line rounded-sm bg-surface">
        <ScanStepper
          currentStage={currentStage}
          filesScanned={filesScanned}
          issuesFound={issuesFound}
          estimatedSecondsRemaining={estimatedSecondsRemaining}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}

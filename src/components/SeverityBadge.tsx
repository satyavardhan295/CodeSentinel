import React from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2
} from 'lucide-react'
import { SeverityLevel } from '../types'

interface SeverityBadgeProps {
  severity: SeverityLevel
  showIcon?: boolean
  className?: string
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  showIcon = true,
  className = ''
}) => {
  const getIcon = () => {
    switch (severity) {
      case 'Critical':
        return <AlertOctagon size={16} strokeWidth={1.5} className="shrink-0 text-severity-critical" />
      case 'High':
        return <AlertTriangle size={16} strokeWidth={1.5} className="shrink-0 text-severity-high" />
      case 'Medium':
        return <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 text-severity-medium" />
      case 'Low':
        return <Info size={16} strokeWidth={1.5} className="shrink-0 text-severity-low" />
      case 'Fixed':
        return <CheckCircle2 size={16} strokeWidth={1.5} className="shrink-0 text-severity-fixed" />
    }
  }

  const getBadgeStyle = () => {
    switch (severity) {
      case 'Critical':
        return 'bg-severity-critical/10 border-severity-critical/30 text-ink'
      case 'High':
        return 'bg-severity-high/10 border-severity-high/30 text-ink'
      case 'Medium':
        return 'bg-severity-medium/10 border-severity-medium/30 text-ink'
      case 'Low':
        return 'bg-severity-low/10 border-severity-low/30 text-ink'
      case 'Fixed':
        return 'bg-severity-fixed/10 border-severity-fixed/30 text-ink'
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-sm border ${getBadgeStyle()} ${className}`}
    >
      {showIcon && getIcon()}
      <span>{severity}</span>
    </span>
  )
}

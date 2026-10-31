import React from 'react'

interface StatRowProps {
  label: string
  value: string | number
  unit?: string
  annotation?: string
  className?: string
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  unit,
  annotation,
  className = ''
}) => {
  return (
    <div className={`flex items-baseline justify-between py-1.5 border-b border-line/60 text-sm ${className}`}>
      <span className="text-muted text-xs">{label}</span>
      <div className="text-right">
        <span className="font-semibold text-ink tabular-nums">{value}</span>
        {unit && <span className="text-muted ml-1 text-xs">{unit}</span>}
        {annotation && <span className="text-muted ml-2 text-xs">({annotation})</span>}
      </div>
    </div>
  )
}

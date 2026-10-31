import React, { useEffect, useState } from 'react'

interface GradeScaleBarProps {
  score: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  animate?: boolean
}

export const GradeScaleBar: React.FC<GradeScaleBarProps> = ({
  score,
  grade,
  animate = true
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion || !animate) {
      setMounted(true)
      return
    }

    const timer = setTimeout(() => {
      setMounted(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [animate])

  // Calculate percentage along the 0-100 scale, clamped
  const clampedScore = Math.max(0, Math.min(100, score))
  const targetPercent = mounted ? clampedScore : 0

  return (
    <div className="w-full max-w-[340px]">
      <div className="flex justify-between text-xs text-muted mb-1.5 font-medium">
        <span>Grade scale</span>
        <span className="tabular-nums font-semibold text-ink">Grade {grade} ({score}/100)</span>
      </div>

      {/* The Track Container */}
      <div className="relative pt-3 pb-1">
        {/* Animated Position Marker (Inverted Pointer) */}
        <div
          className="absolute top-0 -ml-2 flex flex-col items-center transition-all duration-[900ms] ease-out pointer-events-none z-10"
          style={{ left: `${targetPercent}%` }}
        >
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-ink" />
        </div>

        {/* The 5 Grade Segments */}
        <div className="flex h-2.5 w-full rounded-sm overflow-hidden gap-[2px] bg-line/40 p-[1px]">
          <div className="flex-1 bg-severity-critical/80" title="F (0-49)" />
          <div className="flex-1 bg-severity-high/80" title="D (50-64)" />
          <div className="flex-1 bg-severity-medium/80" title="C (65-79)" />
          <div className="flex-1 bg-severity-low/80" title="B (80-89)" />
          <div className="flex-1 bg-severity-fixed/80" title="A (90-100)" />
        </div>

        {/* Segment Labels */}
        <div className="flex justify-between text-xs text-muted mt-1.5 font-medium px-1">
          <span className={grade === 'F' ? 'text-ink font-semibold' : ''}>F</span>
          <span className={grade === 'D' ? 'text-ink font-semibold' : ''}>D</span>
          <span className={grade === 'C' ? 'text-ink font-semibold' : ''}>C</span>
          <span className={grade === 'B' ? 'text-ink font-semibold' : ''}>B</span>
          <span className={grade === 'A' ? 'text-ink font-semibold' : ''}>A</span>
        </div>
      </div>
    </div>
  )
}

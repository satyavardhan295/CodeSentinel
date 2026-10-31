import React, { useEffect, useState } from 'react'
import { Scan } from '../types'

interface ScoreRingProps {
  score: number // 0-100
  grade: Scan['grade']
  size?: number
  strokeWidth?: number
  animate?: boolean
}

const GRADE_COLOR: Record<Scan['grade'], string> = {
  A: 'var(--sev-fixed)',
  B: 'var(--sev-low)',
  C: 'var(--sev-medium)',
  D: 'var(--sev-high)',
  F: 'var(--sev-critical)'
}

/** Circular progress indicator for the 0-100 security score. */
export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  grade,
  size = 132,
  strokeWidth = 10,
  animate = true
}) => {
  const target = Math.max(0, Math.min(100, Math.round(score)))
  const [displayed, setDisplayed] = useState(animate ? 0 : target)

  // One orchestrated motion: 900ms ease-out sweep, skipped for reduced motion
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (!animate || prefersReducedMotion) {
      setDisplayed(target)
      return
    }

    let frame = 0
    const duration = 900
    const startTime = performance.now()

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(easeOut * target))
      if (progress < 1) frame = requestAnimationFrame(step)
    }

    setDisplayed(0)
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, animate])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - displayed / 100)

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={target}
      aria-label={`Security score ${target} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={GRADE_COLOR[grade]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeOpacity={displayed > 0 ? 1 : 0}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-semibold text-[34px] leading-none text-ink tabular-nums">
          {displayed}
          <span className="text-sm text-muted font-sans font-medium">%</span>
        </span>
        <span className="text-[11px] text-muted mt-1">Security score</span>
      </div>
    </div>
  )
}

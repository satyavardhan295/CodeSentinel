import React from 'react'
import { CheckCircle2 } from 'lucide-react'

interface ToastProps {
  message: string | null
  onClose?: () => void
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 bg-surface text-ink border border-line rounded-md overlay-shadow text-xs font-medium"
    >
      <CheckCircle2 size={16} strokeWidth={1.5} className="text-severity-fixed shrink-0" />
      <span>{message}</span>
    </div>
  )
}

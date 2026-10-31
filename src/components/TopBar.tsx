import React from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Menu, Sparkles } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

interface TopBarProps {
  onToggleSidebar: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-14 bg-surface border-b border-line px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 text-muted hover:text-ink md:hidden rounded-sm border border-line"
          aria-label="Toggle navigation menu"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 text-muted hover:text-ink rounded-md border border-line hover:bg-bg transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? (
            <Sun size={16} strokeWidth={1.5} />
          ) : (
            <Moon size={16} strokeWidth={1.5} />
          )}
        </button>

        {/* Upgrade link */}
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover transition-colors"
        >
          <Sparkles size={16} strokeWidth={1.5} />
          <span>Get Pro</span>
        </Link>
      </div>
    </header>
  )
}

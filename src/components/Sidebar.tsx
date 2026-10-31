import React from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { scanLink } from '../hooks/useScans'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  ShieldAlert,
  History,
  FileDown,
  Settings,
  PlusCircle,
  ShieldCheck,
  LogOut,
  LogIn
} from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const FOOTER_LINKS = [
  { to: '/about', label: 'About us' },
  { to: '/terms', label: 'Terms & Conditions' }
]

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    onClose()
    await logout()
    navigate('/login', { replace: true })
  }

  // Stay on the same scan when hopping between its dashboard, report and export
  const scanId = useSearchParams()[0].get('scan') ?? undefined
  const navItems = [
    { to: scanLink('dashboard', scanId), label: 'Dashboard', icon: LayoutDashboard },
    { to: scanLink('report', scanId), label: 'Detailed report', icon: ShieldAlert },
    { to: '/history', label: 'Scan history', icon: History },
    { to: scanLink('export', scanId), label: 'Export & share', icon: FileDown },
    { to: '/settings', label: 'Settings', icon: Settings }
  ]

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-56 shrink-0 bg-surface border-r border-line flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* App Logo / Wordmark */}
        <div className="h-14 flex items-center px-4 border-b border-line gap-2.5">
          <div className="w-7 h-7 rounded-sm bg-brand flex items-center justify-center text-white shrink-0">
            <ShieldCheck size={18} strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-heading font-semibold text-ink text-base tracking-tight leading-none">
              CodeSentinel
            </div>
            <div className="text-[11px] text-muted leading-tight mt-0.5">
              Security debt scorer
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="p-3 border-b border-line">
          <NavLink
            to="/"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-brand text-white text-xs font-medium rounded-md hover:bg-brand-hover transition-colors"
          >
            <PlusCircle size={16} strokeWidth={1.5} />
            <span>New scan</span>
          </NavLink>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-bg text-brand font-semibold'
                      : 'text-ink hover:bg-bg/70 hover:text-ink'
                  }`
                }
              >
                <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Signed-in user */}
        <div className="p-3 border-t border-line">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-ink truncate">{user.name}</div>
                <div className="text-[11px] text-muted truncate" title={user.email}>
                  {user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="p-1.5 text-muted hover:text-ink rounded-sm hover:bg-bg transition-colors shrink-0"
              >
                <LogOut size={16} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              onClick={onClose}
              className="flex items-center gap-2 px-1 text-xs font-medium text-brand hover:underline"
            >
              <LogIn size={16} strokeWidth={1.5} />
              Sign in
            </NavLink>
          )}
        </div>

        {/* Footer links */}
        <div className="p-3 border-t border-line flex flex-col gap-1 text-[11px]">
          {FOOTER_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                `px-1 py-0.5 rounded-sm transition-colors ${
                  isActive ? 'text-brand font-medium' : 'text-muted hover:text-ink'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </aside>
    </>
  )
}

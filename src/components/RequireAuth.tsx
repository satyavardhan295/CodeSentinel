import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Skeleton } from './Skeleton'

/** Renders its children only for signed-in users; everyone else goes to /login. */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-8 space-y-6">
        <Skeleton height={40} width={250} />
        <Skeleton height={200} />
      </div>
    )
  }
  if (!user) {
    // Come back to the page they asked for after signing in
    const next = location.pathname + location.search
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <>{children}</>
}

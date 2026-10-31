import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  UNAUTHORIZED_EVENT,
  deleteAccount as apiDeleteAccount,
  getCurrentUser,
  logIn,
  logOut,
  signUp
} from '../api/client'
import { User } from '../types'

interface AuthState {
  user: User | null
  /** True until we know whether someone is signed in */
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  signup: (name: string, email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  deleteAccount: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))

    // Any API call that comes back 401 means the session ended (expired, signed
    // out elsewhere, password changed): drop to the sign-in page.
    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await logIn(email, password)
    setUser(u)
    return u
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const u = await signUp(name, email, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try {
      await logOut()
    } finally {
      setUser(null)
    }
  }, [])

  const deleteAccount = useCallback(async (password: string) => {
    await apiDeleteAccount(password)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

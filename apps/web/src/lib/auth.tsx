import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch } from './api'

export type PublicUser = {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'admin' | 'user'
  mustChangePassword: boolean
  currency: string
  dateFormat: string
  monthStartDay: number
  theme: 'light' | 'dark' | 'system'
  modules: string[]
}

type AuthState = {
  user: PublicUser | null
  loading: boolean
  refresh: () => Promise<void>
  setUser: (user: PublicUser | null) => void
}

const AuthContext = createContext<AuthState | null>(null)

function applyTheme(theme: PublicUser['theme']) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
    return
  }
  document.documentElement.setAttribute('data-theme', theme)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: PublicUser }>('/auth/me')
      setUser(data.user)
      applyTheme(data.user.theme)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (user) applyTheme(user.theme)
  }, [user])

  const value = useMemo(
    () => ({ user, loading, refresh, setUser }),
  [loading, refresh, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth requires AuthProvider')
  return ctx
}

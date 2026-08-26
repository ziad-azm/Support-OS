import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '@/shared/lib/api/client'

import { AuthContext } from './AuthContext'
import { refreshAccessToken } from './refresh'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStorage'
import type { AuthStatus, AuthUser } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!getRefreshToken()) {
        setStatus('unauthenticated')
        return
      }
      const access = await refreshAccessToken()
      if (cancelled) return
      if (!access) {
        setStatus('unauthenticated')
        return
      }
      try {
        const me = await api.get<AuthUser>('/auth/me/')
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      } catch {
        if (cancelled) return
        clearTokens()
        setStatus('unauthenticated')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api.post<{ access: string; refresh: string }>('/auth/token/', {
      email,
      password,
    })
    setAccessToken(tokens.access)
    setRefreshToken(tokens.refresh)
    try {
      const me = await api.get<AuthUser>('/auth/me/')
      setUser(me)
      setStatus('authenticated')
    } catch (error) {
      // Tokens were issued but the profile fetch failed. Do not leave the
      // app in a half-authenticated state with tokens but no user.
      clearTokens()
      setStatus('unauthenticated')
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    clearTokens()
    setUser(null)
    setStatus('unauthenticated')
    if (refresh) {
      try {
        await api.post('/auth/logout/', { refresh })
      } catch {
        // Best-effort. The user is logged out client-side regardless — the
        // server-side token still gets cleaned up on its own expiry.
      }
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
  )
}

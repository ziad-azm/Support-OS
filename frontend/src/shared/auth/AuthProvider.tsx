import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '@/shared/lib/api/client'
import { setMonitoringUser } from '@/shared/lib/monitoring'

import { AuthContext } from './AuthContext'
import { hasPermission } from './permissions'
import { refreshAccessToken } from './refresh'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStorage'
import type { AuthStatus, AuthUser, LoginResult } from './types'

type TokenResponse = { access: string; refresh: string } | { mfa_required: true; mfa_token: string }

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
        // Id only — never email, name, role, or permissions. CONVENTIONS.md § 10.
        setMonitoringUser(me.id)
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

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const response = await api.post<TokenResponse>('/auth/token/', { email, password })
    if ('mfa_required' in response) {
      return { status: 'mfa_required', mfaToken: response.mfa_token }
    }
    setAccessToken(response.access)
    setRefreshToken(response.refresh)
    try {
      const me = await api.get<AuthUser>('/auth/me/')
      setUser(me)
      setMonitoringUser(me.id)
      setStatus('authenticated')
    } catch (error) {
      // Tokens were issued but the profile fetch failed. Do not leave the
      // app in a half-authenticated state with tokens but no user.
      clearTokens()
      setStatus('unauthenticated')
      throw error
    }
    return { status: 'authenticated' }
  }, [])

  const completeMfaChallenge = useCallback(async (mfaToken: string, code: string) => {
    const tokens = await api.post<{ access: string; refresh: string }>('/auth/token/verify-mfa/', {
      mfa_token: mfaToken,
      code,
    })
    setAccessToken(tokens.access)
    setRefreshToken(tokens.refresh)
    try {
      const me = await api.get<AuthUser>('/auth/me/')
      setUser(me)
      setMonitoringUser(me.id)
      setStatus('authenticated')
    } catch (error) {
      clearTokens()
      setStatus('unauthenticated')
      throw error
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await api.get<AuthUser>('/auth/me/')
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    clearTokens()
    setUser(null)
    setMonitoringUser(null)
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

  const can = useCallback((permission: string) => hasPermission(user, permission), [user])

  return (
    <AuthContext.Provider
      value={{ user, status, can, login, completeMfaChallenge, refreshUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

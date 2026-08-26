import { api } from '@/shared/lib/api/client'

import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStorage'

type RefreshResponse = { access: string; refresh?: string }

let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  try {
    const data = await api.post<RefreshResponse>('/auth/token/refresh/', { refresh })
    setAccessToken(data.access)
    // ROTATE_REFRESH_TOKENS is on, so a successful refresh always returns a
    // new refresh token too — persist it, or the NEXT refresh call reuses a
    // token the server already blacklisted. See CONVENTIONS.md §21.
    if (data.refresh) setRefreshToken(data.refresh)
    return data.access
  } catch {
    clearTokens()
    return null
  }
}

/**
 * Single-flight silent refresh. Concurrent 401s must all await the SAME
 * in-flight call — verified finding: with ROTATE_REFRESH_TOKENS +
 * BLACKLIST_AFTER_ROTATION, a second parallel refresh call would present a
 * refresh token the first call already spent and blacklisted, failing with
 * `token_not_valid` for a token that was never stolen, just already used.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/**
 * The access token lives in memory only — never localStorage — so it is not
 * readable by an XSS payload that persists across a reload. The refresh
 * token must survive a reload to keep the user signed in, so it is the one
 * piece of auth state in localStorage, mirroring the precedent set by
 * `supportos.language` and `supportos.theme`.
 */
const REFRESH_TOKEN_STORAGE_KEY = 'supportos.refreshToken'

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token)
    else window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    // Private mode, or storage disabled. The session will not survive a
    // reload, but the current tab keeps working via the in-memory access
    // token.
  }
}

export function clearTokens(): void {
  setAccessToken(null)
  setRefreshToken(null)
}

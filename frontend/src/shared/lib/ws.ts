import { env } from '@/config/env'

/**
 * Derives a WebSocket URL from the same `VITE_API_BASE_URL` the REST client
 * uses (`http://localhost:8000/api` -> `ws://localhost:8000/ws/...`) — no
 * new env var. `wss:` when the API is served over `https:`.
 */
export function getWebSocketUrl(path: string): string {
  const httpBase = env.apiBaseUrl.replace(/\/api$/, '')
  const wsBase = httpBase.replace(/^http/, 'ws')
  return `${wsBase}${path}`
}

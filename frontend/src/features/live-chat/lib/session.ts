import type { LiveChatSession } from '../types/session'

const STORAGE_KEY = 'supportos.liveChat.session'

export function loadSession(): LiveChatSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LiveChatSession
    if (typeof parsed.ticketId !== 'number' || typeof parsed.sessionToken !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: LiveChatSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Private mode / storage disabled — the chat still works for this tab,
    // it just will not resume after a reload.
  }
}

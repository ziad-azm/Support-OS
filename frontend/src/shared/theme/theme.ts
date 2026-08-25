import { DARK_CLASS, DARK_MEDIA_QUERY, FALLBACK_THEME, THEME_STORAGE_KEY, isTheme } from './config'
import type { Theme } from './config'

const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored && isTheme(stored) ? stored : FALLBACK_THEME
  } catch {
    // Private mode, or storage disabled. Fall back rather than crash at boot.
    return FALLBACK_THEME
  }
}

let current: Theme = read()

function prefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches
}

/** The only place the `dark` class is written. direction.ts owns dir/lang. */
function apply(theme: Theme): void {
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle(DARK_CLASS, isDark)
}

export function getTheme(): Theme {
  return current
}

export function setTheme(next: Theme): void {
  current = next
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Nothing to do — the theme still applies for this session.
  }
  apply(next)
  listeners.forEach((listener) => listener())
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initTheme(): void {
  apply(current)
  // Follow the OS only while the user has chosen 'system'.
  window.matchMedia(DARK_MEDIA_QUERY).addEventListener('change', () => {
    if (current === 'system') apply(current)
  })
}

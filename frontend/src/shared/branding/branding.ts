import { foregroundFor } from './contrast'
import {
  BRANDING_STORAGE_KEY,
  HEX_COLOR_RE,
  PRIMARY_FOREGROUND_TOKEN,
  PRIMARY_TOKEN,
} from './config'
import { EMPTY_BRANDING } from './types'
import type { Branding } from './types'

const listeners = new Set<() => void>()

/** The shape written to `localStorage` — NOT `Branding`. `primary`/
 * `primaryForeground` are already-RESOLVED CSS values (not the raw
 * `primary_color` hex), so `index.html`'s inline anti-FOUC script can
 * apply them with zero colour arithmetic of its own. Empty strings mean
 * "no override" — the same sentinel `Branding.primary_color` itself uses. */
type BrandingCache = {
  name: string
  logo_url: string
  primary: string
  primaryForeground: string
}

function isBrandingCache(value: unknown): value is BrandingCache {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    typeof record.logo_url === 'string' &&
    typeof record.primary === 'string' &&
    typeof record.primaryForeground === 'string'
  )
}

function read(): Branding {
  try {
    const stored = window.localStorage.getItem(BRANDING_STORAGE_KEY)
    if (!stored) return EMPTY_BRANDING
    const parsed: unknown = JSON.parse(stored)
    if (!isBrandingCache(parsed)) return EMPTY_BRANDING
    return { name: parsed.name, logo_url: parsed.logo_url, primary_color: parsed.primary }
  } catch {
    // Private mode, storage disabled, or malformed JSON. Fall back rather
    // than crash at boot.
    return EMPTY_BRANDING
  }
}

let current: Branding = read()

/** The only place `--primary`/`--primary-foreground` are written. */
function apply(branding: Branding): void {
  const root = document.documentElement
  const colour = HEX_COLOR_RE.test(branding.primary_color) ? branding.primary_color : null
  if (colour === null) {
    // removeProperty, NOT setProperty(token, ''): an empty inline value
    // still shadows index.css's `:root`/`.dark` declarations, which would
    // paint every primary surface transparent instead of restoring the
    // DSN default. Blank means default, not blank (see `## Product rules`).
    root.style.removeProperty(PRIMARY_TOKEN)
    root.style.removeProperty(PRIMARY_FOREGROUND_TOKEN)
    return
  }
  // Inline style beats both `:root` and `.dark` (a class selector on this
  // same element), so one value covers both themes — the choice
  // index.css:87 already made for --primary.
  root.style.setProperty(PRIMARY_TOKEN, colour)
  root.style.setProperty(PRIMARY_FOREGROUND_TOKEN, foregroundFor(colour))
}

function write(branding: Branding): void {
  try {
    const colour = HEX_COLOR_RE.test(branding.primary_color) ? branding.primary_color : ''
    const cache: BrandingCache = {
      name: branding.name,
      logo_url: branding.logo_url,
      primary: colour,
      primaryForeground: colour ? foregroundFor(colour) : '',
    }
    window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Nothing to do — branding still applies for this session.
  }
}

export function getBranding(): Branding {
  return current
}

export function setBranding(next: Branding): void {
  current = next
  write(next)
  apply(next)
  listeners.forEach((listener) => listener())
}

export function subscribeBranding(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function initBranding(): void {
  apply(current)
}

/**
 * Error monitoring. Entirely inert without VITE_SENTRY_DSN — every export is
 * a no-op, so no call site needs a guard and dev is unaffected.
 *
 * This is the "logging service" `shared/lib/logger.ts` promised would go
 * behind it. `logger` calls into this module; this module never calls
 * `logger`, and never touches `console` (oxlint `no-console` is on for every
 * file except logger.ts itself).
 *
 * PROD-1 (Story 88). See CONVENTIONS.md § 34.
 */
import * as Sentry from '@sentry/react'

import { env } from '@/config/env'

let enabled = false

export function initMonitoring(): void {
  if (!env.sentryDsn) return
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment,
    // Errors only — performance tracing is PROD-2's call, not this story's.
    integrations: [],
    tracesSampleRate: 0,
    // CONVENTIONS.md § 10: no emails, no IPs, no request bodies. The only
    // identity this app ever sends is the numeric user id (setMonitoringUser).
    sendDefaultPii: false,
  })
  enabled = true
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function addMonitoringBreadcrumb(level: 'warning' | 'error', message: string): void {
  if (!enabled) return
  Sentry.addBreadcrumb({ level, message })
}

/** `null` on logout. Never send email, name, or role — id only. */
export function setMonitoringUser(id: number | null): void {
  if (!enabled) return
  Sentry.setUser(id === null ? null : { id: String(id) })
}

/**
 * The only module that reads `import.meta.env`. Everything else imports `env`
 * from here so a missing variable fails once, at boot, with a fixable message.
 */
type AppEnv = {
  readonly apiBaseUrl: string
  /** Empty string = error monitoring disabled. The normal local default. */
  readonly sentryDsn: string
  readonly sentryEnvironment: string
}

function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy frontend/.env.example to frontend/.env and fill it in.',
    )
  }
  return value.trim().replace(/\/+$/, '')
}

/**
 * For variables whose absence is normal, not a misconfiguration. `requireEnv`
 * throws at boot on a blank value, and a blank Sentry DSN is the expected
 * state in dev — booting must never depend on having an error tracker.
 */
function optionalEnv(name: keyof ImportMetaEnv, fallback = ''): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : fallback
}

export const env: AppEnv = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL'),
  sentryDsn: optionalEnv('VITE_SENTRY_DSN'),
  sentryEnvironment: optionalEnv('VITE_SENTRY_ENVIRONMENT', 'local'),
}

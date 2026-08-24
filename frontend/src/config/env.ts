/**
 * The only module that reads `import.meta.env`. Everything else imports `env`
 * from here so a missing variable fails once, at boot, with a fixable message.
 */
type AppEnv = {
  readonly apiBaseUrl: string
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

export const env: AppEnv = {
  apiBaseUrl: requireEnv('VITE_API_BASE_URL'),
}

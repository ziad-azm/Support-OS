/**
 * The only sanctioned console access in the app. `debug` and `info` are
 * stripped outside dev so production consoles stay readable; `warn` and
 * `error` always emit.
 *
 * Not a logging service — when one is added it goes behind this module, and
 * no call site changes.
 */
const PREFIX = '[SupportOS]'

const isDev = import.meta.env.DEV

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) console.debug(PREFIX, ...args)
  },
  info(...args: unknown[]): void {
    if (isDev) console.info(PREFIX, ...args)
  },
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args)
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args)
  },
}

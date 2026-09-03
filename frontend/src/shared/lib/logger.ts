/**
 * The only sanctioned console access in the app. `debug` and `info` are
 * stripped outside dev so production consoles stay readable; `warn` and
 * `error` always emit.
 *
 * The logging service now sits behind this module, exactly as planned: PROD-1
 * routes `warn`/`error` to `shared/lib/monitoring` as Sentry breadcrumbs, and
 * no call site changed. `debug`/`info` stay breadcrumb-free — they are already
 * stripped outside dev, so forwarding them would send nothing in production.
 */
import { addMonitoringBreadcrumb } from './monitoring'

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
    addMonitoringBreadcrumb('warning', args.map(String).join(' '))
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args)
    addMonitoringBreadcrumb('error', args.map(String).join(' '))
  },
}

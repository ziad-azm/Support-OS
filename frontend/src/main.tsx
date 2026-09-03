import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

// Side-effect imports: must run before any component calling useTranslation()
// or useTheme() is imported, or the first render sees an uninitialised
// i18next instance / stale theme class. ./shared/validation reads the
// i18next instance, so it must come after ./shared/i18n. ./shared/branding
// writes inline custom properties on <html> and must run before the first
// component render for the same reason the theme class must; it comes
// after ./shared/theme because both write to document.documentElement and
// the theme's class is what decides which index.css block the
// un-overridden tokens come from.
import './shared/i18n'
import './shared/theme'
import './shared/branding'
import './shared/validation'
import './shared/auth'

import { AppProviders } from './app/providers'
import { router } from './app/router'
import { env } from './config/env'
import { logger } from './shared/lib/logger'
import { initMonitoring } from './shared/lib/monitoring'
import './index.css'

// Before createRoot, and before the first logger call: `logger` forwards to
// addMonitoringBreadcrumb, and a breadcrumb recorded before init is dropped.
// A boot-time crash is the case error monitoring most needs to cover.
initMonitoring()

logger.info('API base URL:', env.apiBaseUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)

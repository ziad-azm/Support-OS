import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

// Side-effect import: must run before any component calling useTranslation()
// is imported, or the first render sees an uninitialised i18next instance.
import './shared/i18n'

import { AppProviders } from './app/providers'
import { router } from './app/router'
import { env } from './config/env'
import { logger } from './shared/lib/logger'
import './index.css'

logger.info('API base URL:', env.apiBaseUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { createQueryClient } from '@/shared/lib/api/queryClient'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary'
import { ToastProvider } from '@/shared/ui/toast/ToastProvider'
import { pushToast } from '@/shared/ui/toast/toastSink'

export function AppProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation('errors')

  // useState, not a module constant: one client per app instance, and tests get
  // a fresh cache per render. `t` is captured once here, but i18next's `t`
  // reads the active language at call time, not at closure-creation time, so
  // this still reflects a later language switch. See CONVENTIONS.md §18.
  const [queryClient] = useState(() =>
    createQueryClient((error) =>
      pushToast({
        tone: 'error',
        message: t(error.code, { defaultValue: error.message }),
      }),
    ),
  )

  return (
    <AppErrorBoundary>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
        </QueryClientProvider>
      </ToastProvider>
    </AppErrorBoundary>
  )
}

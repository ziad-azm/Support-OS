import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { createQueryClient } from '@/shared/lib/api/queryClient'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary'
import { ToastProvider } from '@/shared/ui/toast/ToastProvider'
import { pushToast } from '@/shared/ui/toast/toastSink'

export function AppProviders({ children }: { children: ReactNode }) {
  // useState, not a module constant: one client per app instance, and tests get
  // a fresh cache per render.
  const [queryClient] = useState(() =>
    createQueryClient((error) => pushToast({ tone: 'error', message: error.message })),
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

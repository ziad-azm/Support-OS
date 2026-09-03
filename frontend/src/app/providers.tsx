import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Direction } from 'radix-ui'

import { AuthProvider } from '@/shared/auth'
import { useDirection } from '@/shared/i18n/useDirection'
import { createQueryClient } from '@/shared/lib/api/queryClient'
import { AppErrorBoundary } from '@/shared/ui/AppErrorBoundary'
import { ConfirmProvider } from '@/shared/ui/confirm/ConfirmProvider'
import { ToastProvider } from '@/shared/ui/toast/ToastProvider'
import { pushToast } from '@/shared/ui/toast/toastSink'

import { BrandingSync } from './BrandingSync'

export function AppProviders({ children }: { children: ReactNode }) {
  const { t } = useTranslation('errors')
  const dir = useDirection()

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
      {/*
        Radix reads direction from THIS context, not from <html dir>. Verified:
        useDirection() in @radix-ui/react-direction falls back to the literal
        'ltr' and never inspects the DOM. Without this provider every Select,
        DropdownMenu, and Tabs keeps LTR arrow-key and side/align behaviour in
        Arabic — silently. See CONVENTIONS.md §19.
      */}
      <Direction.DirectionProvider dir={dir}>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <BrandingSync />
                {children}
                {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
              </QueryClientProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </Direction.DirectionProvider>
    </AppErrorBoundary>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/primitives/button'

import { ToastContext } from './ToastContext'
import { setToastSink } from './toastSink'
import type { Toast, PushToastInput } from './types'

const AUTO_DISMISS_MS = 6_000

let nextId = 0

/**
 * Restyled by Story 06 with the shadcn/Tailwind treatment. UI-1's promise —
 * unchanged shape behind `useToast()` — holds; the fixed container is
 * anchored with a logical end offset (never a physical right offset), so it
 * lands bottom-left in Arabic. See CONVENTIONS.md §19.
 *
 * Registers itself as the module-level toast sink on mount (see
 * `toastSink.ts`) so code outside React — the QueryClient's onError — can
 * still surface a toast.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (input: PushToastInput) => {
      const id = `toast-${(nextId += 1)}`
      setToasts((current) => [...current, { id, ...input }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
    },
    [dismiss],
  )

  useEffect(() => {
    setToastSink(toast)
    return () => setToastSink(null)
  }, [toast])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 end-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            data-tone={toastItem.tone}
            className={cn(
              'flex items-start gap-2 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-lg',
              'data-[tone=error]:border-destructive data-[tone=error]:text-destructive',
            )}
          >
            <span className="flex-1">{toastItem.message}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => dismiss(toastItem.id)}
              aria-label={t('actions.dismiss')}
            >
              <XIcon />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

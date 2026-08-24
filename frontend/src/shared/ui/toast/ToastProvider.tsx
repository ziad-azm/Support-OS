import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ToastContext } from './ToastContext'
import { setToastSink } from './toastSink'
import type { Toast, PushToastInput } from './types'

const AUTO_DISMISS_MS = 6_000

let nextId = 0

/**
 * Minimal, near-unstyled toast list. UI-1 may swap the renderer behind
 * `useToast()` without changing its shape.
 *
 * Registers itself as the module-level toast sink on mount (see
 * `toastSink.ts`) so code outside React — the QueryClient's onError — can
 * still surface a toast.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
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
      <div role="status" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} data-tone={t.tone}>
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

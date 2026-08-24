import { createContext } from 'react'

import type { PushToastInput } from './types'

export type ToastContextValue = {
  toast: (input: PushToastInput) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

import { useContext } from 'react'

import { ConfirmContext } from './ConfirmContext'
import type { ConfirmContextValue } from './ConfirmContext'

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm() must be used within a <ConfirmProvider>.')
  }
  return context
}

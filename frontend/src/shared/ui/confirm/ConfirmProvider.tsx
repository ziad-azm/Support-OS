import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/primitives/alert-dialog'

import { ConfirmContext } from './ConfirmContext'
import type { ConfirmOptions } from './types'

type Pending = { options: ConfirmOptions; resolve: (value: boolean) => void }

/**
 * Renders a single AlertDialog and resolves `confirm()`'s promise from
 * whichever of confirm/cancel/Escape/overlay-dismiss fires. `resolvedRef`
 * guards against resolving twice — Radix's AlertDialogAction/Cancel both
 * trigger `onOpenChange(false)` after their own onClick runs, so a naive
 * implementation would call `resolve` a second time on every interaction.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<Pending | null>(null)
  const resolvedRef = useRef(false)

  const settle = useCallback((value: boolean) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setPending((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolvedRef.current = false
      setPending({ options, resolve })
    })
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) settle(false)
        }}
      >
        {pending ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pending.options.title}</AlertDialogTitle>
              {pending.options.description ? (
                <AlertDialogDescription>{pending.options.description}</AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>
                {pending.options.cancelLabel ?? t('actions.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={pending.options.destructive ? 'destructive' : 'default'}
                onClick={() => settle(true)}
              >
                {pending.options.confirmLabel ?? t('actions.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

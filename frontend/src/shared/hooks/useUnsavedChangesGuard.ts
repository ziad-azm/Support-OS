import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'

import { useConfirm } from '@/shared/ui/confirm/useConfirm'

/** Warns before navigating away (in-app or tab close) while `isDirty` is
 *  true. `useBlocker` handles in-app route changes — its own returned
 *  blocker carries no UI, so a `blocked` state is driven through the shared
 *  `useConfirm()` dialog, the same confirmation surface every destructive
 *  action in this app already uses. `beforeunload` covers tab close/
 *  refresh, which react-router cannot intercept. */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const { t } = useTranslation()
  const { confirm } = useConfirm()

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void (async () => {
      const confirmed = await confirm({
        title: t('unsavedChanges.title'),
        description: t('unsavedChanges.description'),
        destructive: true,
      })
      if (confirmed) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    })()
  }, [blocker, confirm, t])

  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
}

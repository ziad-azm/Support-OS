import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'

type FormDialogProps = {
  open: boolean
  /** Called with `false` once the close is confirmed (or there was nothing
   *  to confirm) — never called with `true` from inside; opening is driven
   *  by the route itself mounting this component. */
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** `form.formState.isDirty` — gates the confirm prompt on every dismiss
   *  path (Escape, overlay click, the built-in close button, and the
   *  Cancel button below, all via the same Radix `onOpenChange`). */
  isDirty: boolean
  /** Widens beyond `dialog.tsx`'s `sm:max-w-lg` default for a bilingual
   *  form — pass `'sm:max-w-2xl'`, matching the form's pre-migration
   *  container width. */
  contentClassName?: string
  children: ReactNode
}

/** The one dialog-form wrapper every migrated form uses — composes
 *  `dialog.tsx` with `FORM`'s existing validation/error-summary/
 *  submit-state behavior (inherited for free: the caller's own `<Form>` +
 *  field components render unchanged inside `children`). See
 *  CONVENTIONS.md's `DSN-15` entry. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  isDirty,
  contentClassName,
  children,
}: FormDialogProps) {
  const { t } = useTranslation()
  const { confirm } = useConfirm()

  async function handleOpenChange(next: boolean) {
    if (next) return
    if (isDirty) {
      const confirmed = await confirm({
        title: t('unsavedChanges.title'),
        description: t('unsavedChanges.description'),
        destructive: true,
      })
      if (!confirmed) return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export { DialogClose as FormDialogClose, DialogFooter as FormDialogFooter }

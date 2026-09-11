import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/primitives/dialog'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SubmitButton,
  SwitchField,
  TextField,
  useAppForm,
} from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreateSavedView, useRenameSavedView } from '../api/useSavedViewMutations'
import type { SavedView } from '../types/savedView'

const schema = z.object({
  name: requiredString(100),
  is_shared: z.boolean(),
})

type FormValues = z.output<typeof schema>

/**
 * A new, deliberate composition of `Dialog` and `useAppForm` — no existing
 * consumer combines them (Story 108 `## Context`, item 16). One component
 * for both "save current view" (create) and "rename" (update), the same
 * "one component, two modes" shape `CategoryFormPage` uses.
 */
export function SaveViewDialog({
  open,
  onOpenChange,
  mode,
  view,
  filters,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'save' | 'rename'
  /** Required when `mode === 'rename'`. */
  view?: SavedView
  /** The current filter/sort state — used only in `mode === 'save'`. */
  filters?: Record<string, string>
  onSaved: (view: SavedView) => void
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema,
    defaultValues: { name: view?.name ?? '', is_shared: view?.is_shared ?? false },
  })
  const createMutation = useCreateSavedView()
  const renameMutation = useRenameSavedView(view?.id ?? 0)
  const mutation = mode === 'save' ? createMutation : renameMutation

  function onSubmit(values: FormValues) {
    const onSuccess = (savedView: SavedView) => {
      toast({
        tone: 'success',
        message: t(mode === 'save' ? 'savedViews.created' : 'savedViews.updated'),
      })
      onOpenChange(false)
      onSaved(savedView)
    }
    const onError = (error: unknown) => {
      if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
    }
    if (mode === 'save') {
      createMutation.mutate({ ...values, filters: filters ?? {} }, { onSuccess, onError })
    } else {
      renameMutation.mutate(values, { onSuccess, onError })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(mode === 'save' ? 'savedViews.saveDialog.title' : 'savedViews.renameDialog.title')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <TextField control={form.control} name="name" label={t('savedViews.fields.name')} />
            <SwitchField
              control={form.control}
              name="is_shared"
              label={t('savedViews.fields.shared')}
              description={t('savedViews.fields.sharedDescription')}
            />
            <FormErrorSummary errors={formErrors} />
            <DialogFooter>
              <SubmitButton pending={mutation.isPending}>{t('actions.save')}</SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

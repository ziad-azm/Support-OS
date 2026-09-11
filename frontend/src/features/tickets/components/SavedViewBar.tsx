import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSavedViews } from '../api/useSavedViews'
import { useDeleteSavedView, useSetDefaultSavedView } from '../api/useSavedViewMutations'
import { SaveViewDialog } from './SaveViewDialog'

const CUSTOM = 'custom'

export function SavedViewBar({
  filters,
  selectedViewId,
  onSelectView,
  onApply,
}: {
  /** The list's current filter/sort state, as query params — passed to
   * "Save current view." */
  filters: Record<string, string>
  selectedViewId: number | null
  onSelectView: (id: number | null) => void
  /** Applies a chosen view's filters onto the page's own filter state. */
  onApply: (filters: Record<string, string>) => void
}) {
  const { t } = useTranslation('tickets')
  const { user, can } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const savedViewsQuery = useSavedViews()
  const deleteMutation = useDeleteSavedView()
  const setDefaultMutation = useSetDefaultSavedView()
  const [dialog, setDialog] = useState<'save' | 'rename' | null>(null)

  const views = savedViewsQuery.data?.items ?? []
  const selectedView = views.find((view) => view.id === selectedViewId) ?? null
  const canEditSelected =
    selectedView !== null && (selectedView.owner === user?.id || can('tickets.manage'))

  function handleSelect(value: string) {
    if (value === CUSTOM) {
      onSelectView(null)
      return
    }
    const view = views.find((candidate) => String(candidate.id) === value)
    if (!view) return
    onSelectView(view.id)
    onApply(view.filters)
  }

  async function handleDelete() {
    if (!selectedView) return
    const ok = await confirm({
      title: t('savedViews.delete.title'),
      description: t('savedViews.delete.description'),
      destructive: true,
    })
    if (!ok) return
    deleteMutation.mutate(selectedView.id, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('savedViews.deleted') })
        onSelectView(null)
      },
    })
  }

  function handleToggleDefault() {
    if (!selectedView || selectedView.owner !== user?.id) return
    setDefaultMutation.mutate(
      { id: selectedView.id, isDefault: !selectedView.is_default },
      {
        onSuccess: () => toast({ tone: 'success', message: t('savedViews.defaultUpdated') }),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedViewId ? String(selectedViewId) : CUSTOM} onValueChange={handleSelect}>
        <SelectTrigger aria-label={t('savedViews.switcherLabel')} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CUSTOM}>{t('savedViews.customOption')}</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={String(view.id)}>
              {view.name}
              {view.is_default && view.owner === user?.id
                ? ` (${t('savedViews.defaultBadge')})`
                : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedView?.is_shared ? (
        <Badge variant="secondary">{t('savedViews.sharedBadge')}</Badge>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={() => setDialog('save')}>
        {t('savedViews.actions.save')}
      </Button>
      {canEditSelected ? (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => setDialog('rename')}>
            {t('savedViews.actions.rename')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void handleDelete()}>
            {t('savedViews.actions.delete')}
          </Button>
        </>
      ) : null}
      {selectedView && selectedView.owner === user?.id ? (
        <Button type="button" variant="ghost" size="sm" onClick={handleToggleDefault}>
          {t(
            selectedView.is_default
              ? 'savedViews.actions.clearDefault'
              : 'savedViews.actions.setDefault',
          )}
        </Button>
      ) : null}
      {dialog === 'save' ? (
        <SaveViewDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode="save"
          filters={filters}
          onSaved={(view) => onSelectView(view.id)}
        />
      ) : null}
      {dialog === 'rename' && selectedView ? (
        <SaveViewDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode="rename"
          view={selectedView}
          onSaved={() => undefined}
        />
      ) : null}
    </div>
  )
}

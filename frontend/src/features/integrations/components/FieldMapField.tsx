import { useState } from 'react'
import { ArrowRightIcon, PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { FormItem, FormLabel } from '@/shared/ui/primitives/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import type { MapTarget } from '../types/erp'

/**
 * A local, single-consumer ERP-field -> SupportOS-field editor — not a new
 * `shared/ui/form/` component, the same reasoning `StringListField`
 * (`frontend/src/features/organization/components/SettingsPage.tsx`)
 * records for itself: this has exactly one consumer today (CONVENTIONS.md
 * §8, §23). Bound through `FormField`'s render prop by the caller, because
 * `useFieldArray` appears nowhere in this codebase.
 *
 * The target is a `Select` restricted to `allowedTargets`, not a free-text
 * input — the backend's allowlist (`apps.integrations.erp_sync
 * .CUSTOMER_SYNCABLE_FIELDS`/`ORDER_SYNCABLE_FIELDS`) rejects anything else
 * with a 400, so offering a text box would invite an error this component
 * can prevent outright.
 */
export function FieldMapField({
  label,
  value,
  onChange,
  allowedTargets,
  addLabel,
  sourcePlaceholder,
}: {
  label: string
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  allowedTargets: readonly MapTarget[]
  addLabel: string
  sourcePlaceholder: string
}) {
  const { t } = useTranslation('integrations')
  const [draftSource, setDraftSource] = useState('')
  const [draftTarget, setDraftTarget] = useState<MapTarget | ''>(allowedTargets[0] ?? '')

  const entries = Object.entries(value)

  function removeEntry(source: string) {
    const next = { ...value }
    delete next[source]
    onChange(next)
  }

  function addEntry() {
    const trimmed = draftSource.trim()
    if (trimmed === '' || draftTarget === '') return
    onChange({ ...value, [trimmed]: draftTarget })
    setDraftSource('')
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex flex-col gap-2">
        {entries.map(([source, target]) => (
          <div key={source} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-md border border-input px-3 py-1.5 text-sm">
              {source}
            </span>
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
            />
            <Select value={target} onValueChange={(next) => onChange({ ...value, [source]: next })}>
              <SelectTrigger aria-label={t('erp.maps.targetLabel')} size="sm" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTargets.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`erp.maps.targets.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('erp.maps.removeMapping', { source })}
              onClick={() => removeEntry(source)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draftSource}
          onChange={(event) => setDraftSource(event.target.value)}
          placeholder={sourcePlaceholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addEntry()
            }
          }}
        />
        <ArrowRightIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
        />
        <Select value={draftTarget} onValueChange={(next) => setDraftTarget(next as MapTarget)}>
          <SelectTrigger aria-label={t('erp.maps.targetLabel')} size="sm" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allowedTargets.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`erp.maps.targets.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
    </FormItem>
  )
}

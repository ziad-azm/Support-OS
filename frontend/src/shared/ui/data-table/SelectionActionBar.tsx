import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

/**
 * The reusable shell for a `DataTable` bulk-action bar (TKT-7) — renders
 * nothing when `count` is 0, so a consuming page can mount it
 * unconditionally. The buttons/controls inside are entirely the caller's:
 * this component knows nothing about what a "bulk action" does, only how
 * to show a selection count and a way to clear it — the same "mechanism
 * here, feature-specific content at the call site" split `DataTable`
 * itself follows for column definitions.
 */
export function SelectionActionBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (count === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2">
      <span className="text-sm font-medium">{t('table.selectedCount', { count })}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button type="button" variant="ghost" size="sm" onClick={onClear} className="ms-auto">
        {t('table.clearSelection')}
      </Button>
    </div>
  )
}

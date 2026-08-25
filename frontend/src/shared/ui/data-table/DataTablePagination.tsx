import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useDirection } from '@/shared/i18n/useDirection'
import { useFormatters } from '@/shared/hooks/useFormatters'
import type { ApiPagination } from '@/shared/lib/api/types'
import { Button } from '@/shared/ui/primitives/button'

type DataTablePaginationProps = {
  pagination: ApiPagination
  onPageChange: (page: number) => void
}

/**
 * Chevrons swap by direction — a chevron is directional semantics, unlike a
 * spinner. `disabled` is driven off `pagination.previous`/`next`, not
 * arithmetic on `page`: the backend already computed them, and duplicating
 * that logic is how the two disagree at the boundary. See CONVENTIONS.md §19.
 */
export function DataTablePagination({ pagination, onPageChange }: DataTablePaginationProps) {
  const { t } = useTranslation()
  const dir = useDirection()
  const { number } = useFormatters()

  const PreviousIcon = dir === 'rtl' ? ChevronRightIcon : ChevronLeftIcon
  const NextIcon = dir === 'rtl' ? ChevronLeftIcon : ChevronRightIcon

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">
        {t('table.rowCount', { count: pagination.count, displayCount: number(pagination.count) })}
      </span>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={pagination.previous === null}
            aria-label={t('table.previousPage')}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            <PreviousIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={pagination.next === null}
            aria-label={t('table.nextPage')}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            <NextIcon />
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {t('table.pageOf', {
            page: number(pagination.page),
            total: number(pagination.num_pages),
          })}
        </span>
      </div>
    </div>
  )
}

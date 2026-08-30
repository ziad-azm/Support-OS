import { useState } from 'react'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { ChartNoAxesColumnIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiRequestError } from '@/shared/lib/api/errors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import { Empty } from '@/shared/ui/Empty'
import { ErrorState } from '@/shared/ui/ErrorState'

type ChartFrameProps<T> = {
  title: string
  /** Optional one-line description under the title. */
  description?: string
  query: UseQueryResult<T, unknown>
  /** The chart body. Only called on success with non-empty data. */
  children: (data: T) => ReactNode
  /** Treat this data as "nothing to chart". */
  isEmpty?: (data: T) => boolean
  /** The accessibility fallback — CONVENTIONS.md § 25 lines 1638-1642
   * requires a visible data table or text summary for EVERY chart, so this
   * is REQUIRED, not optional. */
  table: (data: T) => ReactNode
  /** Rendered next to the title (a range picker, an export button). */
  action?: ReactNode
}

/**
 * The reusable chart wrapper the intake asks for (RPT-0) — composes
 * existing primitives, restyles none of them (CONVENTIONS.md § 7 / § 19).
 *
 * Follows `QueryBoundary`'s `query`/`children(data)` contract, not
 * `DataTable`'s, because a chart's non-success states render fine inside a
 * plain `<div>` — unlike `DataTable`, which must stay inside a `<tbody>`.
 */
export function ChartFrame<T>({
  title,
  description,
  query,
  children,
  isEmpty,
  table,
  action,
}: ChartFrameProps<T>) {
  const { t } = useTranslation()
  const [showTable, setShowTable] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isPending ? <Skeleton className="h-64 w-full" /> : null}

        {query.isError
          ? (() => {
              const error =
                query.error instanceof ApiRequestError
                  ? query.error
                  : new ApiRequestError({
                      code: 'unknown_error',
                      message: t('states.error.generic'),
                    })
              return <ErrorState error={error} onRetry={() => void query.refetch()} />
            })()
          : null}

        {query.isSuccess && isEmpty?.(query.data) ? (
          <Empty title={t('chart.empty')} icon={<ChartNoAxesColumnIcon className="size-8" />} />
        ) : null}

        {query.isSuccess && !isEmpty?.(query.data) ? (
          <>
            <div role="img" aria-label={title}>
              {children(query.data)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={showTable}
              onClick={() => setShowTable((current) => !current)}
            >
              {t(showTable ? 'chart.hideTable' : 'chart.showTable')}
            </Button>
            {showTable ? table(query.data) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

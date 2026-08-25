import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ApiRequestError } from '@/shared/lib/api/errors'

import { Empty } from './Empty'
import { ErrorState } from './ErrorState'
import { Loading } from './Loading'

type QueryBoundaryProps<T> = {
  query: UseQueryResult<T, unknown>
  children: (data: T) => ReactNode
  /** Treat this data as "nothing to show" and render the empty state. */
  isEmpty?: (data: T) => boolean
  loading?: ReactNode
  empty?: ReactNode
}

/**
 * The single component that turns a TanStack Query result into UI. This is
 * the "one consistent way" to render loading/error/empty — never hand-roll
 * isPending/isError branches in a feature.
 */
export function QueryBoundary<T>({
  query,
  children,
  isEmpty,
  loading,
  empty,
}: QueryBoundaryProps<T>) {
  const { t } = useTranslation()

  if (query.isPending) return <>{loading ?? <Loading />}</>

  if (query.isError) {
    const error =
      query.error instanceof ApiRequestError
        ? query.error
        : new ApiRequestError({ code: 'unknown_error', message: t('states.error.generic') })
    return <ErrorState error={error} onRetry={() => void query.refetch()} />
  }

  const data = query.data as T
  if (isEmpty?.(data)) return <>{empty ?? <Empty />}</>

  return <>{children(data)}</>
}

import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useRouteError } from 'react-router'

import { ApiRequestError } from '@/shared/lib/api/errors'
import { ErrorState } from '@/shared/ui/ErrorState'

/** The `errorElement` for every route — catches crashes during route render/load. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const { t } = useTranslation()

  if (error instanceof ApiRequestError) {
    return <ErrorState error={error} />
  }

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert">
        <p>
          {error.status} {error.statusText}
        </p>
      </div>
    )
  }

  return (
    <div role="alert">
      <p>{t('states.error.route')}</p>
    </div>
  )
}

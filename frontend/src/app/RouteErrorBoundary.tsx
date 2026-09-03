import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'

import { ApiRequestError } from '@/shared/lib/api/errors'
import { captureError } from '@/shared/lib/monitoring'
import { Button } from '@/shared/ui/primitives/button'
import { ErrorState } from '@/shared/ui/ErrorState'

/** The `errorElement` for every route — catches crashes during route render/load. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Only the unknown branch is a real crash. An ApiRequestError is already a
  // logged server-side event carrying its own request_id — reporting it again
  // from the client would duplicate every 500 and turn every user's flaky
  // wifi into an issue. An isRouteErrorResponse is a router 404: navigation,
  // not a crash. In a useEffect so a re-render cannot report twice.
  useEffect(() => {
    if (error instanceof ApiRequestError || isRouteErrorResponse(error)) return
    captureError(error, { source: 'route' })
  }, [error])

  const goHome = (
    <Button type="button" variant="outline" size="sm" onClick={() => navigate('/')}>
      {t('actions.goHome')}
    </Button>
  )

  if (error instanceof ApiRequestError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <ErrorState error={error} onRetry={() => window.location.reload()} />
        {goHome}
      </div>
    )
  }

  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p>
          {error.status} {t('states.error.route')}
        </p>
        {goHome}
      </div>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p>{t('states.error.route')}</p>
      {goHome}
    </div>
  )
}

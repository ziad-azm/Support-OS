import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'

import { ApiRequestError } from '@/shared/lib/api/errors'
import { Button } from '@/shared/ui/primitives/button'
import { ErrorState } from '@/shared/ui/ErrorState'

/** The `errorElement` for every route — catches crashes during route render/load. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const { t } = useTranslation()
  const navigate = useNavigate()

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

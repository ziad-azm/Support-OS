import { isRouteErrorResponse, useRouteError } from 'react-router'

import { ApiRequestError } from '@/shared/lib/api/errors'
import { ErrorState } from '@/shared/ui/ErrorState'

/** The `errorElement` for every route — catches crashes during route render/load. */
export function RouteErrorBoundary() {
  const error = useRouteError()

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
      <p>Something went wrong loading this page.</p>
    </div>
  )
}

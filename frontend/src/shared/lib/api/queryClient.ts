import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { captureError } from '../monitoring'

import { ApiRequestError } from './errors'

const MAX_RETRIES = 2

/**
 * Retry transport failures and 5xx; never retry a 4xx — a 404 or a validation
 * error will not become true by asking again.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (!(error instanceof ApiRequestError)) return false
  if (error.isTransport) return true
  return error.status !== null && error.status >= 500
}

export type QueryMeta = {
  /** Opt a query into the global error toast. Default: render inline instead. */
  toastOnError?: boolean
}

export function createQueryClient(onError: (error: ApiRequestError) => void): QueryClient {
  const handle = (error: unknown) => {
    // Report only what a user cannot fix and the backend may not have seen: a
    // 5xx (the frontend half of a server error) and a non-ApiRequestError (a
    // bug in our own code path). NOT 4xx — a validation error or a 403 is the
    // system working. NOT isTransport — that is the user's network, and it
    // would make every subway ride an incident.
    if (!(error instanceof ApiRequestError)) {
      captureError(error, { source: 'query' })
    } else if (error.status !== null && error.status >= 500) {
      captureError(error, { source: 'query', requestId: error.requestId, code: error.code })
    }
    onError(
      error instanceof ApiRequestError
        ? error
        : new ApiRequestError({
            code: 'unknown_error',
            message: 'Something went wrong. Please try again.',
          }),
    )
  }

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    // Mutations always toast: they are user-initiated, so silence reads as
    // success. Queries render inline via QueryBoundary and toast only when the
    // query opts in with meta.toastOnError.
    mutationCache: new MutationCache({ onError: handle }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        if ((query.meta as QueryMeta | undefined)?.toastOnError) handle(error)
      },
    }),
  })
}

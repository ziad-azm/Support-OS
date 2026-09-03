import { AxiosError } from 'axios'

import type { ApiErrorBody, ErrorCode } from './types'

/**
 * The only error the API layer throws. Normalises three unrelated failures —
 * a backend envelope error, an HTTP error whose body is not an envelope, and a
 * transport failure with no response at all — into one shape.
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | string
  readonly status: number | null
  readonly fields: Record<string, string[]>
  /**
   * PROD-1 correlation id, when the request reached the backend. Surfaced to
   * the user by `ErrorState` so a support report and a log query meet at the
   * same string. `null` for a timeout or an unreachable server — there was no
   * response, so there is no server-side id.
   */
  readonly requestId: string | null
  readonly debug?: ApiErrorBody['debug']

  constructor(init: {
    code: ErrorCode | string
    message: string
    status?: number | null
    fields?: Record<string, string[]>
    requestId?: string | null
    debug?: ApiErrorBody['debug']
  }) {
    super(init.message)
    this.name = 'ApiRequestError'
    this.code = init.code
    this.status = init.status ?? null
    this.fields = init.fields ?? {}
    this.requestId = init.requestId ?? null
    this.debug = init.debug
  }

  /** Field-level messages, for a form to attach to inputs (FORM-1 consumes this). */
  get fieldErrors(): Record<string, string[]> {
    return this.fields
  }

  /** Messages with no field to attach to. */
  get nonFieldErrors(): string[] {
    return this.fields.non_field_errors ?? []
  }

  get isValidation(): boolean {
    return this.code === 'validation_error'
  }

  get isAuth(): boolean {
    return this.code === 'not_authenticated' || this.code === 'authentication_failed'
  }

  /** 403 — authenticated, but not allowed. Distinct from `isAuth`, which is
   * "not signed in": a forbidden action must NOT trigger a re-login, because
   * signing in again does not grant a permission. See CONVENTIONS.md §22. */
  get isForbidden(): boolean {
    return this.code === 'permission_denied'
  }

  /** Transport-level failure — worth retrying; a 4xx is not. */
  get isTransport(): boolean {
    return this.code === 'network_error' || this.code === 'timeout'
  }
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

/** Turn anything Axios (or the network) throws into an ApiRequestError. */
export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error

  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiRequestError({
        code: 'timeout',
        message: 'The request timed out. Please try again.',
      })
    }

    if (!error.response) {
      return new ApiRequestError({
        code: 'network_error',
        message: 'Cannot reach the server. Check your connection and try again.',
      })
    }

    const status = error.response.status
    const body = error.response.data as { error?: unknown } | undefined
    // Axios lowercases response header keys. This fallback matters more than
    // the body one: a gateway 502 or an HTML 500 from outside the /api/ tree
    // has no envelope to read `request_id` out of, but the header is still
    // there whenever the request reached Django. Resolves to undefined unless
    // the backend sets CORS_EXPOSE_HEADERS — see CONVENTIONS.md § 34.
    const headerRequestId = (error.response.headers?.['x-request-id'] as string) ?? null

    if (body && isApiErrorBody(body.error)) {
      const apiError = body.error
      return new ApiRequestError({
        code: apiError.code,
        message: apiError.message,
        status,
        fields: apiError.fields ?? {},
        requestId: apiError.request_id ?? headerRequestId,
        debug: apiError.debug,
      })
    }

    // An HTTP error whose body is not an envelope: a proxy page, an HTML 500
    // from outside the /api/ tree, a gateway error.
    return new ApiRequestError({
      code: 'unknown_error',
      message: GENERIC_MESSAGE,
      status,
      requestId: headerRequestId,
    })
  }

  return new ApiRequestError({
    code: 'unknown_error',
    message: error instanceof Error ? error.message : GENERIC_MESSAGE,
  })
}

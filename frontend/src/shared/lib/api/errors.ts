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
  readonly debug?: ApiErrorBody['debug']

  constructor(init: {
    code: ErrorCode | string
    message: string
    status?: number | null
    fields?: Record<string, string[]>
    debug?: ApiErrorBody['debug']
  }) {
    super(init.message)
    this.name = 'ApiRequestError'
    this.code = init.code
    this.status = init.status ?? null
    this.fields = init.fields ?? {}
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

    if (body && isApiErrorBody(body.error)) {
      const apiError = body.error
      return new ApiRequestError({
        code: apiError.code,
        message: apiError.message,
        status,
        fields: apiError.fields ?? {},
        debug: apiError.debug,
      })
    }

    // An HTTP error whose body is not an envelope: a proxy page, an HTML 500
    // from outside the /api/ tree, a gateway error.
    return new ApiRequestError({
      code: 'unknown_error',
      message: GENERIC_MESSAGE,
      status,
    })
  }

  return new ApiRequestError({
    code: 'unknown_error',
    message: error instanceof Error ? error.message : GENERIC_MESSAGE,
  })
}

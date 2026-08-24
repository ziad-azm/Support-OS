/**
 * Mirror of the backend response envelope (`backend/apps/core/envelope.py`).
 * If the two ever disagree, the backend is authoritative.
 */

/** Codes the backend can emit — see README § API conventions. */
export const API_ERROR_CODES = [
  'validation_error',
  'parse_error',
  'not_authenticated',
  'authentication_failed',
  'permission_denied',
  'not_found',
  'method_not_allowed',
  'not_acceptable',
  'unsupported_media_type',
  'throttled',
  'internal_error',
] as const

/** Codes this client synthesises when there is no envelope to read. */
export const CLIENT_ERROR_CODES = [
  'network_error',
  'timeout',
  'invalid_envelope',
  'unknown_error',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number]
export type ErrorCode = ApiErrorCode | ClientErrorCode

export type ApiErrorBody = {
  code: string
  message: string
  /** Always an object — `{}` when the error is not field-scoped. */
  fields: Record<string, string[]>
  /** Present only when the backend runs with DEBUG=True. Never depend on it. */
  debug?: { exception: string; traceback: string[] }
}

export type ApiPagination = {
  count: number
  page: number
  page_size: number
  num_pages: number
  next: string | null
  previous: string | null
}

export type ApiMeta = { pagination?: ApiPagination } | null

export type ApiSuccess<T> = {
  success: true
  data: T
  error: null
  meta: ApiMeta
}

export type ApiFailure = {
  success: false
  data: null
  error: ApiErrorBody
  meta: null
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export type Page<T> = {
  items: T[]
  pagination: ApiPagination
}

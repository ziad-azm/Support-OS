import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

import { env } from '@/config/env'

import { ApiRequestError, toApiRequestError } from './errors'
import type { ApiEnvelope, ApiMeta, Page } from './types'

const DEFAULT_TIMEOUT_MS = 15_000

/** The single Axios instance. Do not create another one anywhere in src/. */
export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

type TokenProvider = () => string | null

let tokenProvider: TokenProvider = () => null

/**
 * Seam for AUTH-1. It supplies the real token source; this story ships the hook
 * point only, so no auth storage decision is made prematurely.
 */
export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider
}

httpClient.interceptors.request.use((config) => {
  const token = tokenProvider()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiRequestError(error)),
)

type ApiSuccessParts<T> = { data: T; meta: ApiMeta }

function unwrap<T>(envelope: unknown): ApiSuccessParts<T> {
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    typeof (envelope as { success?: unknown }).success !== 'boolean'
  ) {
    // Most often a misconfigured VITE_API_BASE_URL: a 200 that is not our API.
    throw new ApiRequestError({
      code: 'invalid_envelope',
      message:
        'The server returned an unexpected response. Check VITE_API_BASE_URL in frontend/.env.',
    })
  }

  const body = envelope as ApiEnvelope<T>
  if (!body.success) {
    throw new ApiRequestError({
      code: body.error.code,
      message: body.error.message,
      fields: body.error.fields ?? {},
      debug: body.error.debug,
    })
  }

  return { data: body.data, meta: body.meta }
}

/**
 * Typed request helpers. Every feature calls these — never httpClient directly,
 * and never fetch().
 */
export const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.get<ApiEnvelope<T>>(url, config)
    return unwrap<T>(response.data).data
  },

  async post<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.post<ApiEnvelope<T>>(url, payload, config)
    return unwrap<T>(response.data).data
  },

  async put<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.put<ApiEnvelope<T>>(url, payload, config)
    return unwrap<T>(response.data).data
  },

  async patch<T>(url: string, payload?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.patch<ApiEnvelope<T>>(url, payload, config)
    return unwrap<T>(response.data).data
  },

  async delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.delete<ApiEnvelope<T>>(url, config)
    // 204 has an empty body by design (backend renderer returns b"").
    if (!response.data) return undefined as T
    return unwrap<T>(response.data).data
  },

  /** List endpoints: returns items plus the pagination block from `meta`. */
  async getPage<T>(url: string, config?: AxiosRequestConfig): Promise<Page<T>> {
    const response = await httpClient.get<ApiEnvelope<T[]>>(url, config)
    const { data, meta } = unwrap<T[]>(response.data)
    const pagination = meta?.pagination
    if (!pagination) {
      throw new ApiRequestError({
        code: 'invalid_envelope',
        message: 'Expected a paginated response but meta.pagination was missing.',
      })
    }
    return { items: data, pagination }
  },
}

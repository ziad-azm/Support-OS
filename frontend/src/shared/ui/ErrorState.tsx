import type { ApiRequestError } from '@/shared/lib/api/errors'

/**
 * Minimal, near-unstyled error state. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
 *
 * `error.debug` (traceback) renders only when present — the backend sends it
 * only under DEBUG=True. Never render it unconditionally.
 */
export function ErrorState({ error, onRetry }: { error: ApiRequestError; onRetry?: () => void }) {
  return (
    <div role="alert">
      <p>{error.message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
      {error.debug ? (
        <details>
          <summary>Debug details</summary>
          <pre>{error.debug.exception}</pre>
          <pre>{error.debug.traceback.join('\n')}</pre>
        </details>
      ) : null}
    </div>
  )
}

import { useTranslation } from 'react-i18next'

import type { ApiRequestError } from '@/shared/lib/api/errors'

/**
 * Minimal, near-unstyled error state. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
 *
 * `error.debug` (traceback) renders only when present — the backend sends it
 * only under DEBUG=True. Never render it unconditionally.
 *
 * Copy is looked up by `error.code` against the `errors` namespace, with
 * `error.message` as the `defaultValue` fallback — never translate inside the
 * API layer itself, which would freeze the language at module-import time.
 * See CONVENTIONS.md §18.
 */
export function ErrorState({ error, onRetry }: { error: ApiRequestError; onRetry?: () => void }) {
  const { t } = useTranslation(['common', 'errors'])
  const message = t(`errors:${error.code}`, { defaultValue: error.message })

  return (
    <div role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {t('actions.retry')}
        </button>
      ) : null}
      {error.debug ? (
        <details>
          <summary>{t('debug.details')}</summary>
          <pre>{error.debug.exception}</pre>
          <pre>{error.debug.traceback.join('\n')}</pre>
        </details>
      ) : null}
    </div>
  )
}

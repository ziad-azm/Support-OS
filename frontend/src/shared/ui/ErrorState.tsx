import { useTranslation } from 'react-i18next'

import type { ApiRequestError } from '@/shared/lib/api/errors'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/primitives/alert'
import { Button } from '@/shared/ui/primitives/button'

/**
 * Restyled by Story 06 with the shadcn/Tailwind treatment. Props unchanged
 * from Story 03.
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
    <Alert variant="destructive">
      <AlertTitle title={message}>{message}</AlertTitle>
      <AlertDescription>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        ) : null}
        {error.requestId ? (
          <p className="mt-2 text-xs opacity-70">
            {t('debug.reference')}{' '}
            {/* An id is code: bidi reordering makes it unreadable — and
                unusable to paste into a log query — in an RTL document. Same
                reasoning as the stack-trace block below. */}
            <code dir="ltr">{error.requestId}</code>
          </p>
        ) : null}
        {error.debug ? (
          <details>
            <summary>{t('debug.details')}</summary>
            {/* A stack trace is code — bidi reordering of an RTL document
                makes it unreadable without an explicit dir. See CONVENTIONS.md §18. */}
            <pre dir="ltr" className="overflow-x-auto text-xs">
              {error.debug.exception}
            </pre>
            <pre dir="ltr" className="overflow-x-auto text-xs">
              {error.debug.traceback.join('\n')}
            </pre>
          </details>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

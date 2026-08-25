import { useTranslation } from 'react-i18next'

import { useHealth } from '../api/useHealth'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

/**
 * Reference feature: the whole stack, end to end. No `axios`, no `fetch` here
 * — every future feature should look this shallow.
 */
export function HealthPage() {
  const query = useHealth()
  const { toast } = useToast()
  const { t } = useTranslation('health')

  return (
    <div>
      <h1>{t('title')}</h1>
      <QueryBoundary query={query}>
        {(health) => (
          <ul>
            <li>
              {t('status')}: {t(`value.${health.status}`)}
            </li>
            <li>
              {t('database')}: {t(`value.${health.database}`)}
            </li>
          </ul>
        )}
      </QueryBoundary>
      <button type="button" onClick={() => toast({ tone: 'info', message: t('toastFired') })}>
        {t('testToast')}
      </button>
    </div>
  )
}

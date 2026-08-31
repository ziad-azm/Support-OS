import { useTranslation } from 'react-i18next'

import { useHealth } from '../api/useHealth'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { PageHeader } from '@/shared/ui/PageHeader'
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
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <QueryBoundary query={query}>
            {(health) => (
              <ul className="flex flex-col gap-1 text-sm">
                <li>
                  {t('status')}: {t(`value.${health.status}`)}
                </li>
                <li>
                  {t('database')}: {t(`value.${health.database}`)}
                </li>
              </ul>
            )}
          </QueryBoundary>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => toast({ tone: 'info', message: t('toastFired') })}
          >
            {t('testToast')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

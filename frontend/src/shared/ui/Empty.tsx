import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/shared/ui/primitives/card'

/**
 * Restyled by Story 06 with the shadcn/Tailwind treatment. Props unchanged
 * from Story 03. Centred text is symmetric and therefore direction-neutral —
 * never a physical (left/right) text-alignment utility. See CONVENTIONS.md §19.
 */
export function Empty({
  title,
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Card role="status">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="font-medium">{title ?? t('states.empty.title')}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action}
      </CardContent>
    </Card>
  )
}

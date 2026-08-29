import { InboxIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/shared/ui/primitives/card'

/**
 * Restyled by Story 06 with the shadcn/Tailwind treatment. Props unchanged
 * from Story 03, plus an optional `icon` (Story 50, `DSN-4`) — defaults to a
 * generic inbox icon so every existing consumer inherits one with no
 * per-call-site change; pass a more specific icon when one is warranted.
 * Centred text is symmetric and therefore direction-neutral — never a
 * physical (left/right) text-alignment utility. See CONVENTIONS.md §19.
 */
export function Empty({
  title,
  description,
  action,
  icon,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Card role="status">
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-muted-foreground">{icon ?? <InboxIcon className="size-8" />}</span>
        <p className="font-medium">{title ?? t('states.empty.title')}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action}
      </CardContent>
    </Card>
  )
}

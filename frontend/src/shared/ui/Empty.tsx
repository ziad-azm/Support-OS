import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Minimal, near-unstyled empty state. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
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
    <div role="status">
      <p>{title ?? t('states.empty.title')}</p>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}

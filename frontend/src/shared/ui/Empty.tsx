import type { ReactNode } from 'react'

/**
 * Minimal, near-unstyled empty state. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
 */
export function Empty({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div role="status">
      <p>{title}</p>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  )
}

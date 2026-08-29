import type { ReactNode } from 'react'

/**
 * The one page-level header shape every list/browse screen composes from —
 * replaces 13 duplicated `<div className="flex items-center justify-between
 * gap-4"><h1 className="text-lg font-semibold">…` blocks (Story 50, `DSN-4`).
 * `text-2xl` (up from the prior flat `text-lg`) gives page titles real
 * visual weight above `CardTitle`'s `text-lg` section headings — a genuine
 * two-level type hierarchy where every heading previously read at the same
 * size. Purely presentational: no permission check, no data fetching —
 * `action` is whatever the caller already wraps in `<Can>` or leaves bare.
 */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  )
}

import { Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Restyled by Story 06 with the shadcn/Tailwind treatment. Props unchanged
 * from Story 03 — a spinner's rotation is not directional semantics, so it is
 * never mirrored in RTL. See CONVENTIONS.md §19.
 */
export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 text-muted-foreground"
    >
      <Loader2Icon className="size-4 animate-spin" />
      <span>{label ?? t('states.loading')}</span>
    </div>
  )
}

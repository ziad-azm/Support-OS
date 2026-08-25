import { useTranslation } from 'react-i18next'

/**
 * Minimal, near-unstyled loading indicator. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
 */
export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-live="polite">
      {label ?? t('states.loading')}
    </div>
  )
}

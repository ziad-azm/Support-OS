/**
 * Minimal, near-unstyled loading indicator. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
 */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite">
      {label}
    </div>
  )
}

/**
 * Form-level (unattached) server/client errors — messages `applyServerErrors`
 * could not map to a specific field (`shared/validation/serverErrors.ts`).
 * `role="alert"` (implicit assertive live region) is what the 11 duplicated
 * call sites this replaces were missing — a screen-reader user gets no
 * signal at all from a plain `<p>` that appears without a focus change.
 * See CONVENTIONS.md §25, Story 37.
 */
export function FormErrorSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return null
  }
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors.join(' ')}
    </p>
  )
}

import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

import { ApiRequestError } from '@/shared/lib/api/errors'

/** The backend's form-level bucket — `backend/apps/core/exceptions.py:22`. */
const NON_FIELD_KEY = 'non_field_errors'

export function isValidationError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && error.isValidation
}

/**
 * Apply a `validation_error` envelope's `fields` map to a form.
 *
 * Messages are passed through UNTRANSLATED because the backend already
 * localised them via `Accept-Language` (CONVENTIONS.md §18). Do not run these
 * through `t()`, and note they are NOT retranslated on a language switch —
 * `useAppForm`'s `trigger()` clears them instead, which is correct: only the
 * server can re-issue a server error.
 *
 * Field names need no mapping. Wire format is snake_case end to end
 * (CONVENTIONS.md §12), so a serializer field, a Zod key, and an RHF path are
 * the same string.
 *
 * Returns the messages that could NOT be attached to a field, for the caller
 * to surface as form-level copy.
 */
export function applyServerErrors<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  error: ApiRequestError,
): string[] {
  const unattached: string[] = [...error.nonFieldErrors]
  const known = new Set(Object.keys(form.getValues()))
  let firstField: Path<TFieldValues> | null = null

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages.join(' ')
    if (field === NON_FIELD_KEY) continue
    // A field the form does not have (a serializer-only field, or a nested
    // one the backend flattened) would be set and never rendered — an error
    // the user cannot see or clear. Surface it at form level instead.
    if (!known.has(field)) {
      unattached.push(message)
      continue
    }
    const path = field as Path<TFieldValues>
    form.setError(path, { type: 'server', message })
    firstField ??= path
  }

  if (firstField) form.setFocus(firstField)
  return unattached
}

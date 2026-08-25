import * as z from 'zod'

/**
 * Shared field shapes. Features compose these instead of re-deriving them, so
 * "what does required text mean" is answered once. Messages come from the
 * error map (./errorMap.ts) — NEVER pass a literal `error:` string here.
 * See CONVENTIONS.md §20.
 */

/** Required text. `.trim()` first, so "   " is blank, not 3 characters. */
export function requiredString(max = 255) {
  return z.string().trim().min(1).max(max)
}

/** Optional text. Normalises '' to undefined so a blank input is "not sent". */
export function optionalString(max = 255) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional()
}

export function email() {
  return z.email().max(254)
}

export function optionalEmail() {
  return z.union([z.literal(''), z.email().max(254)]).transform((v) => (v === '' ? undefined : v))
}

/** A number typed into a text input. `coerce` turns '42' into 42. */
export function positiveInt(max?: number) {
  const base = z.coerce.number().int().min(1)
  return max === undefined ? base : base.max(max)
}

/** A `<select>` over a fixed set. Matches a DRF `ChoiceField`. */
export function choice<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values)
}

/** Opt-in boolean (a checkbox that must be ticked, e.g. accept-terms). */
export function requiredBoolean() {
  return z.literal(true)
}

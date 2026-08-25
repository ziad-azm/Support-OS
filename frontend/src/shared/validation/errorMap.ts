import * as z from 'zod'

import { i18next } from '@/shared/i18n'

/** Origins we have authored size copy for. Anything else falls through. */
const SIZED_ORIGINS = ['string', 'number', 'array', 'set', 'file'] as const

function isBlank(input: unknown): boolean {
  return input === undefined || input === null || input === ''
}

/**
 * Maps a Zod issue to a translated message, or `undefined` to fall through to
 * Zod's own locale (registered alongside this in ./config.ts).
 *
 * Called at PARSE time, not at import time, so `t()` reads the language that
 * is active when validation runs — the opposite of the module-scope trap in
 * CONVENTIONS.md §18. The consequence is that a message is frozen into RHF's
 * error state until the next validation; ./index.ts re-validates on a
 * language change to compensate.
 */
export const zodErrorMap: z.core.$ZodErrorMap = (issue) => {
  const t = i18next.getFixedT(null, 'validation')

  // "Required" covers two distinct Zod codes and is by far the most common
  // message in any form. Zod's own copy for both is developer-speak
  // ("expected string, received undefined"), so both are captured here.
  if (issue.code === 'invalid_type' && isBlank(issue.input)) return t('required')
  if (issue.code === 'too_small' && issue.origin === 'string' && issue.minimum === 1) {
    return t('required')
  }

  switch (issue.code) {
    case 'too_small':
      if (!(SIZED_ORIGINS as readonly string[]).includes(issue.origin)) return undefined
      return t(`too_small.${String(issue.origin)}`, {
        minimum: Number(issue.minimum),
        defaultValue: t('invalid'),
      })

    case 'too_big':
      if (!(SIZED_ORIGINS as readonly string[]).includes(issue.origin)) return undefined
      return t(`too_big.${String(issue.origin)}`, {
        maximum: Number(issue.maximum),
        defaultValue: t('invalid'),
      })

    case 'invalid_type':
      return t(`invalid_type.${issue.expected}`, { defaultValue: t('invalid') })

    // `format` discriminates email/url/uuid/... — fall through for a format
    // we have no copy for rather than inventing one.
    case 'invalid_format':
      return t(`invalid_format.${issue.format}`, { defaultValue: undefined as unknown as string })

    case 'invalid_value':
      return t('invalid_value')

    case 'not_multiple_of':
      return t('not_multiple_of', { divisor: issue.divisor })

    default:
      // unrecognized_keys, invalid_union, invalid_key, invalid_element, custom
      // — schema-authoring or exotic cases. Zod's locale handles them.
      return undefined
  }
}

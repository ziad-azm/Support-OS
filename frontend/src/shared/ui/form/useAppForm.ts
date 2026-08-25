import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type {
  DefaultValues,
  FieldValues,
  Resolver,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form'
import type * as z from 'zod'

import { i18next } from '@/shared/i18n'
import { zodResolver } from '@/shared/validation/resolver'

type UseAppFormOptions<TSchema extends z.ZodType<FieldValues, FieldValues>> = Omit<
  UseFormProps<z.output<TSchema>>,
  'resolver' | 'defaultValues'
> & {
  schema: TSchema
  defaultValues: DefaultValues<z.output<TSchema>>
}

/**
 * The project's only form entry point. Binds the shared resolver and
 * re-validates on a language change.
 *
 * Why the re-validation: `zodResolver` stores a finished message string in
 * RHF's error state (verified — the issue's `minimum`/`origin` are dropped),
 * so a language switch cannot retranslate what is already displayed. Firing
 * `trigger()` re-runs the schema, which re-enters the error map, which reads
 * the new language. Guarded on `isSubmitted` so a switch never *introduces*
 * errors on a form the user has not tried to submit yet.
 */
export function useAppForm<TSchema extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  ...options
}: UseAppFormOptions<TSchema>): UseFormReturn<z.output<TSchema>> {
  // `zodResolver`'s return type is inferred against TSchema's constraint
  // bound inside this generic body, not against the caller's concrete
  // schema, so TypeScript widens it to `Resolver<FieldValues>`. The runtime
  // value is exactly right — cast the type back to the schema's real output.
  const resolver = zodResolver(schema) as unknown as Resolver<z.output<TSchema>>

  const form = useForm<z.output<TSchema>>({
    ...options,
    resolver,
  })

  const { trigger, formState } = form
  const { isSubmitted } = formState

  useEffect(() => {
    const retranslate = () => {
      if (isSubmitted) void trigger()
    }
    i18next.on('languageChanged', retranslate)
    return () => {
      i18next.off('languageChanged', retranslate)
    }
  }, [trigger, isSubmitted])

  return form
}

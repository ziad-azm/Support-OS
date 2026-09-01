import type { FieldValues } from 'react-hook-form'

import { Input } from '@/shared/ui/primitives/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

type TextFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local'
  autoComplete?: string
  autoFocus?: boolean
  /** `"auto"` for a field whose content's script (e.g. Arabic) doesn't
   * follow the UI language — see `ArticleFormPage`'s `title_ar`. */
  dir?: 'auto' | 'ltr' | 'rtl'
}

/**
 * The reference field implementation the other five follow. `Input` is a
 * real DOM element, so `{...field}` composes directly — the Radix-backed
 * fields (Select/Checkbox/Switch/RadioGroup) cannot do this; see
 * CONVENTIONS.md §20.
 */
export function TextField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  type = 'text',
  autoComplete,
  autoFocus,
  dir,
}: TextFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              dir={dir}
              {...field}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

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

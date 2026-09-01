import type { FieldValues } from 'react-hook-form'

import { Textarea } from '@/shared/ui/primitives/textarea'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

/** `Textarea` is a real DOM element, so `{...field}` composes directly. */
export function TextareaField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  maxLength,
}: FieldProps<TFieldValues> & { maxLength?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
              {...field}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          {maxLength ? (
            <p className="text-end text-xs text-muted-foreground">
              {String(field.value ?? '').length}/{maxLength}
            </p>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

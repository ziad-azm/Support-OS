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

type FileFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  accept?: string
}

/**
 * A real DOM `<input type="file">` — but unlike `TextField`, `field.value`
 * must NOT be spread onto it: browsers reject any scripted `value` on a
 * file input other than `''` (a security restriction, not a framework
 * quirk). `onChange` is wired explicitly to capture the selected `File`
 * into RHF state; the input stays uncontrolled for `value`. `Input`
 * already ships `file:*` Tailwind classes — no new primitive needed. See
 * CONVENTIONS.md §20.
 */
export function FileField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  accept,
}: FileFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: { value: _value, onChange, ...field } }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept={accept}
              disabled={disabled}
              onChange={(event) => onChange(event.target.files?.[0] ?? null)}
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

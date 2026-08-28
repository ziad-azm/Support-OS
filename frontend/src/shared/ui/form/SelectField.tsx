import type { FieldValues } from 'react-hook-form'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

type SelectFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  /** Already translated by the caller. */
  options: readonly { value: string; label: string }[]
}

/**
 * `Select` is not a native form control — it has no DOM `ref` and reports
 * changes via `onValueChange(value: string)`, not `onChange`. `field.value`
 * / `field.onChange` are wired explicitly rather than spreading `{...field}`,
 * which would silently do nothing. See CONVENTIONS.md §20.
 */
export function SelectField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  options,
}: SelectFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedLabel = options.find((option) => option.value === field.value)?.label
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <FormControl>
                <SelectTrigger title={selectedLabel}>
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

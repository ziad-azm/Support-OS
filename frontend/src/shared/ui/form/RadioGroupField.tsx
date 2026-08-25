import { useId } from 'react'
import type { FieldValues } from 'react-hook-form'

import { Label } from '@/shared/ui/primitives/label'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

type RadioGroupFieldProps<TFieldValues extends FieldValues> = FieldProps<TFieldValues> & {
  /** Already translated by the caller. */
  options: readonly { value: string; label: string }[]
}

/**
 * `RadioGroup` is not a native form control — it has no DOM `ref` and
 * reports changes via `onValueChange(value: string)`, not `onChange`.
 * `field.value`/`field.onChange` are wired explicitly. See CONVENTIONS.md §20.
 */
export function RadioGroupField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  options,
}: RadioGroupFieldProps<TFieldValues>) {
  const groupId = useId()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <RadioGroup value={field.value} onValueChange={field.onChange} disabled={disabled}>
              {options.map((option) => {
                const itemId = `${groupId}-${option.value}`
                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <RadioGroupItem value={option.value} id={itemId} />
                    <Label htmlFor={itemId}>{option.label}</Label>
                  </div>
                )
              })}
            </RadioGroup>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

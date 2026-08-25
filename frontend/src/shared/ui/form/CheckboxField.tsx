import type { FieldValues } from 'react-hook-form'

import { Checkbox } from '@/shared/ui/primitives/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/primitives/form'

import type { FieldProps } from './types'

/**
 * `Checkbox` is not a native form control — it has no DOM `ref` and reports
 * changes via `onCheckedChange(checked: boolean | 'indeterminate')`, not
 * `onChange`. `field.value`/`field.onChange` are wired explicitly.
 *
 * The control and label sit side by side (a checkbox's label is never above
 * it), via an inner row using only a logical gap utility (check:rtl enforces
 * no physical spacing here). `FormItem` keeps its default vertical grid so a
 * description or error message still stacks below the row rather than
 * beside it.
 * See CONVENTIONS.md §20.
 */
export function CheckboxField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
}: FieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex flex-row items-center gap-2">
            <FormControl>
              <Checkbox
                checked={!!field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                disabled={disabled}
              />
            </FormControl>
            <FormLabel>{label}</FormLabel>
          </div>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

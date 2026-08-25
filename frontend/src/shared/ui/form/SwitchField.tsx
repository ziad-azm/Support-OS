import type { FieldValues } from 'react-hook-form'

import { Switch } from '@/shared/ui/primitives/switch'
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
 * `Switch` is not a native form control — it has no DOM `ref` and reports
 * changes via `onCheckedChange(checked: boolean)`, not `onChange`.
 * `field.value`/`field.onChange` are wired explicitly. Same side-by-side
 * layout as `CheckboxField`. See CONVENTIONS.md §20.
 */
export function SwitchField<TFieldValues extends FieldValues>({
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
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
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

import type { ReactNode } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'

export type FieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>
  /** Must match the Zod schema key, which matches the DRF serializer field. */
  name: FieldPath<TFieldValues>
  /** Already translated by the caller — these components never guess copy. */
  label: string
  description?: string
  placeholder?: string
  disabled?: boolean
  children?: ReactNode
}

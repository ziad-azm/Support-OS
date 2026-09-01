import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import type { FieldValues } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'
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
  const { t } = useTranslation()
  // Shared at this level, not per-screen: every password field in the app
  // (login, user admin, and the ACCT-1/2/3 flows) gets the toggle for free.
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {isPassword ? (
              <div className="relative">
                <Input
                  type={visible ? 'text' : 'password'}
                  placeholder={placeholder}
                  disabled={disabled}
                  autoComplete={autoComplete}
                  autoFocus={autoFocus}
                  dir={dir}
                  className="pe-9"
                  {...field}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute inset-e-0 top-0 text-muted-foreground hover:bg-transparent"
                  onClick={() => setVisible((current) => !current)}
                  aria-label={t(visible ? 'actions.hidePassword' : 'actions.showPassword')}
                >
                  {visible ? <EyeOffIcon /> : <EyeIcon />}
                </Button>
              </div>
            ) : (
              <Input
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                dir={dir}
                {...field}
              />
            )}
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

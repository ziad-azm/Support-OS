import type { ComponentProps, ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'

import { Button } from '@/shared/ui/primitives/button'

type SubmitButtonProps = {
  pending: boolean
  /** Shown instead of `children` while `pending` is true. Omit to keep the
   *  same label and rely on the spinner + disabled state alone. */
  pendingLabel?: ReactNode
  /** A leading icon shown when NOT pending — replaced by the spinner while
   *  pending, never shown alongside it. */
  icon?: ReactNode
  children: ReactNode
} & Omit<ComponentProps<typeof Button>, 'type' | 'disabled' | 'children'>

/** The one submit-button pattern for every form in the app — spinner +
 *  disabled while a mutation is pending, reusing the same `Loader2Icon`/
 *  `animate-spin` pattern `shared/ui/Loading.tsx` already established.
 *  See CONVENTIONS.md's DSN-10 entry. */
export function SubmitButton({
  pending,
  pendingLabel,
  icon,
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <Loader2Icon className="animate-spin" /> : icon}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}

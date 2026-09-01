import type { ComponentProps } from 'react'
import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

/**
 * A `DataTable` primary-column link — `text-primary` + `hover:underline`,
 * the exact class string `buttonVariants`'s own `link` variant already
 * uses, so a table-cell link reads identically to every other link-styled
 * control in this app. Preflight strips the browser's default link
 * underline/color, so a bare `<Link>` with no className is otherwise
 * indistinguishable from plain text (SUPPORTOS-105 task 6). Every `to`
 * target passes straight through unchanged — this component only adds
 * styling.
 */
export function TableLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link className={cn('text-primary underline-offset-4 hover:underline', className)} {...props} />
  )
}

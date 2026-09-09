import type { ComponentProps } from 'react'
import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

/**
 * A `DataTable` primary-column link — `text-primary-text` +
 * `hover:underline`, the exact class string `buttonVariants`'s own `link`
 * variant already uses, so a table-cell link reads identically to every
 * other link-styled control in this app. `text-primary-text`, NOT
 * `text-primary`: the brand colour as a fill fails AA as text in dark mode
 * (3.28:1 on `--card`); see `index.css`'s `--primary-text` and Story 101.
 *
 * Preflight strips the browser's default link
 * underline/color, so a bare `<Link>` with no className is otherwise
 * indistinguishable from plain text (SUPPORTOS-105 task 6). Every `to`
 * target passes straight through unchanged — this component only adds
 * styling.
 */
export function TableLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn('text-primary-text underline-offset-4 hover:underline', className)}
      {...props}
    />
  )
}

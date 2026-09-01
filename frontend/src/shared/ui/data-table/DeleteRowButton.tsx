import type { ComponentProps } from 'react'
import { Trash2Icon } from 'lucide-react'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/primitives/button'

type DeleteRowButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size'>

/**
 * The one destructive row-action button for every `DataTable` "Delete"
 * column — ghost-sized but destructive-toned, with a `Trash2Icon`, so it
 * reads as a real destructive action instead of plain text
 * (SUPPORTOS-105 task 2). The destructive-tone classes mirror
 * `dropdown-menu.tsx`'s existing `variant="destructive"` `DropdownMenuItem`
 * convention (`text-destructive`, `hover:bg-destructive/10`), not
 * `buttonVariants`'s full-weight `destructive` variant, which is too heavy
 * repeated down a table column. Every caller keeps its own `useConfirm()`
 * gating and mutation — this component only supplies the affordance.
 */
export function DeleteRowButton({ className, children, ...props }: DeleteRowButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={cn(
        'text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20',
        className,
      )}
      {...props}
    >
      <Trash2Icon />
      {children}
    </Button>
  )
}

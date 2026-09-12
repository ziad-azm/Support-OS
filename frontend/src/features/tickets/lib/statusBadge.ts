import type { SlaStatus, TicketPriority, TicketStatus } from '../types/ticket'

/** New→worked→done→archived, the same escalating severity/attention ramp
 * common ticketing tools use: open (needs attention) is info-blue,
 * in_progress (actively worked, don't let it stall) is warning-amber,
 * resolved is success-green, closed is neutral. No DSN source for these
 * exact hues — see the plan's `## Prerequisites` for where each one comes
 * from. `pending_customer` (SLA-6, Story 112) is `secondary` — blocked on
 * the customer, not urgent the way `in_progress`'s warning is, and no new
 * badge colour vocabulary (DSN-4). */
export function ticketStatusVariant(
  status: TicketStatus,
): 'info' | 'warning' | 'secondary' | 'success' | 'outline' {
  switch (status) {
    case 'open':
      return 'info'
    case 'in_progress':
      return 'warning'
    case 'pending_customer':
      return 'secondary'
    case 'resolved':
      return 'success'
    case 'closed':
      return 'outline'
  }
}

/** Escalating attention ramp: low is the least visually prominent variant
 * this app has, urgent reuses the existing `destructive` red. */
export function ticketPriorityVariant(
  priority: TicketPriority,
): 'outline' | 'secondary' | 'warning' | 'destructive' {
  switch (priority) {
    case 'low':
      return 'outline'
    case 'medium':
      return 'secondary'
    case 'high':
      return 'warning'
    case 'urgent':
      return 'destructive'
  }
}

/** Same escalating-attention logic as the two above, mapped onto the
 * backend's `met`/`pending`/`breached`/`paused` vocabulary. Reuses
 * existing variants — no new badge colour, matching `DSN-4`'s own bar.
 * `paused` (SLA-6, Story 112) is `secondary`, the same neutral variant
 * `TicketSlaSection.tsx`'s own local `badgeVariant` already uses for
 * `pending`. */
export function slaStatusVariant(
  status: SlaStatus,
): 'success' | 'warning' | 'secondary' | 'destructive' {
  switch (status) {
    case 'met':
      return 'success'
    case 'pending':
      return 'warning'
    case 'breached':
      return 'destructive'
    case 'paused':
      return 'secondary'
  }
}

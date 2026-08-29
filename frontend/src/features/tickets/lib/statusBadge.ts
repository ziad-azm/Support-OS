import type { TicketPriority, TicketStatus } from '../types/ticket'

/** New→worked→done→archived, the same escalating severity/attention ramp
 * common ticketing tools use: open (needs attention) is info-blue,
 * in_progress (actively worked, don't let it stall) is warning-amber,
 * resolved is success-green, closed is neutral. No DSN source for these
 * exact hues — see the plan's `## Prerequisites` for where each one comes
 * from. */
export function ticketStatusVariant(
  status: TicketStatus,
): 'info' | 'warning' | 'success' | 'outline' {
  switch (status) {
    case 'open':
      return 'info'
    case 'in_progress':
      return 'warning'
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

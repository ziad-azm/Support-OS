import type { PortalTicketPriority, PortalTicketStatus } from '../types/portalTicket'

// Duplicated from features/tickets/lib/statusBadge.ts rather than imported —
// no-restricted-imports (frontend/.oxlintrc.json:8-18) forbids a
// cross-feature import, the same boundary portalTicket.ts's own types
// already work within. Keep both files' mapping logic identical if either
// changes.
export function ticketStatusVariant(
  status: PortalTicketStatus,
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

export function ticketPriorityVariant(
  priority: PortalTicketPriority,
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

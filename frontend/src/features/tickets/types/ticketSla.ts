export type SlaDimensionStatus = 'met' | 'breached' | 'pending'

/** Mirrors `apps.sla.policy.compute_sla_status`'s return shape. `null`
 * means no `SLAPolicy` applies to this ticket's priority/category — a
 * normal outcome, not missing data. */
export type TicketSla = {
  policy_id: number
  response_target_minutes: number
  resolution_target_minutes: number
  response_due_at: string
  response_status: SlaDimensionStatus
  resolution_due_at: string
  resolution_status: SlaDimensionStatus
} | null

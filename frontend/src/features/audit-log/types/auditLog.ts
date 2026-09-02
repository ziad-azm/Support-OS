/** Mirrors `apps.accounts.models.AuditLog.Action` values. */
export const AUDIT_LOG_ACTIONS = [
  'user_created',
  'user_role_changed',
  'user_status_changed',
  'user_deleted',
  'role_created',
  'role_renamed',
  'role_permissions_changed',
  'role_deleted',
  'portal_access_granted',
  'portal_access_revoked',
] as const

export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number]

/** Mirrors `apps.accounts.serializers.AuditLogSerializer`'s read shape. */
export type AuditLog = {
  id: number
  actor: number | null
  actor_name: string | null
  action: AuditLogAction
  action_display: string
  target_user: number | null
  target_role: number | null
  target_label: string
  from_value: string
  to_value: string
  created_at: string
}

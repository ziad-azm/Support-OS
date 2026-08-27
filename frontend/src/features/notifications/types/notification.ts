export const NOTIFICATION_KINDS = ['ticket_assigned', 'ticket_escalated'] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Mirrors `apps.notifications.serializers.NotificationSerializer` verbatim. */
export type Notification = {
  id: number
  kind: NotificationKind
  ticket: number | null
  ticket_subject: string
  title: string
  body: string
  read_at: string | null
  created_at: string
  updated_at: string
}

/** Mirrors `apps.integrations.serializers.WebhookSubscriptionSerializer`'s
 *  read shape. `secret` is absent by design — write-only. */
export type WebhookSubscription = {
  id: number
  name: string
  target_url: string
  has_secret: boolean
  events: string[]
  enabled: boolean
  created_by: number | null
  created_at: string
  updated_at: string
}

/** The write shape. `secret` is send-only; omitting it (or sending '') on
 *  an update leaves the stored one untouched — required only on create,
 *  enforced server-side. */
export type WebhookSubscriptionInput = {
  name: string
  target_url: string
  secret?: string
  events: string[]
  enabled: boolean
}

export const WEBHOOK_DELIVERY_STATES = ['success', 'retrying', 'failed'] as const
export type WebhookDeliveryState = (typeof WEBHOOK_DELIVERY_STATES)[number]

export type WebhookDelivery = {
  id: number
  subscription: number
  event: string
  payload: Record<string, unknown>
  state: WebhookDeliveryState
  state_display: string
  attempt: number
  response_status_code: number | null
  response_body: string
  error_message: string
  created_at: string
  updated_at: string
}

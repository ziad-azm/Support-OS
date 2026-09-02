/** Mirrors `apps.integrations.serializers.ErpConnectionSerializer`'s read
 *  shape. `auth_token` is absent by design — the API never returns it
 *  (write-only); `has_auth_token` is what the UI renders instead. */
export type ErpConnection = {
  id: number
  enabled: boolean
  base_url: string
  has_auth_token: boolean
  export_enabled: boolean
  customer_field_map: Record<string, string>
  order_field_map: Record<string, string>
  customer_external_id_field: string
  order_external_id_field: string
  order_customer_ref_field: string
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

/** The write shape. `auth_token` is send-only, and omitting it (or
 *  sending '') leaves the stored credential untouched server-side. */
export type ErpConnectionInput = {
  enabled: boolean
  base_url: string
  auth_token?: string
  export_enabled: boolean
  customer_field_map: Record<string, string>
  order_field_map: Record<string, string>
  customer_external_id_field: string
  order_external_id_field: string
  order_customer_ref_field: string
}

// Mirrors `apps.integrations.erp_sync.CUSTOMER_SYNCABLE_FIELDS`/
// `ORDER_SYNCABLE_FIELDS` — the allowlist a field-map target must belong
// to. Kept here beside the types they describe.
export const CUSTOMER_MAP_TARGETS = ['name', 'email', 'phone', 'company'] as const
export const ORDER_MAP_TARGETS = [
  'order_number',
  'status',
  'total_amount',
  'currency',
  'placed_at',
] as const

/** The union `FieldMapField` narrows its `allowedTargets` prop to, so
 *  `t(\`erp.maps.targets.${target}\`)` resolves to a finite, checkable
 *  template-literal type instead of a bare `string`. */
export type MapTarget = (typeof CUSTOMER_MAP_TARGETS)[number] | (typeof ORDER_MAP_TARGETS)[number]

export const SYNC_DIRECTIONS = ['import', 'export'] as const
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number]

export const SYNC_STATES = ['running', 'success', 'failed'] as const
export type SyncState = (typeof SYNC_STATES)[number]

export type ErpSyncRun = {
  id: number
  direction: SyncDirection
  direction_display: string
  state: SyncState
  state_display: string
  triggered_by_name: string | null
  created_count: number
  updated_count: number
  skipped_count: number
  failed_count: number
  started_at: string
  finished_at: string | null
  error_message: string
  created_at: string
  updated_at: string
}

export type ErpOrder = {
  id: number
  customer: number
  customer_name: string
  external_id: string
  order_number: string
  status: string
  total_amount: string | null
  currency: string
  placed_at: string | null
  synced_at: string
  created_at: string
  updated_at: string
}

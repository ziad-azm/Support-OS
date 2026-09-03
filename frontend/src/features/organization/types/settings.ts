/** Mirrors `apps.organization.serializers.OrganizationSettingsSerializer`'s
 * read shape. */
export type OrganizationSettings = {
  id: number
  name: string
  logo_url: string
  default_response_target_minutes: number | null
  default_resolution_target_minutes: number | null
  created_at: string
  updated_at: string
}

/** The write shape — no `id`/`created_at`/`updated_at`, all server-managed. */
export type SettingsInput = {
  name: string
  logo_url: string
  default_response_target_minutes: number | null
  default_resolution_target_minutes: number | null
}

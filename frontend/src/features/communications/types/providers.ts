/** Mirrors `apps.communications.serializers.EmailProviderConfigSerializer`'s
 *  read shape. `host_password` is absent by design — write-only. */
export type EmailProviderConfig = {
  id: number
  host: string
  port: number
  host_user: string
  has_host_password: boolean
  use_tls: boolean
  default_from_email: string
  created_at: string
  updated_at: string
}

export type EmailProviderConfigInput = {
  host: string
  port: number
  host_user: string
  host_password?: string
  use_tls: boolean
  default_from_email: string
}

export type WhatsAppProviderConfig = {
  id: number
  api_base_url: string
  phone_number_id: string
  has_access_token: boolean
  created_at: string
  updated_at: string
}

export type WhatsAppProviderConfigInput = {
  api_base_url: string
  phone_number_id: string
  access_token?: string
}

export type SmsProviderConfig = {
  id: number
  api_base_url: string
  account_sid: string
  has_auth_token: boolean
  from_number: string
  created_at: string
  updated_at: string
}

export type SmsProviderConfigInput = {
  api_base_url: string
  account_sid: string
  auth_token?: string
  from_number: string
}

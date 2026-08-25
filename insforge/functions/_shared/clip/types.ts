export const CLIP_CHECKOUT_API_VERSION = 'v2' as const
export const DEFAULT_CLIP_API_BASE_URL = 'https://api.payclip.com'

export type ClipCreateCheckoutRequest = {
  amount: number
  currency: 'MXN'
  purchase_description: string
  redirection_url: {
    success: string
    error: string
    default: string
  }
  webhook_url: string
  metadata: {
    external_reference: string
  }
  override_settings: {
    tip_enabled: false
  }
  expires_at: string
}

export type ClipCreateCheckoutResponse = {
  payment_request_id: string
  payment_request_url: string
  status?: string
  amount?: number
  currency?: string
  webhook_url?: string
  redirection_url?: unknown
  metadata?: { external_reference?: string }
}

export type ClipGetCheckoutResponse = {
  payment_request_id: string
  status: string
  amount: number
  currency: string
  metadata?: { external_reference?: string | null }
  receipt_no?: string | null
}

export type ClipCheckoutWebhookPayload = {
  id?: string
  payment_request_id?: string
  transaction_id?: string
  resource?: string
  resource_status?: string
}

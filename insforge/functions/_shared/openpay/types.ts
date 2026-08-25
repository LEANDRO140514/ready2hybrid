export const OPENPAY_API_VERSION = 'v1' as const
/** Official Openpay Mexico sandbox host. Not Colombia. */
export const OPENPAY_SANDBOX_BASE_URL = 'https://sandbox-api.openpay.mx'
/** Official Openpay Mexico production host. Not Colombia. */
export const OPENPAY_PRODUCTION_BASE_URL = 'https://api.openpay.mx'

export type OpenpayEnvironment = 'SANDBOX' | 'PRODUCTION'

export type OpenpayCustomer = {
  name: string
  last_name: string
  phone_number: string
  email: string
}

export type OpenpayCreateChargeRequest = {
  method: 'card'
  amount: number
  currency: 'MXN'
  description: string
  order_id: string
  customer: OpenpayCustomer
  confirm: false
  send_email: false
  redirect_url: string
}

export type OpenpayPaymentMethod = {
  type: string
  url: string
}

export type OpenpayCreateChargeResponse = {
  id: string
  status: string
  payment_method: OpenpayPaymentMethod
  amount?: number
  currency?: string
  order_id?: string
}

export type OpenpayGetChargeResponse = {
  id: string
  status: string
  amount: number
  currency: string
  order_id: string | null
  transaction_type: string
  operation_type: string
  method: string
}

export type OpenpayCheckoutContext = {
  customer: OpenpayCustomer
  clientIp: string
}

export type OpenpayWebhookBasicAuth = {
  username: string
  password: string
}

import { PaymentContractError } from '../payments/errors'
import { centsToOpenpayAmount } from './money'
import {
  OPENPAY_PRODUCTION_BASE_URL,
  OPENPAY_SANDBOX_BASE_URL,
  type OpenpayCreateChargeRequest,
  type OpenpayCreateChargeResponse,
  type OpenpayEnvironment,
  type OpenpayGetChargeResponse,
} from './types'

export type OpenpayFetch = (
  url: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export type OpenpayChargeHttpClientDeps = {
  fetchImpl: OpenpayFetch
  getPrivateKey: () => string
  getMerchantId: () => string
  getEnvironment: () => OpenpayEnvironment
  getClientIp: () => string
}

export type OpenpayChargeHttpClient = {
  createCharge: (request: OpenpayCreateChargeRequest) => Promise<OpenpayCreateChargeResponse>
  getCharge: (transactionId: string) => Promise<OpenpayGetChargeResponse>
}

export function openpayBaseUrl(environment: OpenpayEnvironment): string {
  if (environment === 'SANDBOX') return OPENPAY_SANDBOX_BASE_URL
  if (environment === 'PRODUCTION') return OPENPAY_PRODUCTION_BASE_URL
  throw new PaymentContractError('INVALID_REQUEST', 'Openpay environment must be SANDBOX or PRODUCTION')
}

function requirePrivateKey(getPrivateKey: () => string): string {
  const key = getPrivateKey().trim()
  if (!key) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Openpay private key is missing')
  }
  return key
}

function requireMerchantId(getMerchantId: () => string): string {
  const id = getMerchantId().trim()
  if (!id) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Openpay merchant id is missing')
  }
  return id
}

function requireClientIp(getClientIp: () => string): string {
  const ip = getClientIp().trim()
  if (!ip || ip === 'unknown' || ip.includes(',')) {
    throw new PaymentContractError(
      'INVALID_REQUEST',
      'Openpay X-Forwarded-For requires a server-validated client IP',
    )
  }
  return ip
}

function basicAuthorization(privateKey: string): string {
  return `Basic ${Buffer.from(`${privateKey}:`, 'utf8').toString('base64')}`
}

function translateHttpFailure(status: number, operation: 'create' | 'get'): never {
  if (status === 401 || status === 403) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', `Openpay ${operation} unauthorized`)
  }
  if (operation === 'get' && status === 404) {
    throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Openpay charge not found')
  }
  if (status >= 500) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', `Openpay ${operation} provider failure`)
  }
  if (status >= 400) {
    throw new PaymentContractError(
      operation === 'create' ? 'INVALID_REQUEST' : 'FINANCIAL_RESOLUTION_FAILURE',
      `Openpay ${operation} rejected (${status})`,
    )
  }
  throw new PaymentContractError('PROVIDER_UNAVAILABLE', `Openpay ${operation} unexpected status`)
}

async function readJson(
  response: { json: () => Promise<unknown> },
  operation: 'create' | 'get',
): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new PaymentContractError(
      operation === 'create' ? 'PROVIDER_UNAVAILABLE' : 'FINANCIAL_RESOLUTION_FAILURE',
      `Openpay ${operation} returned malformed JSON`,
    )
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function requireStringField(
  record: Record<string, unknown>,
  key: string,
  operation: 'create' | 'get',
): string {
  const raw = record[key]
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new PaymentContractError(
      operation === 'create' ? 'PROVIDER_UNAVAILABLE' : 'FINANCIAL_RESOLUTION_FAILURE',
      `Openpay ${operation} missing ${key}`,
    )
  }
  return raw.trim()
}

function assertSafeCreateBody(request: OpenpayCreateChargeRequest, privateKey: string, merchantId: string): void {
  const serialized = JSON.stringify(request)
  if (serialized.includes(privateKey) || Object.values(request).includes(privateKey)) {
    throw new PaymentContractError('INVALID_REQUEST', 'Openpay private key must not enter the request body')
  }
  if ('merchant_id' in request || serialized.includes(`"merchant_id"`)) {
    throw new PaymentContractError('INVALID_REQUEST', 'Openpay merchant id must not enter the request body')
  }
  void merchantId
  if (request.method !== 'card' || request.confirm !== false || request.send_email !== false) {
    throw new PaymentContractError('INVALID_REQUEST', 'Openpay create charge must be hosted card redirect')
  }
  const forbidden = [
    'source_id',
    'token',
    'card_number',
    'cvv',
    'payment_plan',
    'use_card_points',
    'use_3d_secure',
    'device_session_id',
  ] as const
  const record = request as unknown as Record<string, unknown>
  for (const key of forbidden) {
    if (key in record) {
      throw new PaymentContractError('INVALID_REQUEST', `Openpay create must not include ${key}`)
    }
  }
}

export function createOpenpayChargeHttpClient(deps: OpenpayChargeHttpClientDeps): OpenpayChargeHttpClient {
  return {
    async createCharge(request: OpenpayCreateChargeRequest): Promise<OpenpayCreateChargeResponse> {
      const privateKey = requirePrivateKey(deps.getPrivateKey)
      const merchantId = requireMerchantId(deps.getMerchantId)
      const clientIp = requireClientIp(deps.getClientIp)
      assertSafeCreateBody(request, privateKey, merchantId)
      centsToOpenpayAmount(Math.round(request.amount * 100))
      const url = `${openpayBaseUrl(deps.getEnvironment())}/v1/${encodeURIComponent(merchantId)}/charges`
      let response: Awaited<ReturnType<OpenpayFetch>>
      try {
        response = await deps.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: basicAuthorization(privateKey),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Forwarded-For': clientIp,
          },
          body: JSON.stringify(request),
        })
      } catch {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Openpay create charge network failure')
      }
      if (!response.ok) translateHttpFailure(response.status, 'create')
      const json = asRecord(await readJson(response, 'create'))
      if (!json) {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Openpay create charge returned a non-object')
      }
      const paymentMethod = asRecord(json.payment_method)
      if (!paymentMethod) {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Openpay create charge missing payment_method')
      }
      const type = requireStringField(paymentMethod, 'type', 'create')
      if (type !== 'redirect') {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Openpay create charge is not a redirect payment_method')
      }
      return {
        id: requireStringField(json, 'id', 'create'),
        status: requireStringField(json, 'status', 'create'),
        payment_method: {
          type,
          url: requireStringField(paymentMethod, 'url', 'create'),
        },
        amount: typeof json.amount === 'number' ? json.amount : undefined,
        currency: typeof json.currency === 'string' ? json.currency : undefined,
        order_id: typeof json.order_id === 'string' ? json.order_id : undefined,
      }
    },

    async getCharge(transactionId: string): Promise<OpenpayGetChargeResponse> {
      const handle = transactionId.trim()
      if (!handle) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Openpay transaction id is required')
      }
      const privateKey = requirePrivateKey(deps.getPrivateKey)
      const merchantId = requireMerchantId(deps.getMerchantId)
      const url = `${openpayBaseUrl(deps.getEnvironment())}/v1/${encodeURIComponent(merchantId)}/charges/${encodeURIComponent(handle)}`
      let response: Awaited<ReturnType<OpenpayFetch>>
      try {
        response = await deps.fetchImpl(url, {
          method: 'GET',
          headers: {
            Authorization: basicAuthorization(privateKey),
            Accept: 'application/json',
          },
        })
      } catch {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Openpay GET charge network failure')
      }
      if (!response.ok) translateHttpFailure(response.status, 'get')
      const json = asRecord(await readJson(response, 'get'))
      if (!json) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Openpay GET charge returned a non-object')
      }
      if (typeof json.amount !== 'number' || !Number.isFinite(json.amount)) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Openpay GET charge missing amount')
      }
      return {
        id: requireStringField(json, 'id', 'get'),
        status: requireStringField(json, 'status', 'get'),
        amount: json.amount,
        currency: requireStringField(json, 'currency', 'get'),
        order_id: typeof json.order_id === 'string' && json.order_id.trim() ? json.order_id.trim() : null,
        transaction_type: requireStringField(json, 'transaction_type', 'get'),
        operation_type: requireStringField(json, 'operation_type', 'get'),
        method: requireStringField(json, 'method', 'get'),
      }
    },
  }
}

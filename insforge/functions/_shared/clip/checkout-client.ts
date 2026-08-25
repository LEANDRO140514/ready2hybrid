import { PaymentContractError } from '../payments/errors'
import { DEFAULT_CLIP_API_BASE_URL } from './types'
import type { ClipCreateCheckoutRequest, ClipCreateCheckoutResponse, ClipGetCheckoutResponse } from './types'

export type ClipFetch = (
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

export type ClipCheckoutHttpClientDeps = {
  fetchImpl: ClipFetch
  getAuthorizationToken: () => string
  getBaseUrl?: () => string
}

export type ClipCheckoutHttpClient = {
  createCheckout: (request: ClipCreateCheckoutRequest) => Promise<ClipCreateCheckoutResponse>
  getCheckout: (paymentRequestId: string) => Promise<ClipGetCheckoutResponse>
}

function requireToken(getAuthorizationToken: () => string): string {
  const token = getAuthorizationToken().trim()
  if (!token) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Clip authorization token is missing')
  }
  return token
}

function baseUrl(getBaseUrl?: () => string): string {
  const raw = (getBaseUrl?.() ?? DEFAULT_CLIP_API_BASE_URL).trim().replace(/\/+$/, '')
  if (!raw) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Clip API base URL is missing')
  }
  return raw
}

function translateHttpFailure(status: number, operation: 'create' | 'get'): never {
  if (status === 401 || status === 403) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', `Clip ${operation} unauthorized`)
  }
  if (operation === 'get' && status === 404) {
    throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Clip checkout not found')
  }
  if (status >= 500) {
    throw new PaymentContractError('PROVIDER_UNAVAILABLE', `Clip ${operation} provider failure`)
  }
  if (status >= 400) {
    throw new PaymentContractError(
      operation === 'create' ? 'INVALID_REQUEST' : 'FINANCIAL_RESOLUTION_FAILURE',
      `Clip ${operation} rejected (${status})`,
    )
  }
  throw new PaymentContractError('PROVIDER_UNAVAILABLE', `Clip ${operation} unexpected status`)
}

async function readJson(response: { json: () => Promise<unknown> }, operation: 'create' | 'get'): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new PaymentContractError(
      operation === 'create' ? 'PROVIDER_UNAVAILABLE' : 'FINANCIAL_RESOLUTION_FAILURE',
      `Clip ${operation} returned malformed JSON`,
    )
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function requireStringField(record: Record<string, unknown>, key: string, operation: 'create' | 'get'): string {
  const raw = record[key]
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new PaymentContractError(
      operation === 'create' ? 'PROVIDER_UNAVAILABLE' : 'FINANCIAL_RESOLUTION_FAILURE',
      `Clip ${operation} missing ${key}`,
    )
  }
  return raw.trim()
}

export function createClipCheckoutHttpClient(deps: ClipCheckoutHttpClientDeps): ClipCheckoutHttpClient {
  return {
    async createCheckout(request: ClipCreateCheckoutRequest): Promise<ClipCreateCheckoutResponse> {
      const token = requireToken(deps.getAuthorizationToken)
      const url = `${baseUrl(deps.getBaseUrl)}/v2/checkout`
      let response: Awaited<ReturnType<ClipFetch>>
      try {
        response = await deps.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(request),
        })
      } catch {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Clip create checkout network failure')
      }
      if (!response.ok) translateHttpFailure(response.status, 'create')
      const json = asRecord(await readJson(response, 'create'))
      if (!json) {
        throw new PaymentContractError('PROVIDER_UNAVAILABLE', 'Clip create checkout returned a non-object')
      }
      return {
        payment_request_id: requireStringField(json, 'payment_request_id', 'create'),
        payment_request_url: requireStringField(json, 'payment_request_url', 'create'),
        status: typeof json.status === 'string' ? json.status : undefined,
        amount: typeof json.amount === 'number' ? json.amount : undefined,
        currency: typeof json.currency === 'string' ? json.currency : undefined,
      }
    },

    async getCheckout(paymentRequestId: string): Promise<ClipGetCheckoutResponse> {
      const handle = paymentRequestId.trim()
      if (!handle) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Clip payment_request_id is required')
      }
      const token = requireToken(deps.getAuthorizationToken)
      const url = `${baseUrl(deps.getBaseUrl)}/v2/checkout/${encodeURIComponent(handle)}`
      let response: Awaited<ReturnType<ClipFetch>>
      try {
        response = await deps.fetchImpl(url, {
          method: 'GET',
          headers: {
            Authorization: token,
            Accept: 'application/json',
          },
        })
      } catch {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Clip GET checkout network failure')
      }
      if (!response.ok) translateHttpFailure(response.status, 'get')
      const json = asRecord(await readJson(response, 'get'))
      if (!json) {
        throw new PaymentContractError('FINANCIAL_RESOLUTION_FAILURE', 'Clip GET checkout returned a non-object')
      }
      const metadata = asRecord(json.metadata)
      const receipt =
        typeof json.receipt_no === 'string' && json.receipt_no.trim() ? json.receipt_no.trim() : null
      return {
        payment_request_id: requireStringField(json, 'payment_request_id', 'get'),
        status: requireStringField(json, 'status', 'get'),
        amount: typeof json.amount === 'number' ? json.amount : Number.NaN,
        currency: requireStringField(json, 'currency', 'get'),
        metadata: {
          external_reference:
            typeof metadata?.external_reference === 'string' ? metadata.external_reference : null,
        },
        receipt_no: receipt,
      }
    },
  }
}

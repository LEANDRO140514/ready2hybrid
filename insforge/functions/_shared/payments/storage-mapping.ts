import { PaymentContractError } from './errors'
import type { ActivePaymentProviderId } from './ids'

/**
 * Single owner of MULTI-PAY-4 contract id ↔ existing storage ids.
 * No schema change. `payments.provider` is unconstrained text.
 * Clip (`clip`) and Openpay (`openpay`) mappings are additive.
 */
export const MERCADO_PAGO_STORAGE_ID = 'mercadopago' as const

export type MercadoPagoStorageId = typeof MERCADO_PAGO_STORAGE_ID

export function toMercadoPagoStorageId(provider: ActivePaymentProviderId): MercadoPagoStorageId {
  if (provider !== 'MERCADO_PAGO') {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'No storage mapping outside Mercado Pago')
  }
  return MERCADO_PAGO_STORAGE_ID
}

export function fromMercadoPagoStorageId(storageId: string): 'MERCADO_PAGO' {
  if (storageId !== MERCADO_PAGO_STORAGE_ID) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Unknown Mercado Pago storage identifier')
  }
  return 'MERCADO_PAGO'
}

export const CLIP_STORAGE_ID = 'clip' as const

export type ClipStorageId = typeof CLIP_STORAGE_ID

export function toClipStorageId(provider: ActivePaymentProviderId): ClipStorageId {
  if (provider !== 'CLIP') {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'No Clip storage mapping outside CLIP')
  }
  return CLIP_STORAGE_ID
}

export function fromClipStorageId(storageId: string): 'CLIP' {
  if (storageId !== CLIP_STORAGE_ID) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Unknown Clip storage identifier')
  }
  return 'CLIP'
}

export const OPENPAY_STORAGE_ID = 'openpay' as const

export type OpenpayStorageId = typeof OPENPAY_STORAGE_ID

export function toOpenpayStorageId(provider: ActivePaymentProviderId): OpenpayStorageId {
  if (provider !== 'OPENPAY') {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'No Openpay storage mapping outside OPENPAY')
  }
  return OPENPAY_STORAGE_ID
}

export function fromOpenpayStorageId(storageId: string): 'OPENPAY' {
  if (storageId !== OPENPAY_STORAGE_ID) {
    throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Unknown Openpay storage identifier')
  }
  return 'OPENPAY'
}

export type CanonicalPaymentStorageId =
  | MercadoPagoStorageId
  | ClipStorageId
  | OpenpayStorageId

/**
 * Single owner of contract id ↔ storage text for all active providers.
 * Unknown values fail closed. Does not write SQL.
 */
export function toCanonicalPaymentStorageId(
  provider: ActivePaymentProviderId,
): CanonicalPaymentStorageId {
  switch (provider) {
    case 'MERCADO_PAGO':
      return toMercadoPagoStorageId(provider)
    case 'CLIP':
      return toClipStorageId(provider)
    case 'OPENPAY':
      return toOpenpayStorageId(provider)
    default: {
      const _exhaustive: never = provider
      return _exhaustive
    }
  }
}

export function fromCanonicalPaymentStorageId(storageId: string): ActivePaymentProviderId {
  if (storageId === MERCADO_PAGO_STORAGE_ID) return 'MERCADO_PAGO'
  if (storageId === CLIP_STORAGE_ID) return 'CLIP'
  if (storageId === OPENPAY_STORAGE_ID) return 'OPENPAY'
  throw new PaymentContractError('UNSUPPORTED_PROVIDER', 'Unknown payment storage identifier')
}

/**
 * Durable `payments.provider` / `webhook_events.provider` convention.
 * Distinct from lowercase commercial_snapshot.provider (`mercadopago`).
 * SQL webhook_apply_payment_tx writes these values.
 */
export const MERCADO_PAGO_DURABLE_PAYMENT_PROVIDER = 'MERCADOPAGO' as const
export const CLIP_DURABLE_PAYMENT_PROVIDER = 'CLIP' as const
export const OPENPAY_DURABLE_PAYMENT_PROVIDER = 'OPENPAY' as const

export type DurablePaymentProviderId =
  | typeof MERCADO_PAGO_DURABLE_PAYMENT_PROVIDER
  | typeof CLIP_DURABLE_PAYMENT_PROVIDER
  | typeof OPENPAY_DURABLE_PAYMENT_PROVIDER

export function toDurablePaymentProviderId(
  provider: ActivePaymentProviderId,
): DurablePaymentProviderId {
  switch (provider) {
    case 'MERCADO_PAGO':
      return MERCADO_PAGO_DURABLE_PAYMENT_PROVIDER
    case 'CLIP':
      return CLIP_DURABLE_PAYMENT_PROVIDER
    case 'OPENPAY':
      return OPENPAY_DURABLE_PAYMENT_PROVIDER
    default: {
      const _exhaustive: never = provider
      return _exhaustive
    }
  }
}

export function fromDurablePaymentProviderId(storageId: string): ActivePaymentProviderId {
  if (storageId === MERCADO_PAGO_DURABLE_PAYMENT_PROVIDER) return 'MERCADO_PAGO'
  if (storageId === CLIP_DURABLE_PAYMENT_PROVIDER) return 'CLIP'
  if (storageId === OPENPAY_DURABLE_PAYMENT_PROVIDER) return 'OPENPAY'
  throw new PaymentContractError(
    'UNSUPPORTED_PROVIDER',
    'Unknown durable payment provider identifier',
  )
}

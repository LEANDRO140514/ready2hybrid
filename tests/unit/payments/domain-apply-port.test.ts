import { describe, expect, it } from 'vitest'
import {
  PaymentContractError,
  fromCanonicalPaymentStorageId,
  fromDurablePaymentProviderId,
  mapEligibleEvidenceToCanonicalApplyPayload,
  parseActivePaymentProviderId,
  toCanonicalPaymentStorageId,
  toDurablePaymentProviderId,
} from '../../../insforge/functions/_shared/payments'
import type {
  CanonicalApplyEvidence,
  CanonicalOwnershipProof,
  ExpectedFinancialSnapshot,
  ProviderPayment,
  VerifiedProviderEvent,
} from '../../../insforge/functions/_shared/payments'

const ORDER_ID = '11111111-1111-1111-1111-111111111111'

function ownershipProof(provider: 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY'): CanonicalOwnershipProof {
  return provider === 'MERCADO_PAGO'
    ? { mechanism: 'collector_id_match', verified: true }
    : { mechanism: 'account_scoped_get', verified: true }
}

function verified(
  provider: 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY',
  patch: Partial<VerifiedProviderEvent> = {},
): VerifiedProviderEvent {
  return {
    provider,
    authenticity: 'accepted',
    eventId: `${provider}-evt-1`,
    transactionHandle: `${provider}-pay-1`,
    financialAuthority: false,
    notificationId: `${provider}-nt-1`,
    ...patch,
  }
}

function payment(
  provider: 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY',
  patch: Partial<ProviderPayment> = {},
): ProviderPayment {
  return {
    provider,
    providerTransactionId: `${provider}-pay-1`,
    providerRawStatus: 'approved',
    normalizedStatus: 'APPROVED',
    amountCents: 140000,
    currency: 'MXN',
    orderCorrelation: ORDER_ID,
    ...patch,
  }
}

function expected(provider: 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY'): ExpectedFinancialSnapshot {
  return { provider, orderId: ORDER_ID, amountCents: 140000, currency: 'MXN' }
}

function eligible(provider: 'MERCADO_PAGO' | 'CLIP' | 'OPENPAY'): CanonicalApplyEvidence {
  return {
    event: verified(provider),
    payment: payment(provider),
    expected: expected(provider),
    decision: {
      paidSemantics: 'eligible_for_domain_tx',
      source: 'financial_resolution',
      normalizedStatus: 'APPROVED',
    },
    ownershipProof: ownershipProof(provider),
  }
}

describe('MULTI-PAY-7S commercial vs durable storage mapping', () => {
  it('keeps lowercase commercial snapshot ids unchanged', () => {
    expect(toCanonicalPaymentStorageId('MERCADO_PAGO')).toBe('mercadopago')
    expect(toCanonicalPaymentStorageId('CLIP')).toBe('clip')
    expect(toCanonicalPaymentStorageId('OPENPAY')).toBe('openpay')
    expect(fromCanonicalPaymentStorageId('mercadopago')).toBe('MERCADO_PAGO')
    expect(fromCanonicalPaymentStorageId('clip')).toBe('CLIP')
    expect(fromCanonicalPaymentStorageId('openpay')).toBe('OPENPAY')
  })

  it('maps durable payment/webhook provider ids without rewriting commercial snapshot', () => {
    expect(toDurablePaymentProviderId('MERCADO_PAGO')).toBe('MERCADOPAGO')
    expect(toDurablePaymentProviderId('CLIP')).toBe('CLIP')
    expect(toDurablePaymentProviderId('OPENPAY')).toBe('OPENPAY')
    expect(fromDurablePaymentProviderId('MERCADOPAGO')).toBe('MERCADO_PAGO')
    expect(fromDurablePaymentProviderId('CLIP')).toBe('CLIP')
    expect(fromDurablePaymentProviderId('OPENPAY')).toBe('OPENPAY')
  })

  it('fails closed on unknown commercial and durable storage identifiers', () => {
    expect(() => fromCanonicalPaymentStorageId('paypal')).toThrow(PaymentContractError)
    expect(() => fromCanonicalPaymentStorageId('MERCADOPAGO')).toThrow(PaymentContractError)
    expect(() => fromDurablePaymentProviderId('paypal')).toThrow(PaymentContractError)
    expect(() => fromDurablePaymentProviderId('mercadopago')).toThrow(PaymentContractError)
    expect(() => parseActivePaymentProviderId('PAYPAL')).toThrow(PaymentContractError)
    expect(() => parseActivePaymentProviderId('')).toThrow(PaymentContractError)
  })
})

describe('MULTI-PAY-7S canonical domain apply port', () => {
  it('emits explicit MERCADO_PAGO contract provider without storage fallback', () => {
    const payload = mapEligibleEvidenceToCanonicalApplyPayload(eligible('MERCADO_PAGO'))
    expect(payload).toEqual({
      provider: 'MERCADO_PAGO',
      provider_notification_id: 'MERCADO_PAGO-nt-1',
      notification_type: 'payment',
      provider_payment_id: 'MERCADO_PAGO-pay-1',
      external_state: 'approved',
      normalized_state: 'APPROVED',
      amount_cents: 140000,
      currency: 'MXN',
      external_reference: ORDER_ID,
      merchant_ownership_ok: true,
      external_reference_ok: true,
      amount_ok: true,
      currency_ok: true,
    })
    expect(payload).not.toHaveProperty('storage_provider')
  })

  it('emits the same payload shape for Clip with account-scoped ownership proof', () => {
    const payload = mapEligibleEvidenceToCanonicalApplyPayload(eligible('CLIP'))
    expect(payload.provider).toBe('CLIP')
    expect(payload.provider_payment_id).toBe('CLIP-pay-1')
    expect(payload.provider_notification_id).toBe('CLIP-nt-1')
    expect(payload.merchant_ownership_ok).toBe(true)
  })

  it('emits the same payload shape for Openpay with account-scoped ownership proof', () => {
    const payload = mapEligibleEvidenceToCanonicalApplyPayload(eligible('OPENPAY'))
    expect(payload.provider).toBe('OPENPAY')
    expect(payload.provider_payment_id).toBe('OPENPAY-pay-1')
    expect(payload.provider_notification_id).toBe('OPENPAY-nt-1')
  })

  it('fails closed without explicit ownership proof', () => {
    const evidence = eligible('MERCADO_PAGO')
    delete (evidence as { ownershipProof?: CanonicalOwnershipProof }).ownershipProof
    expect(() => mapEligibleEvidenceToCanonicalApplyPayload(evidence)).toThrow(PaymentContractError)
  })

  it('does not accept Mercado Pago evidence with Clip/Openpay ownership mechanism', () => {
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('MERCADO_PAGO'),
        ownershipProof: { mechanism: 'account_scoped_get', verified: true },
      }),
    ).toThrow(PaymentContractError)
  })

  it('does not translate pending or negative paidSemantics into apply payload', () => {
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('MERCADO_PAGO'),
        decision: { paidSemantics: false, source: 'non_approved', normalizedStatus: 'PENDING' },
      }),
    ).toThrow(PaymentContractError)
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('MERCADO_PAGO'),
        decision: { paidSemantics: false, source: 'non_approved', normalizedStatus: 'REJECTED' },
      }),
    ).toThrow(PaymentContractError)
  })

  it('fails closed on missing notification or payment identity', () => {
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('CLIP'),
        event: verified('CLIP', { notificationId: '   ', eventId: '   ' }),
      }),
    ).toThrow(PaymentContractError)
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('OPENPAY'),
        payment: payment('OPENPAY', { providerTransactionId: '   ' }),
      }),
    ).toThrow(PaymentContractError)
  })

  it('fails closed on provider or snapshot mismatch', () => {
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('MERCADO_PAGO'),
        payment: payment('CLIP'),
      }),
    ).toThrow(PaymentContractError)
    expect(() =>
      mapEligibleEvidenceToCanonicalApplyPayload({
        ...eligible('MERCADO_PAGO'),
        payment: payment('MERCADO_PAGO', { amountCents: 1 }),
      }),
    ).toThrow(PaymentContractError)
  })

  it('is deterministic and does not issue tickets, registrations, or RPC calls', () => {
    const first = mapEligibleEvidenceToCanonicalApplyPayload(eligible('MERCADO_PAGO'))
    const second = mapEligibleEvidenceToCanonicalApplyPayload(eligible('MERCADO_PAGO'))
    expect(first).toEqual(second)
    const serialized = JSON.stringify(first)
    expect(serialized).not.toMatch(/ticket|registration|qr|rpc|webhook_apply_payment_tx|pan|cvv|secret|email/i)
    expect(first).not.toHaveProperty('ticketId')
    expect(first).not.toHaveProperty('registrationId')
  })
})

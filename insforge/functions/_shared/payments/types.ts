import type { ActivePaymentProviderId } from './ids'
import type { NormalizedPaymentStatus } from './status'

/** Sales Domain mark consumed by Multi-Pay. Adapters do not compute it. */
export type PaymentEligibleMark = 'PAYMENT_ELIGIBLE'

export type CheckoutCurrency = 'MXN'

/**
 * Already-resolved canonical payment input. Amount/currency come from the
 * canonical order snapshot, never from frontend commercial authority.
 */
export type ResolvedPaymentCheckoutInput = {
  eligibility: PaymentEligibleMark
  orderId: string
  provider: ActivePaymentProviderId
  amountCents: number
  currency: CheckoutCurrency
  reference: string
  description: string
  returnUrls: {
    success: string
    failure: string
    pending: string
  }
  /** Already-resolved upstream hold/order expiry. Adapters must not compute it. */
  expiresAt?: string
}

/**
 * Hosted/redirected checkout destination. `financialAuthority` is always false:
 * redirect/return URLs cannot produce PAID.
 */
export type ProviderCheckoutResult = {
  provider: ActivePaymentProviderId
  checkoutHandle: string
  redirectUrl: string
  financialAuthority: false
}

/**
 * Provider-specific event ingress. Authenticity mechanisms are not shared.
 * A verified event is a handle, not financial authority.
 */
export type ProviderEventInput =
  | {
      provider: 'MERCADO_PAGO'
      authenticity: {
        mechanism: 'x-signature'
        /** Present for real MP ingress. Mock adapters may omit. Secret is never included. */
        xSignature?: string
        xRequestId?: string
        dataId?: string
      }
      eventId: string
      transactionHandle: string
    }
  | {
      provider: 'CLIP'
      authenticity: {
        mechanism: 'event_handle'
        paymentRequestId?: string
        notificationId?: string
        resource?: string
        resourceStatus?: string
      }
      eventId: string
      transactionHandle: string
    }
  | {
      provider: 'OPENPAY'
      authenticity: {
        mechanism: 'http_basic_ingress'
        /** Ingress Basic username. Never a financial secret in the event body. */
        username?: string
        /** Ingress Basic password. Never logged. Optional so in-memory mocks stay valid. */
        password?: string
        eventType?: string
        verificationCode?: string
        transactionId?: string
      }
      eventId: string
      transactionHandle: string
    }

export type VerifiedProviderEvent = {
  provider: ActivePaymentProviderId
  authenticity: 'accepted'
  eventId: string
  transactionHandle: string
  financialAuthority: false
  notificationId?: string
}

/** Authoritative server-side provider lookup result. Null money fields fail closed. */
export type ProviderPayment = {
  provider: ActivePaymentProviderId
  providerTransactionId: string
  providerRawStatus: string
  normalizedStatus: NormalizedPaymentStatus
  amountCents: number | null
  currency: string | null
  orderCorrelation: string | null
}

export type ExpectedFinancialSnapshot = {
  provider: ActivePaymentProviderId
  orderId: string
  amountCents: number
  currency: CheckoutCurrency
}

export type FinancialCorrespondenceFailure =
  | 'PROVIDER_MISMATCH'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'CORRELATION_MISMATCH'
  | 'MISSING_CORRELATION'
  | 'MISSING_AMOUNT'
  | 'MISSING_CURRENCY'

export type FinancialCorrespondenceResult =
  | { ok: true }
  | { ok: false; reason: FinancialCorrespondenceFailure }

/**
 * This layer never asserts order PAID. The strongest outcome is eligibility
 * for the existing canonical domain transaction.
 */
export type PaidSemanticsDecision =
  | { paidSemantics: false; source: 'redirect' }
  | { paidSemantics: false; source: 'verified_event' }
  | { paidSemantics: false; source: 'unknown_status' }
  | { paidSemantics: false; source: 'non_approved'; normalizedStatus: NormalizedPaymentStatus }
  | { paidSemantics: false; source: 'financial_mismatch'; reason: FinancialCorrespondenceFailure }
  | { paidSemantics: false; source: 'missing_transaction_id' }
  | {
      paidSemantics: 'eligible_for_domain_tx'
      source: 'financial_resolution'
      normalizedStatus: 'APPROVED'
    }

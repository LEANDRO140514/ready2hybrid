export { PaymentContractError, isPaymentContractError } from './errors'
export type { PaymentContractErrorCode } from './errors'

export {
  ACTIVE_PAYMENT_PROVIDER_IDS,
  isActivePaymentProviderId,
  parseActivePaymentProviderId,
  resolveSelectableProvider,
} from './ids'
export type { ActivePaymentProviderId, ProviderEnablement } from './ids'

export {
  MOCK_CONTRACT_STATUS_FIXTURES,
  NORMALIZED_PAYMENT_STATUSES,
  isNormalizedPaymentStatus,
  normalizeMockContractStatus,
} from './status'
export type { NormalizedPaymentStatus } from './status'

export { parseResolvedPaymentCheckoutInput } from './checkout-input'

export { requiredEventMechanism } from './adapter'
export type { PaymentProviderAdapter } from './adapter'

export {
  correspondFinancially,
  decidePaidSemanticsFromPayment,
  decidePaidSemanticsFromRedirect,
  decidePaidSemanticsFromVerifiedEvent,
} from './authority'

export { selectPaymentProviderAdapter } from './registry'
export type { PaymentProviderRegistry } from './registry'

export {
  describeProviderAvailability,
  enabledProviderIds,
  isRuntimeEnabled,
  SAFE_RUNTIME_ENABLEMENT,
} from './availability'
export type { ProviderAvailability } from './availability'

export { createPaymentCheckout } from './checkout-orchestration'
export type { CreatePaymentCheckoutArgs } from './checkout-orchestration'

export { resolveProviderEvent } from './event-orchestration'
export type {
  ProviderEventResolution,
  ResolveProviderEventArgs,
} from './event-orchestration'

export { mapEligibleEvidenceToCanonicalApplyPayload } from './domain-apply-port'
export type {
  CanonicalApplyEvidence,
  CanonicalOwnershipProof,
  CanonicalWebhookApplyPayload,
} from './domain-apply-port'

export {
  fromCanonicalPaymentStorageId,
  fromDurablePaymentProviderId,
  toCanonicalPaymentStorageId,
  toDurablePaymentProviderId,
  CLIP_DURABLE_PAYMENT_PROVIDER,
  MERCADO_PAGO_DURABLE_PAYMENT_PROVIDER,
  OPENPAY_DURABLE_PAYMENT_PROVIDER,
} from './storage-mapping'
export type { CanonicalPaymentStorageId, DurablePaymentProviderId } from './storage-mapping'

export {
  fromMercadoPagoStorageId,
  MERCADO_PAGO_STORAGE_ID,
  toMercadoPagoStorageId,
} from './storage-mapping'
export type { MercadoPagoStorageId } from './storage-mapping'

export {
  CLIP_STORAGE_ID,
  fromClipStorageId,
  toClipStorageId,
} from './storage-mapping'
export type { ClipStorageId } from './storage-mapping'

export {
  OPENPAY_STORAGE_ID,
  fromOpenpayStorageId,
  toOpenpayStorageId,
} from './storage-mapping'
export type { OpenpayStorageId } from './storage-mapping'

export { createOpenpayPaymentAdapter } from './openpay-adapter'
export type { OpenpayAdapterDeps } from './openpay-adapter'

export { createClipPaymentAdapter } from './clip-adapter'
export type { ClipAdapterDeps } from './clip-adapter'

export { createMercadoPagoPaymentAdapter } from './mercadopago-adapter'
export type {
  MercadoPagoAdapterDeps,
  MercadoPagoPreferencePort,
  MercadoPagoPreferencePortInput,
  MercadoPagoPreferencePortResult,
} from './mercadopago-adapter'

export type {
  CheckoutCurrency,
  ExpectedFinancialSnapshot,
  FinancialCorrespondenceFailure,
  FinancialCorrespondenceResult,
  PaidSemanticsDecision,
  PaymentEligibleMark,
  ProviderCheckoutResult,
  ProviderEventInput,
  ProviderPayment,
  ResolvedPaymentCheckoutInput,
  VerifiedProviderEvent,
} from './types'

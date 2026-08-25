export type PaymentContractErrorCode =
  | 'UNSUPPORTED_PROVIDER'
  | 'INVALID_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_EVENT'
  | 'FINANCIAL_RESOLUTION_FAILURE'
  | 'FINANCIAL_MISMATCH'
  | 'UNKNOWN_FINANCIAL_STATE'

export class PaymentContractError extends Error {
  readonly code: PaymentContractErrorCode

  constructor(code: PaymentContractErrorCode, detail?: string) {
    super(detail ?? code)
    this.code = code
  }
}

export function isPaymentContractError(error: unknown): error is PaymentContractError {
  return error instanceof PaymentContractError
}

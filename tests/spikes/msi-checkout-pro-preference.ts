/**
 * Isolated spike — Checkout Pro preference payment_methods for MSI policy.
 * NOT wired into mp-create-checkout / orchestrate (productive path unchanged).
 *
 * Authority: SALES-GO-LIVE-0C-MP-MSI-SPIKE (LOCAL_SPIKE_AND_READ_ONLY_PROVIDER_RESEARCH)
 * Commercial: 3 MSI for eligible families; none for WOD/PUB/FOT; ENFORMA absorbs cost.
 */
import {
  getProductStagePriceRow,
  type StagePriceRow,
} from '../../insforge/functions/_shared/checkout/staged-pricing'

export const MSI_MAX_INSTALLMENTS = 3 as const

/** Offline / ticket methods (OXXO, Paycash family) — exclude on every preference. */
export const ASYNC_EXCLUDED_PAYMENT_TYPES = [{ id: 'ticket' }] as const

export type PreferencePaymentMethodsConfig = {
  excluded_payment_types: Array<{ id: string }>
  excluded_payment_methods: Array<{ id: string }>
  /** Maximum credit-card installments accepted for this preference (1–36 per MP API). */
  installments: number
  default_installments?: number
}

export type MsiPreferenceSpikeResult =
  | {
      ok: true
      product_code: string
      commercial_msi_eligible: boolean
      payment_methods: PreferencePaymentMethodsConfig
      public_message_key: 'MSI_ELIGIBLE_DISCLAIMER' | 'MSI_EXCLUDED_SILENT'
      notes: string[]
    }
  | {
      ok: false
      error: 'PRODUCT_DISABLED' | 'MULTIDAY_FAIL_CLOSED' | 'CONFIGURATION_ERROR'
      product_code: string
    }

/**
 * Build the Checkout Pro `payment_methods` fragment expected for a SKU.
 * Does not call Mercado Pago. Does not mutate productive clients.
 */
export function buildMsiPreferencePaymentMethods(
  productCode: string,
  priceRow?: StagePriceRow | null,
): MsiPreferenceSpikeResult {
  const row = priceRow === undefined ? getProductStagePriceRow(productCode) : priceRow
  if (!row) {
    return { ok: false, error: 'PRODUCT_DISABLED', product_code: productCode }
  }
  if (row.multiday_fail_closed) {
    return { ok: false, error: 'MULTIDAY_FAIL_CLOSED', product_code: productCode }
  }
  if (!row.checkout_enabled) {
    return { ok: false, error: 'PRODUCT_DISABLED', product_code: productCode }
  }

  if (row.msi_eligible) {
    return {
      ok: true,
      product_code: productCode,
      commercial_msi_eligible: true,
      payment_methods: {
        excluded_payment_types: [...ASYNC_EXCLUDED_PAYMENT_TYPES],
        excluded_payment_methods: [],
        installments: MSI_MAX_INSTALLMENTS,
        default_installments: MSI_MAX_INSTALLMENTS,
      },
      public_message_key: 'MSI_ELIGIBLE_DISCLAIMER',
      notes: [
        'Commercial eligibility is true; interest-free MSI still depends on account MSI plan + card + amount.',
        'payment_methods.installments=3 caps maximum installments for this preference only.',
      ],
    }
  }

  return {
    ok: true,
    product_code: productCode,
    commercial_msi_eligible: false,
    payment_methods: {
      excluded_payment_types: [...ASYNC_EXCLUDED_PAYMENT_TYPES],
      excluded_payment_methods: [],
      // Cap at 1 to avoid offering multi-installment plans on excluded SKUs.
      installments: 1,
    },
    public_message_key: 'MSI_EXCLUDED_SILENT',
    notes: [
      'Commercial MSI must not be advertised.',
      'installments=1 is the preference-level suppress; requires live confirmation when account MSI is enabled.',
    ],
  }
}

/** Example preference body fragment for structural tests (no network). */
export function buildSpikePreferenceBody(input: {
  orderId: string
  productCode: string
  productName: string
  unitPriceMxn: number
  quantity: number
  paymentMethods: PreferencePaymentMethodsConfig
}): Record<string, unknown> {
  return {
    external_reference: input.orderId,
    items: [
      {
        id: input.productCode,
        title: input.productName,
        quantity: input.quantity,
        currency_id: 'MXN',
        unit_price: input.unitPriceMxn,
      },
    ],
    payment_methods: input.paymentMethods,
    metadata: {
      product_code: input.productCode,
      msi_policy: 'r2h-commercial-2026.1',
    },
  }
}

export const PUBLIC_MSI_COPY = {
  MSI_ELIGIBLE_DISCLAIMER:
    'Hasta 3 meses sin intereses con tarjetas participantes. La disponibilidad final depende de Mercado Pago y del banco emisor.',
  MSI_EXCLUDED_SILENT: null,
} as const

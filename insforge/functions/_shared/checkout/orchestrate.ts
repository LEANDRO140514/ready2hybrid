import { CheckoutError, isCheckoutError } from './errors'
import { loadCheckoutRuntimeConfig, type CheckoutRuntimeConfig } from './config'
import { fingerprintRequest, hashIdempotencyKey } from './idempotency'
import { journeyForProductCode } from './journeys'
import type { MercadoPagoClient } from './mp-client'
import { buildPriceSnapshot } from './pricing'
import { assertCheckoutProductAvailable } from './eligibility'
import { assertQuantityForProduct, capacityUnitsForQuantity } from './quantity'
import { assertProductSellable, assertSalesOpen, type EventSalesRow, type ProductSalesRow } from './sales'
import { parseCheckoutRequest } from './validate'

export type CatalogPort = {
  getProductWithEvent: (
    productCode: string,
  ) => Promise<{ product: ProductSalesRow; event: EventSalesRow } | null>
}

export type CheckoutTxInput = {
  productCode: string
  quantity: number
  journey: string
  unitPriceCents: number
  itemTotalCents: number
  totalCents: number
  currency: 'MXN'
  capacityUnit: string
  capacityUnits: number
  holdDurationSeconds: number
  idempotencyKeyHash: string
  requestFingerprint: string
  idempotencyTtlSeconds: number
  correlationId: string
  buyerPublicRef: string | null
  participantPublicRef: string | null
  commercialSnapshot: Record<string, unknown>
  invitationTtlSeconds: number | null
  waiverDocumentType: string | null
  waiverDocumentVersion: string | null
  waiverAccepted: boolean
}

export type CheckoutTxResult = {
  orderId: string
  trackingRef: string
  orderItemId: string
  holdId: string
  expiresAt: string
  replay: boolean
  priorResponse: CheckoutSuccessResponse | null
  invitationTokens: Array<{ token: string }>
}

export type CheckoutRepository = {
  startCheckoutTx: (input: CheckoutTxInput) => Promise<CheckoutTxResult>
  attachPreference: (input: {
    orderId: string
    preferenceId: string
    initPoint: string
    invitationTokens: Array<{ token: string }>
  }) => Promise<void>
  compensatePreferenceFailure: (input: {
    orderId: string
    holdId: string
    reason: string
  }) => Promise<void>
}

export type CheckoutSuccessResponse = {
  checkout_url: string
  public_order_reference: string
  expires_at: string
  roster_invitations?: Array<{ token: string }>
}

export type OrchestrateDeps = {
  env: (key: string) => string | undefined
  catalog: CatalogPort
  repo: CheckoutRepository
  mp: MercadoPagoClient
  now?: () => Date
  randomId?: () => string
}

function publicSuccess(body: CheckoutSuccessResponse): { status: number; body: CheckoutSuccessResponse } {
  return { status: 200, body }
}

export async function orchestrateCheckoutStart(
  rawBody: unknown,
  deps: OrchestrateDeps,
): Promise<{ status: number; body: unknown }> {
  try {
    const req = parseCheckoutRequest(rawBody)
    const journey = journeyForProductCode(req.product_code)
    if (!journey) throw new CheckoutError('PRODUCT_NOT_FOUND')

    const found = await deps.catalog.getProductWithEvent(req.product_code)
    if (!found) throw new CheckoutError('PRODUCT_NOT_FOUND')

    // OD-020: block multiday ASISTE before sales window, idempotency, holds, or MP.
    assertCheckoutProductAvailable(found.product)

    assertSalesOpen(found.event, deps.now?.() ?? new Date())
    assertProductSellable(found.product)
    assertQuantityForProduct(found.product, req.quantity)

    const config = loadCheckoutRuntimeConfig(deps.env)
    assertWaiverConfig(config, journey, req.waiver)
    if ((journey === 'J2' || journey === 'J3') && !config.invitationTtlSeconds) {
      throw new CheckoutError('CONFIGURATION_ERROR', 'TEAM_INVITATION_TTL_SECONDS missing')
    }

    const price = buildPriceSnapshot(found.product, journey, req.quantity)
    const capacityUnits = capacityUnitsForQuantity(found.product, req.quantity)
    const normalized = {
      product_code: req.product_code,
      quantity: req.quantity,
      buyer: req.buyer ?? null,
      participant: req.participant ?? null,
      waiver: req.waiver ?? null,
    }
    const idempotencyKeyHash = await hashIdempotencyKey(req.idempotency_key)
    const requestFingerprint = await fingerprintRequest(normalized)
    const correlationId = req.correlation_id ?? deps.randomId?.() ?? crypto.randomUUID()

    const tx = await deps.repo.startCheckoutTx({
      productCode: found.product.code,
      quantity: req.quantity,
      journey,
      unitPriceCents: price.unit_price_cents,
      itemTotalCents: price.item_total_cents,
      totalCents: price.total_cents,
      currency: 'MXN',
      capacityUnit: price.capacity_unit,
      capacityUnits,
      holdDurationSeconds: config.holdDurationSeconds,
      idempotencyKeyHash,
      requestFingerprint,
      idempotencyTtlSeconds: config.idempotencyTtlSeconds,
      correlationId,
      buyerPublicRef: req.buyer?.public_ref ?? null,
      participantPublicRef: req.participant?.public_ref ?? null,
      invitationTtlSeconds: config.invitationTtlSeconds,
      waiverDocumentType: req.waiver?.document_type ?? null,
      waiverDocumentVersion: req.waiver?.version ?? null,
      waiverAccepted: Boolean(req.waiver?.accepted),
      commercialSnapshot: {
        product_code: found.product.code,
        product_name: found.product.name,
        block: found.product.block,
        kind: found.product.kind,
        team_size: found.product.team_size,
        has_chip: found.product.has_chip,
        has_insurance: found.product.has_insurance,
        economic_unit: price.economic_unit,
        capacity_unit: price.capacity_unit,
        chip_extra_cents: 0,
        insurance_extra_cents: 0,
        unit_price_cents: price.unit_price_cents,
        quantity: req.quantity,
        currency: 'MXN',
      },
    })

    if (tx.replay && tx.priorResponse) {
      return publicSuccess(tx.priorResponse)
    }

    try {
      const preference = await deps.mp.createCheckoutProPreference({
        accessToken: config.mpAccessToken,
        siteId: config.mpSiteId,
        orderId: tx.orderId,
        productCode: found.product.code,
        productName: found.product.name,
        price,
        backUrls: {
          success: config.backUrlSuccess,
          failure: config.backUrlFailure,
          pending: config.backUrlPending,
        },
        notificationUrl: config.notificationUrl,
        expiresAt: tx.expiresAt,
      })

      await deps.repo.attachPreference({
        orderId: tx.orderId,
        preferenceId: preference.preferenceId,
        initPoint: preference.initPoint,
        invitationTokens: tx.invitationTokens,
      })

      const body: CheckoutSuccessResponse = {
        checkout_url: preference.initPoint,
        public_order_reference: tx.trackingRef,
        expires_at: tx.expiresAt,
      }
      if (tx.invitationTokens.length > 0) {
        body.roster_invitations = tx.invitationTokens
      }
      return publicSuccess(body)
    } catch (error) {
      await deps.repo.compensatePreferenceFailure({
        orderId: tx.orderId,
        holdId: tx.holdId,
        reason: 'PREFERENCE_FAILED',
      })
      if (isCheckoutError(error)) throw error
      throw new CheckoutError('CHECKOUT_CREATION_FAILED')
    }
  } catch (error) {
    if (isCheckoutError(error)) {
      return { status: error.status, body: error.toPublicBody() }
    }
    return {
      status: 500,
      body: new CheckoutError('INTERNAL_ERROR').toPublicBody(),
    }
  }
}

function assertWaiverConfig(
  config: CheckoutRuntimeConfig,
  journey: string,
  waiver: { document_type?: string; version?: string; accepted?: boolean } | undefined,
): void {
  const competitive = journey === 'J1' || journey === 'J2' || journey === 'J3'
  if (!competitive) return
  if (!config.waiverRequiredDocumentType || !config.waiverRequiredVersion) {
    throw new CheckoutError('CONFIGURATION_ERROR', 'Waiver configuration missing')
  }
  if (!waiver?.accepted) {
    throw new CheckoutError('WAIVER_REQUIRED')
  }
  if (
    waiver.document_type !== config.waiverRequiredDocumentType ||
    waiver.version !== config.waiverRequiredVersion
  ) {
    throw new CheckoutError('WAIVER_REQUIRED')
  }
}

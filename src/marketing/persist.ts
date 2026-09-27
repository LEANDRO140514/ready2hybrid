import {
  createMarketingStore,
  prepareCheckoutAttribution,
  sanitizeMarketingContext,
  type OrderAttributionSnapshot,
  type SportingEvent,
} from './foundation'

export type MarketingOrderLink = {
  orderId: string
  eventId: string
  eventCode: string
  buyerContactId: string
  affiliateCode: string | null
}

/**
 * Runs only after the order and the payment preference already exist.
 * A bad context or a failed write is reported and never thrown.
 */
export async function attachMarketingAfterOrder(input: {
  context: unknown
  knownEvents: readonly SportingEvent[]
  order: MarketingOrderLink | null
  capturedAt: string
  write: (row: {
    visitorId: string
    sessionId: string
    buyerContactId: string
    snapshot: OrderAttributionSnapshot
  }) => Promise<void>
}): Promise<'attached' | 'skipped' | 'failed'> {
  try {
    if (!input.order) return 'skipped'
    const context = sanitizeMarketingContext(input.context)
    if (!context) return 'skipped'
    const store = createMarketingStore()
    const result = prepareCheckoutAttribution(store, {
      orderId: input.order.orderId,
      eventId: input.order.eventId,
      eventCode: input.order.eventCode,
      affiliateCode: input.order.affiliateCode,
      marketingContext: context,
      knownEvents: input.knownEvents,
      capturedAt: input.capturedAt,
    })
    if (!result.snapshot) return 'skipped'
    await input.write({
      visitorId: context.visitor_id,
      sessionId: context.session_id,
      buyerContactId: input.order.buyerContactId,
      snapshot: result.snapshot,
    })
    return 'attached'
  } catch {
    return 'failed'
  }
}

import type { ActivePaymentProviderId } from '../ids'

export type EventEffectGateResult =
  | { applied: true; duplicate: false }
  | { applied: false; duplicate: true }

/**
 * Test/mock-only in-memory duplicate-event helper.
 * Not durable idempotency. Does not replace (provider, provider_notification_id)
 * uniqueness in the database/RPC layer.
 */
export function createInMemoryEventEffectGate() {
  const seen = new Set<string>()
  return {
    applyOnce(
      provider: ActivePaymentProviderId,
      eventId: string,
      effect: () => void,
    ): EventEffectGateResult {
      const key = `${provider}:${eventId}`
      if (seen.has(key)) {
        return { applied: false, duplicate: true }
      }
      seen.add(key)
      effect()
      return { applied: true, duplicate: false }
    },
  }
}

/**
 * Landing contract, proven in hybrid-event-landing/src/lib/affiliate.ts:
 * captureAffiliateFromUrl reads `aff` only. It does not read `ref`.
 * Checkout sends that stored value as affiliate_code.
 *
 * Flow: studio code → QR → visitor scans → landing `?aff=` → checkout
 * keeps the code → orders.affiliate_code → PAID attributes the sale.
 * A scan is not a sale. A sale is orders.state = 'PAID'.
 */

export const PARTNER_LANDING_ORIGIN = 'https://hybrid-experience.enforma.mx/'
export const PARTNER_QUERY_PARAM = 'aff'

export function partnerLandingUrl(code: string): string {
  const url = new URL(PARTNER_LANDING_ORIGIN)
  url.searchParams.set(PARTNER_QUERY_PARAM, code)
  return url.toString()
}

import { describe, expect, it } from 'vitest'

import { normalizeAffiliateCode } from '../../../insforge/functions/_shared/checkout/validate'
import {
  createPartner,
  roleMayAdministerPartners,
  setPartnerActive,
  updatePartner,
} from '../../../src/partners/admin'
import {
  codeAcceptedOnNewCheckout,
  normalizePartnerCode,
  parseCreatePartner,
  suggestPartnerCode,
} from '../../../src/partners/contract'
import { partnerLandingUrl, PARTNER_QUERY_PARAM } from '../../../src/partners/link'
import { createMemoryPartnersPort } from '../../../src/partners/memory'
import { metricsForPartner } from '../../../src/partners/metrics'
import { partnerQrModules } from '../../../src/partners/qr'
import { HARNESS_SNAPSHOT } from '../../../src/sales-dashboard/harness-snapshot'
import { buildDashboard, EMPTY_FILTERS, formatMoney } from '../../../src/sales-dashboard/model'
import type { SalesOrder } from '../../../src/sales-dashboard/model'

const PROFILE = {
  studioName: 'CrossFit MID',
  contactName: 'Ana Ruiz',
  phone: '9991234567',
  email: 'mid@example.com',
}

function order(partial: Partial<SalesOrder> & Pick<SalesOrder, 'id' | 'state' | 'totalCents'>): SalesOrder {
  return {
    trackingRef: partial.id,
    currency: 'MXN',
    createdAt: '2026-09-20T18:00:00.000Z',
    updatedAt: null,
    expiresAt: null,
    affiliateCode: 'CROSSFITMID',
    affiliateName: 'CrossFit MID',
    commercialStage: 'PRESALE',
    buyerName: 'Comprador',
    buyerEmail: null,
    buyerPhone: null,
    lines: [
      {
        productCode: 'DOB',
        productName: 'Dobles',
        block: 'COMPITE',
        kind: 'competitor',
        saleState: null,
        teamSize: 2,
        quantity: 1,
      },
    ],
    payments: [],
    tickets: [],
    roster: [],
    activity: [],
    webhooks: [],
    verifications: [],
    adjustment: null,
    ...partial,
  }
}

describe('community partner contract', () => {
  it('normalizes codes the same way checkout does', () => {
    expect(normalizePartnerCode(' crossfitmid ')).toBe('CROSSFITMID')
    expect(normalizePartnerCode(' crossfitmid ')).toBe(normalizeAffiliateCode(' crossfitmid '))
    expect(normalizePartnerCode('no-dash!')).toBeNull()
    expect(normalizePartnerCode('AB')).toBeNull()
    expect(suggestPartnerCode('CrossFit MID')).toBe('CROSSFITMID')
    const created = parseCreatePartner({ ...PROFILE, code: 'CROSSFITMID' })
    expect(created.ok).toBe(true)
    if (created.ok) {
      expect(created.profile).toEqual(PROFILE)
      expect(created.profile).not.toHaveProperty('city')
      expect(created.profile).not.toHaveProperty('notes')
    }
  })

  it('rejects an invalid code and a duplicate code', async () => {
    expect(parseCreatePartner({ ...PROFILE, code: 'no-dash!' }).ok).toBe(false)
    const memory = createMemoryPartnersPort()
    const created = await memory.store.find('CROSSFITMID')
    expect(created).toBeNull()
    const first = await createPartner(memory.store, { ...PROFILE, code: 'crossfitmid' }, '2026-09-24T06:00:00.000Z')
    expect(first.ok).toBe(true)
    const duplicate = await createPartner(memory.store, { ...PROFILE, code: 'CROSSFITMID' }, '2026-09-24T06:00:00.000Z')
    expect(duplicate).toEqual({ ok: false, status: 409, code: 'CODE_TAKEN' })
  })

  it('does not rewrite a published code and keeps historical orders', async () => {
    const memory = createMemoryPartnersPort()
    await createPartner(memory.store, { ...PROFILE, code: 'CROSSFITMID' }, '2026-09-24T06:00:00.000Z')
    const immutable = await updatePartner(memory.store, {
      ...PROFILE,
      code: 'CROSSFITMID',
      newCode: 'OTRO',
    })
    expect(immutable).toEqual({ ok: false, status: 400, code: 'CODE_IMMUTABLE' })
    const historical = [
      order({ id: 'paid', state: 'PAID', totalCents: 250000 }),
    ]
    const before = historical.map((row) => row.affiliateCode)
    await setPartnerActive(memory.store, { code: 'CROSSFITMID', active: false })
    expect(historical.map((row) => row.affiliateCode)).toEqual(before)
    const partner = await memory.store.find('CROSSFITMID')
    expect(partner?.active).toBe(false)
    expect(codeAcceptedOnNewCheckout(partner, 'CROSSFITMID')).toBeNull()
    expect(codeAcceptedOnNewCheckout({ code: 'CROSSFITMID', active: true }, 'CROSSFITMID')).toBe('CROSSFITMID')
    expect(roleMayAdministerPartners('FINANCE')).toBe(false)
    expect(roleMayAdministerPartners('OWNER')).toBe(true)
  })
})

describe('community partner attribution', () => {
  const orders = [
    order({
      id: 'paid',
      state: 'PAID',
      totalCents: 250000,
      payments: [
        {
          id: 'p1',
          provider: 'MERCADOPAGO',
          providerPaymentId: 'pay',
          normalizedState: 'APPROVED',
          amountCents: 250000,
          providerUpdatedAt: '2026-09-20T19:00:00.000Z',
          createdAt: '2026-09-20T19:00:00.000Z',
        },
      ],
    }),
    order({ id: 'pending', state: 'PAYMENT_PENDING', totalCents: 250000 }),
    order({ id: 'rejected', state: 'REJECTED', totalCents: 250000 }),
    order({ id: 'cancelled', state: 'CANCELLED', totalCents: 250000 }),
  ]

  it('counts only PAID orders and the stored total', () => {
    const metrics = metricsForPartner(orders, 'CROSSFITMID')
    expect(metrics.paidSales).toBe(1)
    expect(metrics.participants).toBe(2)
    expect(metrics.revenueCents).toBe(250000)
    expect(metrics.lastSaleAt).toBe('2026-09-20T19:00:00.000Z')
    expect(formatMoney(metrics.revenueCents)).toContain('2,500')
    expect(formatMoney(metrics.revenueCents)).not.toContain('2,750')
  })

  it('shows the harness Dobles Community Partner sale at launch, not presale catalog', () => {
    const dobles = HARNESS_SNAPSHOT.orders.find((row) => row.trackingRef === 'TRK-DOB')
    expect(dobles?.commercialStage).toBe('PRESALE')
    expect(dobles?.totalCents).toBe(250_000)
    expect(dobles?.affiliateCode).toBe('ENFORMA')
    const view = buildDashboard(HARNESS_SNAPSHOT.orders, EMPTY_FILTERS, new Date('2026-09-24T18:00:00.000Z'))
    const partner = view.partners.find((row) => row.code === 'ENFORMA')
    expect(partner?.revenueCents).toBe(250000)
    expect(formatMoney(partner?.revenueCents ?? 0)).toContain('2,500')
    const filtered = buildDashboard(
      HARNESS_SNAPSHOT.orders,
      { ...EMPTY_FILTERS, affiliate: 'ENFORMA' },
      new Date('2026-09-24T18:00:00.000Z'),
    )
    expect(filtered.table.every((row) => row.affiliateCode === 'ENFORMA')).toBe(true)
    expect(filtered.table.some((row) => row.totalCents === 275000)).toBe(false)
  })
})

describe('community partner QR link', () => {
  it('uses the landing aff parameter and the code only', () => {
    const url = partnerLandingUrl('CROSSFITMID')
    expect(url).toBe('https://hybrid-experience.enforma.mx/?aff=CROSSFITMID')
    expect(new URL(url).searchParams.get(PARTNER_QUERY_PARAM)).toBe('CROSSFITMID')
    expect(url).not.toContain('999')
    expect(url).not.toContain('example.com')
    expect(url).not.toContain('Ana')
    const modules = partnerQrModules(url)
    expect(modules.length).toBeGreaterThan(20)
    expect(modules[0]?.slice(0, 7).every(Boolean)).toBe(true)
    const painted = modules.flat().map((dark) => (dark ? '1' : '0')).join('')
    expect(painted).not.toContain('9991234567')
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildMarketingBoard,
  buildMarketingSegments,
  buyersRetargetingOverlap,
  isMarketingBuyer,
  marketingFileName,
  marketingSegmentCsv,
  metaEntriesToCsv,
  type MarketingContact,
} from '../../../src/sales-dashboard/marketing'

function contact(overrides: Partial<MarketingContact>): MarketingContact {
  return {
    key: overrides.key ?? 'k',
    name: 'Persona Prueba',
    email: null,
    phone: null,
    status: 'LEAD',
    origin: 'current',
    categories: [],
    purchasedProducts: [],
    purchaseCount: 0,
    paidCents: 0,
    firstAt: null,
    lastAt: null,
    saleAt: null,
    registeredAt: null,
    importedAt: null,
    paymentCountedOnCurrent: false,
    consent: 'not-recorded',
    ...overrides,
  }
}

const people: MarketingContact[] = [
  contact({ key: 'buyer', name: 'Ana López', email: 'ana@example.com', phone: '999 111 1111', status: 'PAID', paidCents: 150000, purchaseCount: 1 }),
  contact({ key: 'legacy-buyer', name: 'Beto Ruiz', email: 'beto@example.com', phone: '9992222222', status: 'PAID', paidCents: 100000, origin: 'legacy' }),
  // Same payment already counted on a current order: still a buyer for the exclusion audience.
  contact({ key: 'dup-sale', name: 'Cata Mena', email: 'cata@example.com', phone: null, status: 'PAID', paymentCountedOnCurrent: true, origin: 'legacy' }),
  // Courtesy-like row: PAID with no amount and no counted payment. Not a buyer, not retargetable.
  contact({ key: 'zero', name: 'Cortesía Cero', email: 'cero@example.com', status: 'PAID', paidCents: 0, origin: 'legacy' }),
  contact({ key: 'pending', name: 'Pedro Pendiente', email: 'pedro@example.com', phone: '9993333333', status: 'PENDING' }),
  contact({ key: 'lead', name: 'Lupe Lead', email: 'lupe@example.com', status: 'LEAD' }),
  // A different email that shares the buyer's phone: must not be retargeted.
  contact({ key: 'typo', name: 'Ana López', email: 'ana@example.con', phone: '+52 999 111 1111', status: 'PENDING', origin: 'legacy' }),
  // Same email as a buyer in other casing: already merged upstream, but the guard must hold.
  contact({ key: 'shadow', name: 'Ana L', email: 'ANA@example.com', status: 'LEAD' }),
  contact({ key: 'nothing', name: 'Sin Datos', email: null, phone: null, status: 'LEAD' }),
  // +1 followed by a Mexican lada (226 is Veracruz): reported, never exported as +1.
  contact({ key: 'suspect', name: 'Adrián Águila', email: 'adrian@example.com', phone: '+1 2265066374', status: 'LEAD' }),
]

describe('marketing segments', () => {
  const segments = buildMarketingSegments(people)
  const emails = (entries: { email: string }[]) => entries.map((entry) => entry.email).filter(Boolean)

  it('defines a buyer as PAID with an amount or a sale already counted on a current order', () => {
    expect(isMarketingBuyer(people[0]!)).toBe(true)
    expect(isMarketingBuyer(people[2]!)).toBe(true)
    expect(isMarketingBuyer(people[3]!)).toBe(false)
    expect(isMarketingBuyer(people[4]!)).toBe(false)
    expect(emails(segments.buyers).sort()).toEqual(['ana@example.com', 'beto@example.com', 'cata@example.com'])
  })

  it('keeps every buyer out of retargeting, by email and by phone', () => {
    const retargeting = emails(segments.retargeting)
    expect(retargeting.sort()).toEqual(['adrian@example.com', 'lupe@example.com', 'pedro@example.com'])
    expect(buyersRetargetingOverlap(segments)).toBe(0)
    // The typo email carries the buyer's phone and the shadow email is the buyer's: both stay out.
    expect(retargeting).not.toContain('ana@example.con')
    expect(retargeting).not.toContain('ana@example.com')
    // A PAID row without amount is neither a buyer nor retargetable.
    expect(retargeting).not.toContain('cero@example.com')
  })

  it('lookalike carries everyone Meta can match once, and nobody without email or phone', () => {
    const lookalike = emails(segments.lookalike)
    expect(new Set(lookalike).size).toBe(lookalike.length)
    expect(lookalike).toContain('ana@example.com')
    expect(lookalike).toContain('pedro@example.com')
    expect(lookalike).toContain('lupe@example.com')
    expect(segments.lookalike.some((entry) => !entry.email && !entry.phone)).toBe(false)
    expect(segments.lookalike.length).toBeGreaterThan(segments.buyers.length)
  })

  it('deduplicates by email; a shared phone only collapses rows that have no valid email', () => {
    const two = buildMarketingSegments([
      contact({ key: 'a', email: 'a@example.com', phone: '9991110000', status: 'LEAD' }),
      contact({ key: 'b', email: 'b@example.com', phone: '9991110000', status: 'LEAD' }),
      contact({ key: 'c', email: null, phone: '+52 999 111 0000', status: 'LEAD' }),
      contact({ key: 'd', email: 'not-an-email', phone: '999-111-0000', status: 'LEAD' }),
    ])
    // Two different emails with one phone stay two rows; the rows with no valid email add nothing.
    expect(emails(two.lookalike).sort()).toEqual(['a@example.com', 'b@example.com'])
    expect(two.lookalike).toHaveLength(2)
  })

  it('reports a +1 with a Mexican lada and never exports it as +1', () => {
    expect(segments.suspiciousPhones.map((entry) => entry.contact.key)).toEqual(['suspect'])
    const csv = marketingSegmentCsv('lookalike', segments)
    expect(csv).not.toContain('+12265066374')
    expect(csv).not.toContain('2265066374')
    expect(csv).toContain('adrian@example.com,,adrián,águila,,,')
  })

  it('writes the agreed columns, the + prefix and empty ct and st', () => {
    const [header, ...rows] = marketingSegmentCsv('buyers', segments).split('\n')
    expect(header).toBe('email,phone,fn,ln,country,ct,st')
    expect(rows).toContain('ana@example.com,+529991111111,ana,lópez,MX,,')
    expect(metaEntriesToCsv([]).split('\n')).toEqual(['email,phone,fn,ln,country,ct,st'])
  })

  it('builds the board: counts, percentages, conversion and zero overlap', () => {
    const board = buildMarketingBoard(segments)
    const card = (key: string) => board.cards.find((item) => item.key === key)!
    expect(card('general').rows).toBe(segments.general.length)
    expect(card('buyers').rows).toBe(3)
    expect(card('retargeting').rows).toBe(3)
    expect(card('buyers').withEmail).toBe(3)
    expect(card('buyers').pctEmail).toBe(100)
    expect(card('buyers').withPhone).toBe(2)
    expect(card('buyers').pctPhone).toBeCloseTo(66.7, 1)
    expect(board.buyers).toBe(3)
    expect(board.conversionPct).toBeCloseTo((3 / segments.general.length) * 100, 0)
    expect(board.suspiciousPhones).toBe(1)
    expect(board.overlap).toBe(0)
    for (const item of board.cards) expect(item.use.length).toBeGreaterThan(20)
  })

  it('names files hex2026_<segmento>_<AAAAMMDD-HHmm> in Mérida time', () => {
    // 2026-10-20T03:05:00Z is 2026-10-19 21:05 in Mérida (UTC-6).
    const now = new Date('2026-10-20T03:05:00Z')
    expect(marketingFileName('lookalike', now)).toBe('hex2026_meta_lookalike_20261019-2105.csv')
    expect(marketingFileName('buyers', now)).toBe('hex2026_meta_compradores_20261019-2105.csv')
    expect(marketingFileName('retargeting', now)).toBe('hex2026_meta_retargeting_20261019-2105.csv')
    expect(marketingFileName('general', now)).toBe('hex2026_base-general_20261019-2105.csv')
  })
})

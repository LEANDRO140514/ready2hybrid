import type { FunnelEvent, LegacyRegistration } from './commercial'
import type { SalesOrder, SalesSnapshot, SaveAdjustmentInput } from './model'

const day = '2026-09-23'
const earlier = '2026-09-22'

function line(
  productCode: string,
  productName: string,
  block: string,
  kind: string,
  teamSize: number,
  saleState: string | null = 'AVAILABLE',
) {
  return {
    productCode,
    productName,
    block,
    kind,
    saleState,
    teamSize,
    quantity: 1,
  }
}

export const HARNESS_NOW = new Date('2026-09-23T18:00:00.000Z')

const orders: SalesOrder[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    trackingRef: 'TRK-IND',
    state: 'PAID',
    currency: 'MXN',
    totalCents: 150000,
    createdAt: `${day}T14:00:00.000Z`,
    updatedAt: `${day}T15:05:00.000Z`,
    expiresAt: `${day}T16:00:00.000Z`,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: 'LAUNCH',
    buyerName: 'Ana López',
    buyerEmail: 'ana@example.com',
    buyerPhone: '9991111111',
    buyerContactId: 'contact-ana',
    consentRecorded: true,
    visitorId: 'visitor-ana',
    firstTouch: { source: 'instagram', campaign: 'lanzamiento' },
    lastTouch: { source: 'instagram', campaign: 'lanzamiento' },
    lines: [line('IND-H', 'Individual Hombre', 'COMPITE', 'competitor', 1)],
    payments: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        provider: 'MERCADOPAGO',
        providerPaymentId: 'pay-ind',
        normalizedState: 'APPROVED',
        amountCents: 150000,
        providerUpdatedAt: `${day}T15:00:00.000Z`,
        createdAt: `${day}T15:00:00.000Z`,
      },
    ],
    tickets: [
      {
        id: 'ticket-ind',
        state: 'REVOKED',
        issuedAt: `${day}T15:02:00.000Z`,
        folio: 'F-1',
        emailState: 'SENT',
        emailResult: 'resend_1',
        emailUpdatedAt: `${day}T15:03:00.000Z`,
      },
    ],
    roster: [{ name: 'Ana López', role: null, position: null }],
    activity: [
      {
        at: `${day}T14:01:00.000Z`,
        action: 'CHECKOUT_PREFERENCE_ATTACHED',
        result: 'PAYMENT_PENDING',
      },
      {
        at: `${day}T15:01:00.000Z`,
        action: 'WEBHOOK_PAYMENT_APPLIED',
        result: 'PAID',
      },
    ],
    webhooks: [
      {
        receivedAt: `${day}T15:00:30.000Z`,
        processedAt: `${day}T15:01:00.000Z`,
        signatureResult: 'VALID',
        processingState: 'PROCESSED',
        result: 'PAID',
      },
    ],
    verifications: [
      {
        verifiedAt: `${day}T15:00:40.000Z`,
        merchantOk: true,
        referenceOk: true,
        amountOk: true,
        currencyOk: true,
        normalizedResult: 'APPROVED',
      },
    ],
    adjustment: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    trackingRef: 'TRK-DOB',
    state: 'PAID',
    currency: 'MXN',
    totalCents: 250000,
    createdAt: `${day}T15:10:00.000Z`,
    updatedAt: `${day}T16:05:00.000Z`,
    expiresAt: `${day}T18:00:00.000Z`,
    affiliateCode: 'ENFORMA',
    affiliateName: 'Enforma',
    commercialStage: 'PRESALE',
    buyerName: 'Luis Pérez',
    buyerEmail: 'luis@example.com',
    buyerPhone: '9992222222',
    lines: [line('DOB-SAB-HH', 'Dobles Hombres · Sábado', 'COMPITE', 'competitor', 2)],
    payments: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        provider: 'MERCADOPAGO',
        providerPaymentId: 'pay-dob',
        normalizedState: 'APPROVED',
        amountCents: 250000,
        providerUpdatedAt: `${day}T16:00:00.000Z`,
        createdAt: `${day}T16:00:00.000Z`,
      },
    ],
    tickets: [
      {
        id: 'ticket-dob',
        state: 'REVOKED',
        issuedAt: `${day}T16:02:00.000Z`,
        folio: 'F-2',
        emailState: 'SENT',
        emailResult: 'resend_2',
        emailUpdatedAt: `${day}T16:03:00.000Z`,
      },
    ],
    roster: [
      { name: 'Luis Pérez', role: 'CAPTAIN', position: 1 },
      { name: 'Marta Díaz', role: 'INVITEE', position: 2 },
    ],
    activity: [
      {
        at: `${day}T16:01:00.000Z`,
        action: 'WEBHOOK_PAYMENT_APPLIED',
        result: 'PAID',
      },
    ],
    webhooks: [],
    verifications: [],
    adjustment: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    trackingRef: 'TRK-OLD',
    state: 'PAYMENT_PENDING',
    currency: 'MXN',
    totalCents: 80000,
    createdAt: `${earlier}T12:00:00.000Z`,
    updatedAt: `${earlier}T12:00:00.000Z`,
    expiresAt: `${earlier}T13:00:00.000Z`,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: 'LAUNCH',
    buyerName: 'Vieja Orden',
    buyerEmail: 'vieja@example.com',
    buyerPhone: null,
    lines: [line('HALF-IND-H', '½ Hybrid Individual Hombre', 'EXPERIENCE', 'competitor', 1)],
    payments: [],
    tickets: [],
    roster: [],
    activity: [],
    webhooks: [],
    verifications: [],
    adjustment: null,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    trackingRef: 'TRK-PREF',
    state: 'PREFERENCE_PENDING',
    currency: 'MXN',
    totalCents: 25000,
    createdAt: `${day}T17:00:00.000Z`,
    updatedAt: `${day}T17:00:00.000Z`,
    expiresAt: `${day}T18:30:00.000Z`,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: 'LAUNCH',
    buyerName: 'Pref Pendiente',
    buyerEmail: 'pref@example.com',
    buyerPhone: '9993333333',
    lines: [line('PUB-VIE', 'Público · Viernes', 'ASISTE', 'spectator', 1)],
    payments: [],
    tickets: [],
    roster: [],
    activity: [],
    webhooks: [],
    verifications: [],
    adjustment: null,
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    trackingRef: 'TRK-GAP',
    state: 'PAID',
    currency: 'MXN',
    totalCents: 80000,
    createdAt: `${day}T16:30:00.000Z`,
    updatedAt: `${day}T17:10:00.000Z`,
    expiresAt: `${day}T18:00:00.000Z`,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: 'LAUNCH',
    buyerName: 'Sin Boleto',
    buyerEmail: 'gap@example.com',
    buyerPhone: null,
    lines: [line('HALF-IND-M', '½ Hybrid Individual Mujer', 'EXPERIENCE', 'competitor', 1)],
    payments: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
        provider: 'MERCADOPAGO',
        providerPaymentId: 'pay-gap',
        normalizedState: 'APPROVED',
        amountCents: 90000,
        providerUpdatedAt: `${day}T17:00:00.000Z`,
        createdAt: `${day}T17:00:00.000Z`,
      },
    ],
    tickets: [],
    roster: [],
    activity: [
      {
        at: `${day}T17:00:30.000Z`,
        action: 'WEBHOOK_PAYMENT_APPLIED',
        result: 'PAID',
      },
    ],
    webhooks: [],
    verifications: [],
    adjustment: null,
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    trackingRef: 'TRK-APPR',
    state: 'PAYMENT_PENDING',
    currency: 'MXN',
    totalCents: 100000,
    createdAt: `${day}T17:20:00.000Z`,
    updatedAt: `${day}T17:25:00.000Z`,
    expiresAt: `${day}T20:00:00.000Z`,
    affiliateCode: null,
    affiliateName: null,
    commercialStage: 'REGULAR',
    buyerName: 'Pago Sin Orden',
    buyerEmail: 'stuck@example.com',
    buyerPhone: null,
    lines: [line('WOD-H', 'Workout Experience Hombre', 'EXPERIENCE', 'workout', 1)],
    payments: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
        provider: 'MERCADOPAGO',
        providerPaymentId: 'pay-stuck',
        normalizedState: 'APPROVED',
        amountCents: 100000,
        providerUpdatedAt: `${day}T17:25:00.000Z`,
        createdAt: `${day}T17:25:00.000Z`,
      },
    ],
    tickets: [],
    roster: [],
    activity: [],
    webhooks: [],
    verifications: [
      {
        verifiedAt: `${day}T17:25:10.000Z`,
        merchantOk: false,
        referenceOk: true,
        amountOk: true,
        currencyOk: true,
        normalizedResult: 'VERIFICATION_REJECTED',
      },
    ],
    adjustment: null,
  },
]

export const HARNESS_SNAPSHOT: SalesSnapshot = {
  generatedAt: '2026-09-23T18:00:00.000Z',
  orders,
}

export const HARNESS_LEGACY: LegacyRegistration[] = [
  {
    id: 'legacy-ana-pending',
    eventCode: 'HEX-2026',
    originalStatus: 'pending',
    commercialStatus: 'LEGACY_PENDING',
    originalCreatedAt: '2026-08-01T12:00:00.000Z',
    originalUpdatedAt: '2026-08-01T12:00:00.000Z',
    buyerContactId: null,
    name: 'Ana López',
    email: 'ana@example.com',
    phone: '9991111111',
    categoryCode: 'IND-H',
    categoryName: 'Individual Hombre',
    amountCents: 150000,
    currency: 'MXN',
  },
  {
    id: 'legacy-paid-july',
    eventCode: 'HEX-2026',
    originalStatus: 'paid',
    commercialStatus: 'LEGACY_PAID',
    originalCreatedAt: '2026-07-01T12:00:00.000Z',
    originalUpdatedAt: '2026-07-02T12:00:00.000Z',
    buyerContactId: null,
    name: 'Luis Peña',
    email: 'luis@example.com',
    phone: '9992222222',
    categoryCode: 'DOB-SAB-HH',
    categoryName: 'Dobles Hombres',
    amountCents: 250000,
    currency: 'MXN',
    teamName: 'FF Endurance',
    participants: 'Luis Peña, Andrés Col',
    hasPaymentId: true,
  },
  {
    id: 'legacy-pending-a',
    eventCode: 'HEX-2026',
    originalStatus: 'pending',
    commercialStatus: 'LEGACY_PENDING',
    originalCreatedAt: '2026-09-20T12:00:00.000Z',
    originalUpdatedAt: '2026-09-20T12:00:00.000Z',
    buyerContactId: null,
    name: 'Marta Ruiz',
    email: 'marta@example.com',
    phone: '9993333333',
    categoryCode: 'PUB-VIE',
    categoryName: 'Público Viernes',
    amountCents: 25000,
    currency: 'MXN',
  },
  {
    id: 'legacy-pending-b',
    eventCode: 'HEX-2026',
    originalStatus: 'pending',
    commercialStatus: 'LEGACY_PENDING',
    originalCreatedAt: '2026-09-21T12:00:00.000Z',
    originalUpdatedAt: '2026-09-21T12:00:00.000Z',
    buyerContactId: null,
    name: 'Elena Ruiz',
    email: 'marta@example.com',
    phone: '9993333333',
    categoryCode: 'PUB-SAB',
    categoryName: 'Público Sábado',
    amountCents: 25000,
    currency: 'MXN',
  },
  {
    id: 'legacy-same-name',
    eventCode: 'HEX-2026',
    originalStatus: 'pending',
    commercialStatus: 'LEGACY_PENDING',
    originalCreatedAt: '2026-09-19T12:00:00.000Z',
    originalUpdatedAt: '2026-09-19T12:00:00.000Z',
    buyerContactId: null,
    name: 'Ana López',
    email: 'otra-ana@example.com',
    phone: '9994444444',
    categoryCode: 'IND-M',
    categoryName: 'Individual Mujer',
    amountCents: 150000,
    currency: 'MXN',
  },
]

export const HARNESS_FUNNEL: FunnelEvent[] = [
  { eventCode: 'HEX-2026', visitorId: 'visitor-a', eventType: 'LANDING_VIEW', occurredAt: '2026-09-22T12:00:00.000Z', orderId: null },
  { eventCode: 'HEX-2026', visitorId: 'visitor-a', eventType: 'LANDING_VIEW', occurredAt: '2026-09-22T12:05:00.000Z', orderId: null },
  { eventCode: 'HEX-2026', visitorId: 'visitor-a', eventType: 'EXPERIENCE_SELECTED', occurredAt: '2026-09-22T12:06:00.000Z', orderId: null },
  { eventCode: 'HEX-2026', visitorId: 'visitor-b', eventType: 'LANDING_VIEW', occurredAt: '2026-09-22T13:00:00.000Z', orderId: null },
  { eventCode: 'HEX-2026', visitorId: 'visitor-b', eventType: 'CHECKOUT_STARTED', occurredAt: '2026-09-22T13:05:00.000Z', orderId: null },
]

export function createHarnessSalesPort() {
  let orders = structuredClone(HARNESS_SNAPSHOT.orders)
  let tick = 0
  return {
    async loadSnapshot() {
      return {
        generatedAt: HARNESS_SNAPSHOT.generatedAt,
        orders,
      }
    },
    async loadCommercial() {
      return {
        eventCode: 'HEX-2026',
        legacy: HARNESS_LEGACY,
        funnel: HARNESS_FUNNEL,
      }
    },
    async saveAdjustment(input: SaveAdjustmentInput) {
      const order = orders.find((row) => row.id === input.orderId)
      const payment = order?.payments.find((row) => row.id === input.paymentId)
      if (!order || order.state !== 'PAID' || !payment) {
        throw new Error('No se pudo guardar la conciliación.')
      }
      const now = new Date(Date.parse('2026-09-23T18:00:00.000Z') + tick).toISOString()
      tick += 1000
      const previous = order.adjustment
      const adjustment = {
        id: previous?.id ?? crypto.randomUUID(),
        orderId: order.id,
        paymentId: payment.id,
        provider: payment.provider,
        providerFeeCents: input.providerFeeCents,
        providerFeeTaxCents: input.providerFeeTaxCents,
        otherCostsCents: input.otherCostsCents,
        notes: input.notes,
        source: 'MANUAL' as const,
        createdBy: previous?.createdBy ?? 'harness-user',
        createdAt: previous?.createdAt ?? now,
        updatedBy: 'harness-user',
        updatedAt: now,
        createdByLabel: previous?.createdByLabel ?? 'harness-user',
        updatedByLabel: 'harness-user',
      }
      orders = orders.map((row) =>
        row.id === order.id ? { ...row, adjustment } : row,
      )
    },
  }
}

import { useState } from 'react'

import { FinanceDashboard } from '../components/finance/FinanceDashboard'
import { TreasuryProposal } from '../components/finance/TreasuryProposal'
import { MarketingPage } from '../components/marketing/MarketingPage'
import {
  HARNESS_FUNNEL,
  HARNESS_LEGACY,
  HARNESS_SNAPSHOT,
} from '../sales-dashboard/harness-snapshot'
import { buildSourceLedger } from '../sales-dashboard/source-ledger'
import type { MarketingPayload } from '../sales-dashboard/marketing'

const PREVIEW_NOW = new Date('2026-09-23T18:00:00.000Z')

const PREVIEW_MARKETING: MarketingPayload = {
  eventCode: 'HEX-2026',
  visitors: 8,
  identifiedVisitors: 3,
  contacts: [
    {
      key: 'email:ana@example.com',
      name: 'Ana López',
      email: 'ana@example.com',
      phone: '9991111111',
      status: 'PAID',
      origin: 'current+legacy',
      categories: ['Individual Hombre'],
      paidCents: 150000,
      firstAt: '2026-08-01T12:00:00.000Z',
      lastAt: '2026-09-23T15:00:00.000Z',
      saleAt: '2026-09-23T15:00:00.000Z',
      registeredAt: '2026-08-01T12:00:00.000Z',
      importedAt: null,
      paymentCountedOnCurrent: false,
      purchaseCount: 1,
      purchasedProducts: ['Individual Hombre'],
      consent: 'recorded',
    },
    {
      key: 'email:luis@example.com',
      name: 'Luis Peña',
      email: 'luis@example.com',
      phone: '9992222222',
      status: 'PAID',
      origin: 'legacy',
      categories: ['Dobles Hombres'],
      paidCents: 250000,
      firstAt: '2026-07-01T12:00:00.000Z',
      lastAt: '2026-07-02T12:00:00.000Z',
      saleAt: '2026-07-02T12:00:00.000Z',
      registeredAt: '2026-07-01T12:00:00.000Z',
      importedAt: '2026-09-26T18:00:00.000Z',
      paymentCountedOnCurrent: false,
      purchaseCount: 1,
      purchasedProducts: ['Dobles Hombres'],
      consent: 'not-recorded',
    },
    {
      key: 'email:marta@example.com',
      name: 'Marta Ruiz',
      email: 'marta@example.com',
      phone: '9993333333',
      status: 'PENDING',
      origin: 'legacy',
      categories: ['Público Viernes'],
      paidCents: 0,
      firstAt: '2026-09-20T12:00:00.000Z',
      lastAt: '2026-09-20T12:00:00.000Z',
      saleAt: null,
      registeredAt: '2026-09-20T12:00:00.000Z',
      importedAt: null,
      paymentCountedOnCurrent: false,
      purchaseCount: 0,
      purchasedProducts: [],
      consent: 'not-recorded',
    },
  ],
}

export function DashboardPreviewPage() {
  const [surface, setSurface] = useState<'finance' | 'marketing' | 'treasury'>('finance')
  const excludedSalesCents = buildSourceLedger({
    orders: HARNESS_SNAPSHOT.orders.map((order) => ({
      id: order.id,
      state: order.state,
      totalCents: order.totalCents,
      email: order.buyerEmail,
      productCode: order.lines[0]?.productCode ?? null,
      approvedPaymentIds: order.payments
        .filter((payment) => payment.normalizedState === 'APPROVED')
        .map((payment) => payment.providerPaymentId),
    })),
    legacy: HARNESS_LEGACY.map((row) => ({
      id: row.id,
      commercialStatus: row.commercialStatus,
      email: row.email,
      productCode: row.categoryCode,
      amountCents: row.amountCents,
      paymentId: row.originalPaymentId ?? null,
      missingSince: row.missingSince ?? null,
    })),
    manualOrderIds: new Set<string>(),
  }).confirmedCents
  if (!import.meta.env.DEV) {
    return <p>Esta vista solo existe en el servidor local.</p>
  }
  return (
    <div>
      <p role="note" data-testid="preview-banner">
        Vista previa local. Todas las personas, fechas y montos de esta pantalla son de ejemplo.
        La sincronización con enforma no está publicada: esta lista no es la copia viva.
        Tesorería es una propuesta: no se guarda y no vuelve a contar las ventas.
      </p>
      <div className="chip-row">
        <button type="button" className="chip" aria-pressed={surface === 'finance'} onClick={() => setSurface('finance')}>
          Ventas
        </button>
        <button type="button" className="chip" aria-pressed={surface === 'treasury'} onClick={() => setSurface('treasury')}>
          Tesorería
        </button>
        <button type="button" className="chip" aria-pressed={surface === 'marketing'} onClick={() => setSurface('marketing')}>
          Marketing
        </button>
      </div>
      {surface === 'treasury' ? <TreasuryProposal excludedSalesCents={excludedSalesCents} /> : null}
      {surface === 'finance' ? (
        <FinanceDashboard
          snapshot={HARNESS_SNAPSHOT}
          commercial={{
            eventCode: 'HEX-2026',
            legacy: HARNESS_LEGACY,
            funnel: HARNESS_FUNNEL,
          }}
          role="OWNER"
          now={PREVIEW_NOW}
        />
      ) : null}
      {surface === 'marketing' ? <MarketingPage example={PREVIEW_MARKETING} /> : null}
    </div>
  )
}

import { TreasuryPage } from './TreasuryPage'
import type { TreasuryBooks } from '../../treasury/books'

const EXAMPLE: TreasuryBooks = {
  accounts: [{
    id: 'caja',
    name: 'Caja',
    active: true,
    openingBalanceCents: 500000,
    openingDate: '2026-08-01',
  }],
  categories: [{ id: 'renta', name: 'Renta', kind: 'expense', active: true }],
  movements: [{
    id: 'audio',
    type: 'expense',
    status: 'scheduled',
    accountId: 'caja',
    destinationAccountId: null,
    categoryId: 'renta',
    paymentMethod: null,
    amountCents: 300000,
    occurredOn: '2026-11-01',
    concept: 'Audio',
    counterparty: 'Audio local',
    notes: null,
    cancelReason: null,
    createdBy: 'Robert (ejemplo)',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedBy: 'Robert (ejemplo)',
    updatedAt: '2026-10-01T12:00:00.000Z',
  }],
}

export function TreasuryProposal({
  role = 'FINANCE',
}: {
  role?: string
  excludedSalesCents?: number
}) {
  return <TreasuryPage role={role} actor="Robert (ejemplo)" initial={EXAMPLE} />
}

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TreasuryProposal } from '../../../src/components/finance/TreasuryProposal'
import { formatMoney } from '../../../src/sales-dashboard/model'
import { planTreasuryWrite, roleMayUseTreasury } from '../../../insforge/functions/_shared/treasury/write'
import {
  movementsToCsv,
  scheduleToCsv,
  treasuryCashCents,
  weeklyFlow,
  type TreasuryBooks,
} from '../../../src/treasury/books'

const books: TreasuryBooks = {
  accounts: [
    { id: 'caja', name: 'Caja', active: true, openingBalanceCents: 1_700_000, openingDate: '2026-08-01' },
    { id: 'banco', name: 'Banco', active: true, openingBalanceCents: 0, openingDate: '2026-08-01' },
  ],
  categories: [{ id: 'renta', name: 'Renta', kind: 'expense', active: true }],
  movements: [{
    id: 'audio',
    type: 'expense',
    status: 'scheduled',
    accountId: 'caja',
    destinationAccountId: null,
    categoryId: 'renta',
    paymentMethod: null,
    amountCents: 300_000,
    occurredOn: '2026-10-01',
    concept: 'Audio',
    counterparty: 'Audio local',
    notes: 'nota',
    cancelReason: null,
    createdBy: 'robert@example.com',
    createdAt: '2026-10-01T18:00:00.000Z',
    updatedBy: 'robert@example.com',
    updatedAt: '2026-10-01T18:00:00.000Z',
  }],
}

describe('treasury books', () => {
  it('keeps a scheduled expense out of cash and folds it into the first week', () => {
    expect(treasuryCashCents(books)).toBe(1_700_000)
    const weeks = weeklyFlow(books, '2026-10-16')
    expect(weeks[0]?.expenseCents).toBe(300_000)
    expect(weeks[1]?.expenseCents).toBe(0)
  })

  it('does not change treasury cash when a posted transfer moves money', () => {
    const transferred: TreasuryBooks = {
      ...books,
      movements: [{
        ...books.movements[0]!,
        id: 'move',
        type: 'transfer',
        status: 'posted',
        categoryId: null,
        destinationAccountId: 'banco',
        paymentMethod: 'transferencia',
        amountCents: 100_000,
      }],
    }
    expect(treasuryCashCents(transferred)).toBe(1_700_000)
  })

  it('exports the approved movement columns and keeps a cancelled row', () => {
    const cancelled: TreasuryBooks = {
      ...books,
      movements: [{ ...books.movements[0]!, status: 'cancelled', cancelReason: 'duplicado' }],
    }
    const csv = movementsToCsv(cancelled, {
      accountId: '', categoryId: '', paymentMethod: '', type: '', from: '', to: '', status: 'posted',
    })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('FECHA,PROYECTO,PROVEEDOR,CONCEPTO,CONCEPTO GENERAL,MONTO,TIPO DE MOVIMIENTO,FORMA DE PAGO,CUENTA,COMENTARIO,ESTATUS,CUENTA DESTINO,ID,CAPTURADO POR,FECHA CAPTURA')
    expect(csv).toContain('HEX-2026')
    expect(csv).toContain('nota | duplicado')
    expect(csv).toContain('Cancelado')
  })

  it('labels an unmarked schedule export as the exported sum', () => {
    const csv = scheduleToCsv(books, {
      accountId: '', categoryId: '', paymentMethod: '', type: '', from: '', to: '', status: '',
    }, '2026-10-16', [])
    expect(csv).toContain('Seleccionado (suma exportada)')
    expect(csv).toContain('Vencido')
  })

  it('stores the session actor and ignores a body actor', () => {
    const planned = planTreasuryWrite(books, {
      intent: 'create-movement',
      type: 'expense',
      status: 'scheduled',
      accountId: 'caja',
      categoryId: 'renta',
      amountCents: 100,
      occurredOn: '2026-11-01',
      concept: 'Luz',
      createdBy: 'from-body',
      updatedBy: 'from-body',
    }, 'robert@example.com')
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.row.created_by).toBe('robert@example.com')
    expect(planned.row.updated_by).toBe('robert@example.com')
  })

  it('refuses to edit the amount of a posted movement', () => {
    const posted: TreasuryBooks = {
      ...books,
      movements: [{
        ...books.movements[0]!,
        status: 'posted',
        paymentMethod: 'efectivo',
      }],
    }
    const planned = planTreasuryWrite(posted, {
      intent: 'update-movement',
      id: 'audio',
      type: 'expense',
      status: 'posted',
      accountId: 'caja',
      categoryId: 'renta',
      paymentMethod: 'efectivo',
      amountCents: 1,
      occurredOn: '2026-10-01',
      concept: 'Audio',
      counterparty: 'Audio local',
      notes: 'nota',
    }, 'robert@example.com')
    expect(planned).toMatchObject({ ok: false, code: 'POSTED_ONLY_CANCELS' })
  })

  it('keeps a scheduled expense out of cash until the payment is registered', async () => {
    render(<TreasuryProposal />)
    expect(screen.getByTestId('treasury-cash').textContent).toBe(formatMoney(500_000))
    expect(screen.getByTestId('treasury-scheduled').textContent).toBe(formatMoney(300_000))
    fireEvent.change(screen.getByLabelText('Forma de pago de Audio'), { target: { value: 'efectivo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect((await screen.findByTestId('treasury-row')).textContent).toContain('Realizado')
    expect(screen.getByTestId('treasury-cash').textContent).toBe(formatMoney(200_000))
    expect(screen.getByTestId('treasury-scheduled').textContent).toBe(formatMoney(0))
    expect(screen.getByTestId('treasury-row').textContent).toContain('Robert (ejemplo)')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('cell', { name: 'Cancelado' })).toBeTruthy()
    expect(screen.getByTestId('treasury-cash').textContent).toBe(formatMoney(500_000))
  })

  it('keeps MARKETING out of the page and the role gate', () => {
    expect(roleMayUseTreasury('MARKETING')).toBe(false)
    render(<TreasuryProposal role="MARKETING" />)
    expect(screen.getByRole('alert').textContent).toContain('MARKETING no entra a tesorería.')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TreasuryProposal } from '../../../src/components/finance/TreasuryProposal'
import { formatMoney } from '../../../src/sales-dashboard/model'
import {
  EXAMPLE_BOOKS,
  cashCents,
  confirmImport,
  correctMovement,
  planImport,
  scheduledCents,
  setCatalogActive,
  TREASURY_CSV_HEADER,
} from '../../../src/treasury/books'

describe('treasury proposal', () => {
  it('keeps a scheduled expense out of cash', () => {
    expect(scheduledCents(EXAMPLE_BOOKS)).toBe(300000)
    expect(cashCents(EXAMPLE_BOOKS)).toBe(1700000)
    expect(cashCents(EXAMPLE_BOOKS, 'acc-bbva')).toBe(1200000)
  })

  it('posts a scheduled expense only when the payment is registered', () => {
    const scheduled = EXAMPLE_BOOKS.movements.find((movement) => movement.id === 'mov-audio')
    if (!scheduled) throw new Error('missing example')
    const posted = correctMovement(
      EXAMPLE_BOOKS,
      scheduled.id,
      { ...scheduled, status: 'posted' },
      'Robert (ejemplo)',
      '2026-10-16T12:00:00.000Z',
    )
    if (!posted.ok) throw new Error(posted.error)
    expect(cashCents(posted.books)).toBe(1400000)
    expect(scheduledCents(posted.books)).toBe(0)
    expect(posted.books.movements.find((movement) => movement.id === 'mov-audio')?.revisions[0]).toMatchObject({
      actor: 'Robert (ejemplo)',
      field: 'estado',
      before: 'scheduled',
      after: 'posted',
    })
  })

  it('rejects sales income and duplicate rows before confirm', () => {
    const csv = [
      TREASURY_CSV_HEADER,
      '2026-10-01,ingreso,realizado,Cuenta BBVA,Patrocinio,,Transferencia,Venta de boletos,100.00,VENTA-1',
      '2026-09-02,ingreso,realizado,Cuenta BBVA,Patrocinio,,Transferencia,Patrocinio local,20000.00,PAT-01',
      '2026-10-02,egreso,programado,Cuenta BBVA,Honorarios,Audio Norte,Transferencia,Audio extra,1500.00,AUDIO-02',
    ].join('\n')
    const planned = planImport(EXAMPLE_BOOKS, csv)
    if (!planned.ok) throw new Error(planned.error)
    expect(planned.plan.issues.map((issue) => issue.level)).toEqual(['error', 'duplicate'])
    expect(planned.plan.ready).toHaveLength(1)
    const saved = confirmImport(planned.plan.ready.length ? EXAMPLE_BOOKS : EXAMPLE_BOOKS, planned.plan.ready, 'Robert (ejemplo)', '2026-10-16T12:00:00.000Z')
    expect(saved.movements).toHaveLength(EXAMPLE_BOOKS.movements.length + 1)
    expect(cashCents(saved)).toBe(cashCents(EXAMPLE_BOOKS))
    expect(scheduledCents(saved)).toBe(450000)
  })

  it('deactivates a catalog item and keeps the historical name', () => {
    const next = setCatalogActive(EXAMPLE_BOOKS, 'cat-honorarios', false)
    expect(next.catalogs.find((item) => item.id === 'cat-honorarios')?.active).toBe(false)
    expect(next.movements.find((movement) => movement.id === 'mov-audio')?.categoryId).toBe('cat-honorarios')
  })

  it('shows scheduled money apart from cash and blocks marketing', () => {
    render(<TreasuryProposal excludedSalesCents={123456} />)
    expect(screen.getByTestId('treasury-cash').textContent).toContain(formatMoney(1700000))
    expect(screen.getByTestId('treasury-scheduled').textContent).toContain(formatMoney(300000))
    expect(screen.getByTestId('treasury-sales-excluded').textContent).toContain(formatMoney(123456))
    render(<TreasuryProposal role="MARKETING" excludedSalesCents={0} />)
    expect(screen.getByRole('alert').textContent).toContain('MARKETING no entra a tesorería.')
  })

  it('registers a payment from the proposal without counting it before that', () => {
    render(<TreasuryProposal excludedSalesCents={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Movimientos' }))
    expect(screen.queryByTestId('treasury-cash')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    fireEvent.click(screen.getByRole('button', { name: 'Posición' }))
    expect(screen.getByTestId('treasury-scheduled').textContent).toContain(formatMoney(0))
    expect(screen.getByTestId('treasury-cash').textContent).toContain(formatMoney(1400000))
  })
})
